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
        thread { runCatching { apply(c.applicationContext, Api(c).get("/push", "widget")) } }
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
