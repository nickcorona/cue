package com.nickcorona.cue

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.os.Build
import org.json.JSONObject

// Home or out, for Now: away from home, it offers what can be done from the phone instead of
// the lift or the morning routine. Home is a spot he sets once in rules ("Set home here");
// after that only the distance to it is used. Nothing is tracked or sent but "home" or "out".
object Where {
    private const val RADIUS_M = 250f
    private const val FRESH_MS = 15 * 60_000L
    @Volatile private var fix: Location? = null

    fun home(c: Context): Location? {
        val p = Cue.prefs(c)
        if (!p.contains("home_lat")) return null
        return Location("home").apply { latitude = p.getFloat("home_lat", 0f).toDouble(); longitude = p.getFloat("home_lon", 0f).toDouble() }
    }

    fun setHome(c: Context, l: Location) =
        Cue.prefs(c).edit().putFloat("home_lat", l.latitude.toFloat()).putFloat("home_lon", l.longitude.toFloat()).apply()

    fun allowed(c: Context) = c.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
        c.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

    // "home", "out", or null when it can't tell (no home set, no permission, no recent fix).
    fun now(c: Context): String? {
        val home = home(c) ?: return null
        val here = latest(c)?.takeIf { System.currentTimeMillis() - it.time < FRESH_MS } ?: run { refresh(c); return null }
        return place(home, here)
    }

    fun place(home: Location, here: Location) = if (here.distanceTo(home) - here.accuracy.coerceAtMost(RADIUS_M) > RADIUS_M) "out" else "home"

    // The freshest location the phone already has, without turning anything on.
    @Suppress("MissingPermission")
    fun latest(c: Context): Location? {
        if (!allowed(c)) return null
        val lm = c.getSystemService(LocationManager::class.java) ?: return null
        return (lm.getProviders(true).mapNotNull { runCatching { lm.getLastKnownLocation(it) }.getOrNull() } + listOfNotNull(fix)).maxByOrNull { it.time }
    }

    // Ask for one fix in the background, so the next refresh has a fresh one.
    @Suppress("MissingPermission")
    fun refresh(c: Context, then: ((Location?) -> Unit)? = null) {
        if (!allowed(c)) return run { then?.invoke(null) }
        val lm = c.getSystemService(LocationManager::class.java) ?: return run { then?.invoke(null) }
        val provider = listOf(if (Build.VERSION.SDK_INT >= 31) LocationManager.FUSED_PROVIDER else null, LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER)
            .filterNotNull().firstOrNull { runCatching { lm.isProviderEnabled(it) }.getOrDefault(false) } ?: return run { then?.invoke(null) }
        val got = { l: Location? -> if (l != null) fix = l; then?.invoke(l) }
        if (Build.VERSION.SDK_INT >= 30) lm.getCurrentLocation(provider, null, c.mainExecutor) { got(it) }
        else @Suppress("DEPRECATION") lm.requestSingleUpdate(provider, { got(it) }, c.mainLooper)
    }
}

// Home's data, with home/out attached when it's known.
fun Api.widget(c: Context): JSONObject = get("/push", "widget" + (Where.now(c)?.let { "&where=$it" } ?: ""))
