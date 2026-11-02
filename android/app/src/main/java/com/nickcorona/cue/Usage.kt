package com.nickcorona.cue

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Process
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneId

// Is Cue Home working? Daily screen time, unlocks and time per app, from the same usage data
// Digital Wellbeing shows (it needs Usage access). The last week goes to the server, which keeps
// it by date and shows the trend on the Sunday card, against the days before Cue Home.
object Usage {
    private const val EVERY = 6 * 3_600_000L
    private const val DAYS = 8

    fun granted(c: Context): Boolean = runCatching {
        c.getSystemService(AppOpsManager::class.java)
            ?.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), c.packageName) == AppOpsManager.MODE_ALLOWED
    }.getOrDefault(false)

    // Time on a launcher (Cue Home, the stock one) or the system UI isn't phone use.
    private fun ignored(c: Context): Set<String> =
        c.packageManager.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME), 0)
            .map { it.activityInfo.packageName }.toSet() + c.packageName + "com.android.systemui" + "android"

    // One day from the event log: foreground minutes per app (resumed to paused), and unlocks.
    fun day(c: Context, date: LocalDate, zone: ZoneId = ZoneId.systemDefault(), now: Long = System.currentTimeMillis()): JSONObject? {
        val usm = c.getSystemService(UsageStatsManager::class.java) ?: return null
        val start = date.atStartOfDay(zone).toInstant().toEpochMilli()
        val end = minOf(date.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli(), now)
        if (end <= start) return null
        val events = usm.queryEvents(start, end) ?: return null
        val open = HashMap<String, Long>()
        val ms = HashMap<String, Long>()
        var unlocks = 0
        var seen = false
        val e = UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(e)
            seen = true
            when (e.eventType) {
                UsageEvents.Event.ACTIVITY_RESUMED -> open[e.packageName] = e.timeStamp
                UsageEvents.Event.ACTIVITY_PAUSED, UsageEvents.Event.ACTIVITY_STOPPED ->
                    open.remove(e.packageName)?.let { ms.merge(e.packageName, e.timeStamp - it, Long::plus) }
                UsageEvents.Event.KEYGUARD_HIDDEN -> unlocks++
                UsageEvents.Event.SCREEN_NON_INTERACTIVE -> {
                    open.forEach { (p, t) -> ms.merge(p, e.timeStamp - t, Long::plus) }
                    open.clear()
                }
            }
        }
        // Still open at the end of the day (or now).
        open.forEach { (p, t) -> ms.merge(p, end - t, Long::plus) }
        if (!seen) return null
        return summarize(c, date, ms, unlocks)
    }

    fun summarize(c: Context, date: LocalDate, ms: Map<String, Long>, unlocks: Int): JSONObject {
        val skip = ignored(c)
        val apps = ms.filterKeys { it !in skip }.mapValues { (it.value / 60_000).toInt() }.filterValues { it > 0 }
        val r = Rules(c)
        return JSONObject().put("date", date.toString())
            .put("screen_min", apps.values.sum())
            .put("unlocks", unlocks)
            .put("gated_min", apps.filterKeys { r.level(it) >= Rules.GATED }.values.sum())
            .put("apps", JSONObject().apply { apps.entries.sortedByDescending { it.value }.take(8).forEach { (p, m) -> put(label(c, p), m) } })
    }

    private fun label(c: Context, pkg: String) =
        runCatching { c.packageManager.getApplicationLabel(c.packageManager.getApplicationInfo(pkg, 0)).toString() }.getOrDefault(pkg)

    // Blocking: off the main thread. At most every 6 hours; each send covers the last week, so a
    // missed day fills in later and today's total firms up.
    fun sync(c: Context, now: Long = System.currentTimeMillis()) {
        if (Cue.key(c) == null || !granted(c)) return
        val p = Cue.prefs(c)
        if (now - p.getLong("usage_at", 0) < EVERY) return
        val today = LocalDate.now()
        val days = JSONArray()
        for (k in DAYS - 1 downTo 0) runCatching { day(c, today.minusDays(k.toLong()), now = now) }.getOrNull()?.let { days.put(it) }
        if (days.length() == 0) return
        runCatching { Api(c).push("usage", JSONObject().put("days", days)) }.onSuccess { p.edit().putLong("usage_at", now).apply() }
    }
}
