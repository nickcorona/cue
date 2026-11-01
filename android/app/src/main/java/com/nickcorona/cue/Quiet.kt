package com.nickcorona.cue

import android.app.Notification
import android.content.Context
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.telecom.TelecomManager

// A buzz from a blocked app is a cue to go open it, so those never reach the shade. During a
// focus block the rest are held too (see Hold).
class Quiet : NotificationListenerService() {
    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (!Rules(this).isAllowed(sbn.packageName)) return cancelNotification(sbn.key)
        val n = sbn.notification
        if (Hold.shouldHold(this, sbn.packageName, n.category, sbn.isOngoing)) {
            snoozeNotification(sbn.key, Hold.CHUNK)
            Hold.note(this, sbn.key)
        }
    }

    override fun onListenerConnected() {
        activeNotifications?.forEach(::onNotificationPosted)
    }
}

// Focus holds notifications instead of dropping them: each one is snoozed for a few minutes
// and snoozed again when it comes back if the block is still running, so everything arrives
// within a chunk of the block ending, early stops included. Calls, alarms, Cue itself and
// ongoing ones (music, navigation) always come through.
object Hold {
    const val CHUNK = 5 * 60_000L
    private val THROUGH = setOf(Notification.CATEGORY_CALL, Notification.CATEGORY_ALARM, Notification.CATEGORY_NAVIGATION,
        Notification.CATEGORY_TRANSPORT, Notification.CATEGORY_STOPWATCH)

    // When the running focus block ends, from the last Now payload, or null when not focusing.
    fun focusEnds(c: Context, now: Long = System.currentTimeMillis()): Long? = Cue.lastNow(c)
        ?.takeIf { it.optJSONObject("check")?.optString("kind") == "focus" }
        ?.optLong("ends")?.takeIf { it > now }

    fun shouldHold(c: Context, pkg: String, category: String?, ongoing: Boolean): Boolean {
        if (focusEnds(c) == null || ongoing || category in THROUGH) return false
        val calls = setOfNotNull(c.getSystemService(TelecomManager::class.java)?.defaultDialerPackage, "com.android.server.telecom")
        return pkg != c.packageName && pkg !in calls && pkg != "android" && pkg != "com.android.systemui"
    }

    fun note(c: Context, key: String) {
        val ends = focusEnds(c) ?: return
        val p = Cue.prefs(c)
        val keys = if (p.getLong("held_for", 0) == ends) p.getStringSet("held", emptySet())!! else emptySet()
        p.edit().putLong("held_for", ends).putStringSet("held", keys + key).apply()
    }

    // How many different notifications this block has held so far.
    fun count(c: Context): Int {
        val ends = focusEnds(c) ?: return 0
        val p = Cue.prefs(c)
        return if (p.getLong("held_for", 0) == ends) p.getStringSet("held", emptySet())!!.size else 0
    }
}
