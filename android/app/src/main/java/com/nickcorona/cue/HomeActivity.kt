package com.nickcorona.cue

import android.app.Activity
import android.content.Intent
import android.graphics.Typeface
import android.provider.Settings
import android.widget.TextClock
import android.widget.TextView
import org.json.JSONObject
import kotlin.concurrent.thread

// Dumbphone mode's home screen: clock, the one thing Cue says to do now, and a short list of
// tools in plain text. No icons, no badges, nothing to scroll.
class HomeActivity : Activity() {
    private lateinit var rules: Rules
    private var nowCtx: TextView? = null
    private var nowTitle: TextView? = null

    override fun onResume() {
        super.onResume()
        rules = Rules(this)
        if (rules.locked) grayscale()
        render()
        showNow(Cue.prefs(this).getString("widget", null)?.let { runCatching { JSONObject(it) }.getOrNull() })
        if (Cue.key(this) != null) thread {
            val fresh = runCatching { Api(this).get("/push", "widget") }.getOrNull() ?: return@thread
            Cue.prefs(this).edit().putString("widget", fresh.toString()).apply()
            runOnUiThread { showNow(fresh) }
        }
    }

    private fun render() {
        val apps = launchable().associateBy { it.pkg }
        val open = { startActivity(Intent(this, MainActivity::class.java)) }
        page {
            addView(clock("h:mm", "H:mm", 64f, FG))
            addView(clock("EEEE, MMMM d", "EEEE, d MMMM", 16f, DIM))
            gap(36)
            nowCtx = text("Now", 14f, DIM, open).also(::addView)
            nowTitle = text("", 24f, FG, open).also(::addView)
            addView(text("+ capture", 14f, DIM) { startActivity(Intent(context, CaptureActivity::class.java)) })
            gap(28)
            addView(text("Cue", 30f, onClick = open))
            rules.allowed().mapNotNull { apps[it] }.sortedBy { it.label.lowercase() }
                .forEach { a -> addView(text(a.label, 30f) { launch(a.pkg) }) }
            gap(48)
            val n = rules.unlocksToday()
            addView(text("unlock an app" + if (n > 0) " · $n today" else "", 15f, DIM) {
                startActivity(Intent(context, UnlockActivity::class.java))
            })
            addView(text("rules", 15f, DIM) { startActivity(Intent(context, RulesActivity::class.java)) })
        }
    }

    private fun showNow(d: JSONObject?) {
        val now = d?.optJSONObject("now")?.let { Ping.parse(it) }
        nowCtx?.text = now?.ctx?.ifEmpty { null } ?: "Now"
        nowTitle?.text = when {
            Cue.key(this) == null -> "Open Cue to sign in"
            d == null -> "…"
            now == null -> "Nothing up next"
            else -> now.title
        }
    }

    private fun clock(f12: String, f24: String, size: Float, color: Int) = TextClock(this).apply {
        format12Hour = f12
        format24Hour = f24
        textSize = size
        setTextColor(color)
        typeface = Typeface.create("sans-serif-thin", Typeface.NORMAL)
    }

    // Needs `adb shell pm grant com.nickcorona.cue android.permission.WRITE_SECURE_SETTINGS` once.
    private fun grayscale() {
        try {
            Settings.Secure.putInt(contentResolver, "accessibility_display_daltonizer_enabled", 1)
            Settings.Secure.putInt(contentResolver, "accessibility_display_daltonizer", 0)
        } catch (_: SecurityException) {
        }
    }
}
