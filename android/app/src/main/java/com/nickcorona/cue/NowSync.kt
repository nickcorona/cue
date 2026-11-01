package com.nickcorona.cue

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import org.json.JSONObject
import kotlin.concurrent.thread

// Keeps the Now notification current without waiting on a push: every time the screen comes
// on, and whenever Home fetches. The notification is public, so the lock screen then says
// what's next before the phone is even unlocked. The guard keeps the process alive, so the
// screen-on receiver stays registered.
object NowSync {
    fun start(c: Context) {
        val r = object : BroadcastReceiver() {
            override fun onReceive(c: Context, i: Intent) = refreshAsync(c)
        }
        val f = IntentFilter(Intent.ACTION_SCREEN_ON)
        if (Build.VERSION.SDK_INT >= 33) c.registerReceiver(r, f, Context.RECEIVER_NOT_EXPORTED) else c.registerReceiver(r, f)
    }

    fun refreshAsync(c: Context) {
        if (Cue.key(c) == null) return
        thread {
            Capture.flush(c.applicationContext)
            runCatching { apply(c.applicationContext, Api(c).widget(c)) }
        }
    }

    fun apply(c: Context, d: JSONObject) {
        Cue.prefs(c).edit().putString("widget", d.toString()).apply()
        val now = d.optJSONObject("now")
        val last = Cue.lastNow(c)
        when {
            now == null -> if (last != null) Notifier.cancelNow(c)
            now.toString() != last?.toString() -> Notifier.show(c, Ping.parse(now), quiet = true)
        }
        NowWidget.draw(c, d)
    }
}

// Undo for a mis-tap. The server's last_done skips routine steps until the routine is done
// (the web app unticks those from the routine card, which Home doesn't have), so the phone also
// remembers its own last Done for 15 minutes and offers whichever check-off is more recent.
object Undo {
    private const val WINDOW = 15 * 60_000L

    fun remember(c: Context, check: JSONObject?, label: String) {
        if (check == null || check.optString("kind") == "focus") return
        Cue.prefs(c).edit().putString("undo", JSONObject(check.toString()).put("label", label)
            .put("tapped", System.currentTimeMillis()).toString()).apply()
    }

    fun forget(c: Context) = Cue.prefs(c).edit().remove("undo").apply()

    // `open` is what's on Home right now (the Now item and today's tasks): a check-off that was
    // undone somewhere else is open again, and offering to undo it would make no sense.
    fun pick(c: Context, server: JSONObject?, now: Long = System.currentTimeMillis(), open: Set<String> = emptySet()): JSONObject? {
        val mine = Cue.prefs(c).getString("undo", null)?.let { runCatching { JSONObject(it) }.getOrNull() }
            ?.takeIf { now - it.optLong("tapped") < WINDOW && key(it) !in open }
        val serverAt = server?.optString("at")?.let { runCatching { java.time.Instant.parse(it).toEpochMilli() }.getOrNull() } ?: 0L
        return if (mine != null && mine.optLong("tapped") >= serverAt - 5_000) mine else server?.takeIf { key(it) !in open }
    }

    fun key(j: JSONObject) = listOf(j.optString("kind"), j.optString("id"), j.optString("step_id")).joinToString(":")
}
