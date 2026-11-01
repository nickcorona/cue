package com.nickcorona.cue

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

// A buzz from a blocked app is a cue to go open it, so those never reach the shade.
class Quiet : NotificationListenerService() {
    override fun onNotificationPosted(sbn: StatusBarNotification) {
        if (!Rules(this).isAllowed(sbn.packageName)) cancelNotification(sbn.key)
    }

    override fun onListenerConnected() {
        activeNotifications?.forEach(::onNotificationPosted)
    }
}
