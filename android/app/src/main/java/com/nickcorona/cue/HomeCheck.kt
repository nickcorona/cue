package com.nickcorona.cue

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Settings

// Is Cue Home still the home screen, and is the guard still on? An update can quietly hand the
// home screen back to the stock launcher or stop the guard, and the guard can't report its own
// absence. So this runs right after an update and on every push from the server (many a day),
// and says so in a notification that fixes it in one tap.
class HomeCheck : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) {
        Diag.log(c, if (i.action == Intent.ACTION_BOOT_COMPLETED) "phone restarted" else "updated to ${BuildConfig.VERSION_NAME}")
        run(c)
    }

    companion object {
        fun run(c: Context) {
            if (!Rules(c).guardOn()) return
            val home = c.isHome()
            val guard = guardEnabled(c)
            if (!home) Notifier.homeLost(c) else Notifier.homeBack(c)
            if (!guard) Notifier.guardLost(c) else Notifier.guardBack(c)
            // Only changes go in the log.
            val p = Cue.prefs(c)
            val was = p.getString("diag_state", null)
            val now = "home=$home guard=$guard"
            if (now != was) { Diag.log(c, now); p.edit().putString("diag_state", now).apply() }
        }

        fun guardEnabled(c: Context) =
            Settings.Secure.getString(c.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)?.contains("${c.packageName}/") == true
    }
}
