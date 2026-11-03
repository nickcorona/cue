package com.nickcorona.cue

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

// The lift page's rest timer, kept by the phone itself so "Rest over" goes off with Cue closed
// or the screen off. The server's rest ping never arrived; this doesn't need the network.
class RestAlarm : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) =
        Notifier.timerDone(c, "Rest over", i.getStringExtra("next")?.let { "Next: $it" } ?: "Next set", "cue-rest", "/lift?session=1")

    companion object {
        private fun pending(c: Context, next: String? = null) = PendingIntent.getBroadcast(c, 7,
            Intent(c, RestAlarm::class.java).apply { next?.let { putExtra("next", it) } },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

        fun set(c: Context, at: Long, next: String) {
            val am = c.getSystemService(AlarmManager::class.java)
            Notifier.cancel(c, "cue-rest")
            if (android.os.Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending(c, next))
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending(c, next))
        }

        fun clear(c: Context) = c.getSystemService(AlarmManager::class.java).cancel(pending(c))
    }
}
