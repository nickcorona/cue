package com.nickcorona.cue

import android.content.Context
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.math.abs
import kotlin.math.asin
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.tan

// The day at a glance for Cue Home: weather (Open-Meteo, no key), sunset, when the sun is on
// the balcony, and the next calendar event. Everything here is plain functions of the data so
// it can be tested without a phone.
object Day {
    const val LAT = 43.65
    const val LON = -79.38
    private const val TTL = 30 * 60_000L

    // Sun on the balcony means it's high enough to clear the railing and the street, and in
    // front of the balcony rather than behind or alongside the wall.
    private const val MIN_ELEVATION = 10.0
    private const val MAX_OFF_AXIS = 80.0

    fun balcony(c: Context): Double? = Cue.prefs(c).getFloat("balcony_deg", -1f).takeIf { it >= 0 }?.toDouble()
    fun setBalcony(c: Context, deg: Double) = Cue.prefs(c).edit().putFloat("balcony_deg", deg.toFloat()).apply()

    fun cached(c: Context): JSONObject? = Cue.prefs(c).getString("weather", null)?.let { runCatching { JSONObject(it) }.getOrNull() }

    // Blocking; call off the main thread. Returns the cached copy while it's fresh.
    fun weather(c: Context, now: Long = System.currentTimeMillis()): JSONObject? {
        cached(c)?.takeIf { now - it.optLong("fetched") < TTL }?.let { return it }
        val url = "https://api.open-meteo.com/v1/forecast?latitude=$LAT&longitude=$LON" +
            "&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,cloud_cover" +
            "&hourly=precipitation_probability,cloud_cover" +
            "&daily=temperature_2m_max,temperature_2m_min,uv_index_max,sunset" +
            "&timezone=America%2FToronto&forecast_days=2&timeformat=unixtime"
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 6000
        conn.readTimeout = 8000
        return try {
            if (conn.responseCode != 200) return cached(c)
            JSONObject(conn.inputStream.bufferedReader().use { it.readText() }).put("fetched", now).also { w ->
                Cue.prefs(c).edit().putString("weather", w.toString()).apply()
            }
        } catch (_: Exception) {
            cached(c)
        } finally {
            conn.disconnect()
        }
    }

    // The weather in a few words for the date line. Feels-like, not the thermometer: it's what
    // to dress for. Environment Canada's version (wind chill when cold and windy, humidex when
    // warm, otherwise the air), which is what Google and the forecasts here quote. Open-Meteo's
    // apparent temperature reads a few degrees colder even in still air.
    fun conditions(w: JSONObject?): String? {
        val cur = w?.optJSONObject("current") ?: return null
        val feels = if (cur.has("wind_speed_10m")) feelsLike(cur.optDouble("temperature_2m"), cur.optDouble("wind_speed_10m"), cur.optDouble("relative_humidity_2m"))
            else cur.optDouble("apparent_temperature")
        return listOfNotNull("feels ${Math.round(feels)}°", sky(cur.optInt("weather_code"))).joinToString(" · ")
    }

    fun feelsLike(t: Double, windKmh: Double, rh: Double): Double {
        if (t <= 10 && windKmh >= 5) {
            val v = Math.pow(windKmh, 0.16)
            return 13.12 + 0.6215 * t - 11.37 * v + 0.3965 * t * v
        }
        if (t >= 20 && !rh.isNaN()) {
            val e = 6.112 * Math.exp(17.62 * t / (243.12 + t)) * rh / 100
            return maxOf(t, t + 0.5555 * (e - 10))
        }
        return t
    }

    // What's worth knowing next, most useful first; Home shows the top two and nothing when
    // nothing is close. Events and rain within 3 hours, balcony sun now or within 2, a high UV,
    // sunset within 2.
    // The next event within 3 hours, time first so a long title can't push it off the line.
    fun eventLine(events: List<JSONObject>, now: Long, fmt: (Long) -> String): String? = events.firstOrNull()?.let { e ->
        val start = e.optLong("start")
        when {
            start <= now -> "Till ${fmt(e.optLong("end"))}  ${e.optString("title")}"
            start < now + 3 * 3_600_000 -> "${fmt(start)}  ${e.optString("title")}"
            else -> null
        }
    }

    fun highlights(w: JSONObject?, facing: Double?, now: Long, endOfDay: Long, fmt: (Long) -> String): List<String> {
        val out = mutableListOf<String>()
        val soon = now + 3 * 3_600_000
        if (w != null) rainFrom(w, now, minOf(endOfDay, soon))?.let { (at, _) -> out += if (at <= now) "Raining" else "Rain ~${fmt(at)}" }
        // When the sun is on the balcony. No lux figure: the estimate never matched the meter.
        if (facing != null) {
            val win = sunWindows(facing, now, endOfDay).firstOrNull()
            val cloudy = win?.let { (a, b) -> cloudCover(w, a, b)?.let { it >= 70 } } == true
            when {
                win != null && !cloudy && win.first <= now -> out += "Balcony sun till ${fmt(win.second)}"
                win != null && !cloudy && win.first < now + 2 * 3_600_000 -> out += "Balcony sun ${fmt(win.first)}"
            }
        }
        w?.optJSONObject("daily")?.let { daily ->
            daily.optJSONArray("uv_index_max")?.optDouble(0)?.takeIf { it >= 6 }?.let { out += "UV ${it.toInt()}" }
            daily.optJSONArray("sunset")?.optLong(0)?.let { it * 1000 }?.takeIf { it > now && it < now + 2 * 3_600_000 }?.let { out += "Sunset ${fmt(it)}" }
        }
        return out
    }

    // [start, end) stretches from `from` to `to` when the sun is on a balcony facing `facing`
    // degrees (0 = north, 90 = east), to the minute. Steps sit on whole minutes so the answer
    // doesn't drift as `from` moves.
    fun sunWindows(facing: Double, from: Long, to: Long, lat: Double = LAT, lon: Double = LON): List<Pair<Long, Long>> {
        val step = 60_000L
        val out = mutableListOf<Pair<Long, Long>>()
        var start: Long? = null
        var t = from - from % step
        while (t <= to) {
            val (el, az) = sun(t, lat, lon)
            val on = el > MIN_ELEVATION && angle(az, facing) < MAX_OFF_AXIS
            if (on && start == null) start = maxOf(t, from)
            if (!on && start != null) { out += start to t; start = null }
            t += step
        }
        if (start != null) out += start to to
        return out
    }

    // Solar elevation and azimuth (degrees, azimuth clockwise from north), the usual low-precision
    // almanac formulas; good to well under a degree, plenty for "is it on the balcony".
    fun sun(t: Long, lat: Double, lon: Double): Pair<Double, Double> {
        val d = t / 86_400_000.0 + 2440587.5 - 2451545.0
        val g = Math.toRadians(357.529 + 0.98560028 * d)
        val q = 280.459 + 0.98564736 * d
        val l = Math.toRadians(q + 1.915 * sin(g) + 0.020 * sin(2 * g))
        val e = Math.toRadians(23.439 - 0.00000036 * d)
        val ra = atan2(cos(e) * sin(l), cos(l))
        val dec = asin(sin(e) * sin(l))
        val gmst = 18.697374558 + 24.06570982441908 * d
        val ha = Math.toRadians(gmst * 15 + lon) - ra
        val la = Math.toRadians(lat)
        val el = asin(sin(la) * sin(dec) + cos(la) * cos(dec) * cos(ha))
        val az = atan2(-sin(ha), tan(dec) * cos(la) - sin(la) * cos(ha))
        return Math.toDegrees(el) to (Math.toDegrees(az) % 360 + 360) % 360
    }

    fun compass(deg: Double) = listOf("N", "NE", "E", "SE", "S", "SW", "W", "NW")[(((deg + 22.5) % 360) / 45).toInt()]

    private fun angle(a: Double, b: Double) = abs(((a - b) % 360 + 540) % 360 - 180)

    // The first hour from now (to the end of today) with a 50%+ chance of rain.
    private fun rainFrom(w: JSONObject, now: Long, endOfDay: Long): Pair<Long, Int>? {
        val h = w.optJSONObject("hourly") ?: return null
        val times = h.optJSONArray("time") ?: return null
        val p = h.optJSONArray("precipitation_probability") ?: return null
        for (i in 0 until times.length()) {
            val t = times.optLong(i) * 1000
            if (t + 3_600_000 <= now || t >= endOfDay) continue
            if (p.optInt(i) >= 50) return t to p.optInt(i)
        }
        return null
    }

    private fun cloudCover(w: JSONObject?, from: Long, to: Long): Int? {
        val h = w?.optJSONObject("hourly") ?: return null
        val times = h.optJSONArray("time") ?: return null
        val cc = h.optJSONArray("cloud_cover") ?: return null
        val vals = (0 until times.length()).filter { val t = times.optLong(it) * 1000; t + 3_600_000 > from && t < to }.map { cc.optInt(it) }
        return if (vals.isEmpty()) null else vals.average().toInt()
    }

    private fun sky(code: Int) = when (code) {
        0 -> "clear"
        1, 2 -> "partly cloudy"
        3 -> "cloudy"
        45, 48 -> "fog"
        in 51..57 -> "drizzle"
        in 61..67 -> "rain"
        in 71..77 -> "snow"
        in 80..82 -> "showers"
        85, 86 -> "snow showers"
        in 95..99 -> "thunderstorms"
        else -> null
    }

    fun clock(c: Context): (Long) -> String {
        val f = SimpleDateFormat(if (android.text.format.DateFormat.is24HourFormat(c)) "H:mm" else "h:mm", Locale.getDefault())
        return { f.format(Date(it)) }
    }
}
