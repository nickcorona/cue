package com.nickcorona.cue

import android.app.Activity
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Bundle

// When Cue itself sends him to a settings page (to grant Usage access, notification access or
// the guard), the guard would throw him straight back out, since the page names Cue. Going
// through here opens a 3-minute window where it doesn't. Only Cue's own links do this.
class GrantActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Cue.prefs(this).edit().putLong("grant_until", System.currentTimeMillis() + WINDOW).apply()
        @Suppress("DEPRECATION")
        intent.getParcelableExtra<Intent>("go")?.let { runCatching { startActivity(it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } }
        finish()
    }

    companion object {
        const val WINDOW = 3 * 60_000L

        fun granting(c: Context, now: Long = System.currentTimeMillis()) = Cue.prefs(c).getLong("grant_until", 0) > now

        fun pending(c: Context, req: Int, target: Intent): PendingIntent = PendingIntent.getActivity(c, req,
            Intent(c, GrantActivity::class.java).putExtra("go", target).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
}
