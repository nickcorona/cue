package com.nickcorona.cue

import android.accessibilityservice.AccessibilityService
import android.content.Intent
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

    // Real launchers only: Settings ships a FallbackHome (shown while booting) that also answers
    // the home intent, and treating Settings as a launcher would bounce every settings page.
    private val otherHomes by lazy {
        packageManager.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME), 0)
            .filterNot { it.activityInfo.name.endsWith("FallbackHome") }
            .map { it.activityInfo.packageName }.toSet() - packageName - Rules.PROTECTED
    }

    override fun onServiceConnected() {
        rules = Rules(this)
    }

    override fun onAccessibilityEvent(e: AccessibilityEvent) {
        val pkg = e.packageName?.toString() ?: return
        when (e.eventType) {
            // The stock launcher also draws Recents under gesture navigation, so only its home
            // screen is sent back to Cue Home. It shows up when Cue is mid-update or not yet default.
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> if (pkg in otherHomes) {
                if (rules.guardOn() && e.className?.contains("Recents") != true) home(null)
            } else {
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

    // Cue Home by name rather than the Home button, which lands on whatever launcher is default.
    private fun home(msg: String?) {
        startActivity(Intent(this, HomeActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        msg?.let { Toast.makeText(this, it, Toast.LENGTH_LONG).show() }
    }

    override fun onInterrupt() {}
}
