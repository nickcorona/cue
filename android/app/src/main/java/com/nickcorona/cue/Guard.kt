package com.nickcorona.cue

import android.accessibilityservice.AccessibilityService
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import android.widget.Toast

// Sends him Home whenever an app off the list comes to the front. While locked it also leaves
// any Settings, permission or installer screen that names Cue, since that's where the guard
// would be switched off, force-stopped, uninstalled or replaced as the home app.
class Guard : AccessibilityService() {
    private lateinit var rules: Rules
    private val handler = Handler(Looper.getMainLooper())
    private var current = ""

    override fun onServiceConnected() {
        rules = Rules(this)
    }

    override fun onAccessibilityEvent(e: AccessibilityEvent) {
        val pkg = e.packageName?.toString() ?: return
        when (e.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
                // The keyboard and the shade come and go over an app without replacing it.
                if (pkg == packageName || pkg !in rules.always()) current = pkg
                check(pkg)
            }
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> if (pkg in Rules.PROTECTED) check(pkg)
        }
    }

    private fun check(pkg: String) {
        if (!rules.guardOn()) return
        if (pkg in Rules.PROTECTED) {
            if (rules.locked && namesCue()) home("Cue is locked. Turning it off takes 24h, from Home → rules.")
            return
        }
        if (rules.isAllowed(pkg)) {
            val left = rules.unlockedUntil(pkg) - System.currentTimeMillis()
            if (left > 0 && pkg !in rules.allowed()) handler.postDelayed({
                if (current == pkg || rootInActiveWindow?.packageName == pkg) check(pkg)
            }, left + 500)
            return
        }
        home(null)
    }

    // findAccessibilityNodeInfosByText matches substrings ("Rescue"), so check the whole label.
    private fun namesCue() = rootInActiveWindow?.findAccessibilityNodeInfosByText("Cue").orEmpty().any { n ->
        val t = n.text?.toString()?.trim() ?: return@any false
        t == "Cue" || t.startsWith("Cue ")
    }

    private fun home(msg: String?) {
        performGlobalAction(GLOBAL_ACTION_HOME)
        msg?.let { Toast.makeText(this, it, Toast.LENGTH_LONG).show() }
    }

    override fun onInterrupt() {}
}
