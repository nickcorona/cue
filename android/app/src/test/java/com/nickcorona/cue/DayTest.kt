package com.nickcorona.cue

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.ZoneId
import java.time.ZonedDateTime

class DayTest {
    private val tz = ZoneId.of("America/Toronto")
    private fun at(y: Int, m: Int, d: Int, h: Int, min: Int = 0) = ZonedDateTime.of(y, m, d, h, min, 0, 0, tz).toInstant().toEpochMilli()
    private val fmt: (Long) -> String = { java.time.Instant.ofEpochMilli(it).atZone(tz).let { z -> "%d:%02d".format(z.hour, z.minute) } }

    @Test fun sunAtSolarNoonInJuneIsHighAndDueSouth() {
        // Toronto's solar noon on June 21 is about 13:21 EDT; max elevation is 90 - 43.65 + 23.44.
        val (el, az) = Day.sun(at(2026, 6, 21, 13, 21), Day.LAT, Day.LON)
        assertEquals(69.8, el, 0.6)
        assertEquals(180.0, az, 2.0)
    }

    @Test fun morningSunIsInTheEastAndBelowTheHorizonAtNight() {
        val (el, az) = Day.sun(at(2026, 11, 2, 9), Day.LAT, Day.LON)
        assertTrue(el in 10.0..25.0)
        assertTrue(az in 110.0..150.0)
        assertTrue(Day.sun(at(2026, 11, 2, 23), Day.LAT, Day.LON).first < 0)
    }

    @Test fun eastBalconyGetsMorningSunWestGetsAfternoon() {
        val day = at(2026, 11, 2, 0) to at(2026, 11, 3, 0)
        val east = Day.sunWindows(90.0, day.first, day.second).single()
        val west = Day.sunWindows(270.0, day.first, day.second).single()
        assertTrue(fmt(east.first), east.first < at(2026, 11, 2, 9))
        assertTrue(fmt(east.second), east.second < at(2026, 11, 2, 13))
        assertTrue(fmt(west.first), west.first > at(2026, 11, 2, 11))
        assertTrue(Day.sunWindows(0.0, day.first, day.second).isEmpty())
        // Asking a few minutes later gives the same start, not one that creeps up.
        val starts = (0..6).map { Day.sunWindows(150.0, at(2026, 11, 2, 7) + it * 60_000L, day.second).first().first }
        assertEquals(starts.toString(), 1, starts.toSet().size)
    }

    @Test fun balconyLuxIsBrightInSunDimInShadeAndNoneAtNight() {
        val sunny = Day.lux(140.0, at(2026, 11, 2, 9, 30), 0)!!
        val side = Day.lux(70.0, at(2026, 11, 2, 9, 30), 0)!!
        val shade = Day.lux(300.0, at(2026, 11, 2, 9, 30), 0)!!
        // Measured on his east-facing balcony, overcast, 9:30 on Nov 2: about 2k.
        val grey = Day.lux(70.0, at(2026, 11, 2, 9, 30), 100)!!
        assertTrue("$sunny", sunny in 30_000..80_000)
        assertTrue("$side", side in 10_000..30_000)
        assertTrue("$shade", shade in 1_000..6_000)
        assertTrue("$grey", grey in 1_000..4_000)
        assertEquals(null, Day.lux(120.0, at(2026, 11, 2, 22), 0))
        assertEquals("32k", Day.kLux(31_600))
        assertEquals("800", Day.kLux(760))
    }

    @Test fun aMeasurementScalesTheBalconyEstimate() {
        val now = at(2026, 11, 2, 10, 15)
        val w = JSONObject().put("current", JSONObject().put("cloud_cover", 25))
        fun shown(scale: Double) = Day.highlights(w, emptyList(), 300.0, now, at(2026, 11, 3, 0), fmt, scale).first { it.startsWith("Balcony") }
        val raw = shown(1.0).filter { it.isDigit() }.toInt()
        val scaled = shown(0.5).filter { it.isDigit() }.toInt()
        assertTrue("${shown(1.0)} vs ${shown(0.5)}", scaled < raw)
    }

    @Test fun feelsLikeIsWindChillHumidexOrTheAir() {
        assertEquals(7.5, Day.feelsLike(7.5, 4.7, 81.0), 0.01)
        assertEquals(-3.0, Math.round(Day.feelsLike(2.0, 25.0, 70.0)).toDouble(), 0.01)
        assertEquals(34.0, Math.round(Day.feelsLike(28.0, 10.0, 60.0)).toDouble(), 1.0)
        val w = JSONObject().put("current", JSONObject().put("temperature_2m", 7.5).put("apparent_temperature", 5.4)
            .put("relative_humidity_2m", 81).put("wind_speed_10m", 4.7).put("weather_code", 0))
        assertEquals("feels 8° · clear", Day.conditions(w))
    }

    @Test fun theTopShowsFeelsLikeAndOnlyWhatsClose() {
        val now = at(2026, 11, 2, 13)
        val hours = (0 until 24).map { at(2026, 11, 2, it) / 1000 }
        val w = JSONObject()
            .put("current", JSONObject().put("temperature_2m", 7.2).put("apparent_temperature", 3.1).put("weather_code", 3))
            .put("daily", JSONObject().put("uv_index_max", JSONArray().put(2.0)).put("sunset", JSONArray().put(at(2026, 11, 2, 16, 59) / 1000)))
            .put("hourly", JSONObject().put("time", JSONArray(hours))
                .put("precipitation_probability", JSONArray((0 until 24).map { if (it == 15) 70 else 10 }))
                .put("cloud_cover", JSONArray((0 until 24).map { 20 })))
        assertEquals("feels 3° · cloudy", Day.conditions(w))
        val events = listOf(JSONObject().put("title", "Dentist").put("start", at(2026, 11, 2, 14, 30)).put("end", at(2026, 11, 2, 15, 30)))
        val next = Day.highlights(w, events, 180.0, now, at(2026, 11, 3, 0), fmt)
        assertEquals("Dentist 14:30", next[0])
        assertEquals("Rain ~15:00", next[1])
        assertTrue(next.toString(), next.any { it.startsWith("Balcony sun ~") && it.contains(" lux till ") })
        // Late evening with nothing close: nothing to say.
        val late = at(2026, 11, 2, 21)
        assertTrue(Day.highlights(w, emptyList(), 180.0, late, at(2026, 11, 3, 0), fmt).isEmpty())
        // An event tonight isn't "close" at 10am.
        val far = listOf(JSONObject().put("title", "Dinner").put("start", at(2026, 11, 2, 19)).put("end", at(2026, 11, 2, 21)))
        assertTrue(Day.highlights(null, far, null, at(2026, 11, 2, 10), at(2026, 11, 3, 0), fmt).isEmpty())
    }

    @Test fun compassNames() {
        assertEquals("N", Day.compass(355.0))
        assertEquals("SW", Day.compass(224.0))
        assertEquals("E", Day.compass(90.0))
    }
}
