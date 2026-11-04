package com.nickcorona.cue

import android.app.Notification
import android.app.PendingIntent
import android.content.Context
import android.os.SystemClock
import android.service.notification.StatusBarNotification
import android.widget.Chronometer
import android.widget.LinearLayout

// A stopwatch or timer running in the Clock app shows on Home as a live line, read from the
// Clock's own ongoing notification (Cue already has notification access for the filter).
// Running: a ticking count up or down from the notification's start time. Paused: the
// notification's own text. Tapping opens it in the Clock.
data class ClockItem(val key: String, val title: String, val text: String, val whenMs: Long, val running: Boolean, val countDown: Boolean)

object Clocks {
    // Called by Quiet whenever notifications change, so Home can redraw the line.
    @Volatile var onChange: (() -> Unit)? = null

    fun isClock(pkg: String, category: String?, ongoing: Boolean) =
        category == Notification.CATEGORY_STOPWATCH || (ongoing && pkg.contains("deskclock"))

    fun from(sbn: StatusBarNotification): ClockItem? {
        val n = sbn.notification
        if (!isClock(sbn.packageName, n.category, sbn.isOngoing)) return null
        val x = n.extras
        val title = x.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val text = x.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
        if (title.isEmpty() && text.isEmpty()) return null
        return ClockItem(sbn.key, title.ifEmpty { "Clock" }, text, n.`when`,
            running = x.getBoolean(Notification.EXTRA_SHOW_CHRONOMETER), countDown = x.getBoolean(Notification.EXTRA_CHRONOMETER_COUNT_DOWN))
    }

    fun active(): List<Pair<ClockItem, PendingIntent?>> = runCatching { Quiet.live?.activeNotifications.orEmpty() }.getOrDefault(emptyArray())
        .mapNotNull { sbn -> from(sbn)?.let { it to sbn.notification.contentIntent } }

    // One row per running clock: its name, then the time, big enough to read across a room.
    fun show(c: Context, box: LinearLayout) {
        box.removeAllViews()
        for ((it, open) in active()) box.addView(LinearLayout(c).apply {
            gravity = android.view.Gravity.CENTER_VERTICAL
            setPadding(0, 0, 0, c.dp(6))
            val go = { runCatching { open?.send() }; Unit }
            addView(c.text(if (it.running) it.title else listOf(it.title, it.text).filter(String::isNotEmpty).joinToString(" · "), 14f, DIM, go).apply {
                maxLines = 1; ellipsize = android.text.TextUtils.TruncateAt.END
            }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            if (it.running) addView(Chronometer(c).apply {
                isCountDown = it.countDown
                base = SystemClock.elapsedRealtime() + (it.whenMs - System.currentTimeMillis())
                textSize = 22f
                setTextColor(FG)
                Look.style(this, "display", textSize)
                setOnClickListener { go() }
                start()
            })
        })
    }
}
