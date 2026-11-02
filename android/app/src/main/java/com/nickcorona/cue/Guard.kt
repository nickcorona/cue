package com.nickcorona.cue

import android.accessibilityservice.AccessibilityService
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityWindowInfo
import android.widget.Toast

// Sends him Home whenever an app off the list comes to the front. While locked it also leaves
// any Settings, permission or installer screen that names Cue, since that's where the guard
// would be switched off, force-stopped, uninstalled or replaced as the home app.
class Guard : AccessibilityService() {
    private lateinit var rules: Rules
    private val handler = Handler(Looper.getMainLooper())
    private var current = ""
    private var asked = "" to 0L

    // Real launchers only: Settings ships a FallbackHome (shown while booting) that also answers
    // the home intent, and treating Settings as a launcher would bounce every settings page.
    private val otherHomes by lazy {
        packageManager.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME), 0)
            .filterNot { it.activityInfo.name.endsWith("FallbackHome") }
            .map { it.activityInfo.packageName }.toSet() - packageName - Rules.PROTECTED
    }

    // Unlocking can land on the stock launcher with no window change for the guard to see, so
    // it looks as soon as the phone is unlocked, and asks to be put back if it lost the role.
    private val unlocked = object : BroadcastReceiver() {
        override fun onReceive(c: Context, i: Intent) {
            if (!rules.guardOn()) return
            if (!isHome()) { Notifier.homeLost(this@Guard); Diag.log(this@Guard, "unlocked: Cue isn't the home app") }
            val fg = windows.firstOrNull { it.type == AccessibilityWindowInfo.TYPE_APPLICATION && it.isFocused }?.root?.packageName?.toString()
            if (fg in otherHomes) home(null)
        }
    }

    override fun onServiceConnected() {
        rules = Rules(this)
        Diag.log(this, "guard started")
        val f = IntentFilter(Intent.ACTION_USER_PRESENT)
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(unlocked, f, Context.RECEIVER_NOT_EXPORTED) else registerReceiver(unlocked, f)
    }

    override fun onDestroy() {
        Diag.log(this, "guard stopped")
        runCatching { unregisterReceiver(unlocked) }
        super.onDestroy()
    }

    override fun onAccessibilityEvent(e: AccessibilityEvent) {
        // Switching from Recents or with the bottom-bar swipe can bring an app back without a
        // window-state event, so also look at whichever app window is focused now.
        if (e.eventType == AccessibilityEvent.TYPE_WINDOWS_CHANGED) {
            val fg = windows.firstOrNull { it.type == AccessibilityWindowInfo.TYPE_APPLICATION && it.isFocused }
                ?.root?.packageName?.toString() ?: return
            if (fg == current || fg in otherHomes) return
            if (fg == packageName || fg !in rules.always()) current = fg
            return check(fg, launched = null)
        }
        val pkg = e.packageName?.toString() ?: return
        when (e.eventType) {
            // The stock launcher also draws Recents under gesture navigation, so only its home
            // screen is sent back to Cue Home. It shows up when Cue is mid-update or not yet default.
            // Recents is never an app he's opening, whoever draws it.
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> if (pkg in otherHomes || e.className?.contains("Recents") == true) {
                if (rules.guardOn() && e.className?.contains("Recents") != true) {
                    Diag.log(this, "stock launcher shown (${e.className}), Cue is home app: ${isHome()}")
                    if (!isHome()) Notifier.homeLost(this)
                    home(null)
                }
            } else {
                // The keyboard and the shade come and go over an app without replacing it.
                if (pkg == packageName || pkg !in rules.always()) current = pkg
                check(pkg, launched = e.className?.toString())
            }
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> if (pkg in Rules.PROTECTED) check(pkg)
        }
    }

    // launched: the activity that just started, or null when this came from a window shuffle
    // (Recents, the home swipe), where the app in front can still be the one being left. Only
    // a real launch asks for an unlock; a shuffle onto a Gated app just goes Home.
    private fun check(pkg: String, launched: String? = "") {
        if (!rules.guardOn()) return
        if (pkg in Rules.PROTECTED) {
            if (rules.locked && namesCue() && !GrantActivity.granting(this)) home("Cue is locked. Turning it off takes 24h, from Home → rules.")
            return
        }
        if (rules.isAllowed(pkg)) {
            val left = rules.unlockedUntil(pkg) - System.currentTimeMillis()
            if (left > 0 && pkg !in rules.allowed()) handler.postDelayed({
                if (current == pkg || rootInActiveWindow?.packageName == pkg) check(pkg)
            }, left + 500)
            return
        }
        when {
            rules.level(pkg) == Rules.OFF -> home("That app is off. Change it in rules.")
            rules.expired(pkg) -> home("Time's up on ${label(pkg)}.")
            launched == null -> home(null)
            else -> {
                // Opened some other way (a link, a notification): straight to its unlock.
                // Window events come in bursts, so one ask per app every few seconds.
                val now = System.currentTimeMillis()
                if (asked.first == pkg && now - asked.second < 5000) return
                asked = pkg to now
                Diag.log(this, "unlock asked: $pkg ($launched)")
                UnlockActivity.ask(this, pkg)
            }
        }
    }

    private fun label(pkg: String) = runCatching { packageManager.getApplicationLabel(packageManager.getApplicationInfo(pkg, 0)).toString() }.getOrDefault("that app")

    // findAccessibilityNodeInfosByText matches substrings ("Rescue"), so check the whole label.
    private fun namesCue() = rootInActiveWindow?.findAccessibilityNodeInfosByText("Cue").orEmpty().any { n ->
        val t = n.text?.toString()?.trim() ?: return@any false
        t == "Cue" || t.startsWith("Cue ")
    }

    // Cue Home by name rather than the Home button, which lands on whatever launcher is default.
    private fun home(msg: String?) {
        goHome()
        msg?.let { Toast.makeText(this, it, Toast.LENGTH_LONG).show() }
    }

    override fun onInterrupt() {}
}
