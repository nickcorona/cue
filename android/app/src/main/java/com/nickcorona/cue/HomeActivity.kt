package com.nickcorona.cue

import android.app.Activity
import android.content.Intent
import android.graphics.Typeface
import android.provider.Settings
import android.view.View
import android.widget.LinearLayout
import android.widget.TextClock
import android.widget.TextView
import android.widget.Toast
import org.json.JSONObject
import kotlin.concurrent.thread

// Dumbphone mode's home screen: clock, the one thing Cue says to do now (with Done, Start and
// Not now) and what's left of today, then a short list of tools in plain text. No icons, no badges.
class HomeActivity : Activity() {
    private lateinit var rules: Rules
    private var nowBox: LinearLayout? = null
    private var askedHome = false

    override fun onResume() {
        super.onResume()
        rules = Rules(this)
        if (!isHome() && !askedHome) {
            askedHome = true
            askToBeHome()
        }
        if (rules.locked) grayscale()
        render()
        showNow(Cue.prefs(this).getString("widget", null)?.let { runCatching { JSONObject(it) }.getOrNull() })
        reload()
    }

    private fun reload() {
        if (Cue.key(this) == null) return
        thread {
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
            nowBox = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }.also(::addView)
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
        val box = nowBox ?: return
        box.removeAllViews()
        val now = d?.optJSONObject("now")?.let { Ping.parse(it) }
        val open = { startActivity(Intent(this, MainActivity::class.java).putExtra("url", now?.url ?: "/")) }
        box.addView(text(now?.ctx?.ifEmpty { null } ?: "Now", 14f, DIM, open))
        box.addView(text(when {
            Cue.key(this) == null -> "Open Cue to sign in"
            d == null -> "…"
            now == null -> "Nothing up next"
            else -> now.title
        }, 24f, FG, open))
        if (now != null) {
            val row = LinearLayout(this)
            fun button(label: String, color: Int, what: String) = row.addView(text(label, 17f, color) { act(what, now) }.apply {
                setPadding(0, dp(6), dp(28), dp(6))
            })
            if (now.check != null) button("Done", FG, "done")
            if (now.start != null) button("Start 25", if (now.check == null) FG else DIM, "start")
            if (now.skip != null) button("Not now", DIM, "skip")
            if (row.childCount > 0) box.addView(row)
        }

        // What's left of today; the Now item is usually its first task, so it isn't repeated.
        val today = d?.optJSONArray("today")
        val rows = (0 until (today?.length() ?: 0)).mapNotNull { today?.optJSONObject(it) }
            .filter { "task:" + it.optString("id") != now?.skip }
        if (rows.isEmpty()) return
        box.addView(View(this), LinearLayout.LayoutParams(1, dp(12)))
        box.addView(text("Also today", 13f, DIM))
        rows.forEach { t ->
            val title = t.optString("title")
            box.addView(text("○  $title  ·  ${t.optInt("est_min")}m", 17f, FG).apply {
                setPadding(0, dp(6), 0, dp(6))
                setOnClickListener { v ->
                    v.isEnabled = false
                    (v as TextView).text = "✓  $title"
                    v.setTextColor(DIM)
                    send(null) { it.push("check", JSONObject().put("kind", "task").put("id", t.optString("id")).put("now", false)) }
                }
            })
        }
    }

    // The same calls as the notification's buttons; the next item replaces the Now notification
    // and the widget too, so they all stay in step.
    private fun act(what: String, p: Ping) {
        val box = nowBox ?: return
        (box.getChildAt(1) as? TextView)?.text = when (what) { "done" -> "✓ ${p.title}"; "skip" -> "Skipped"; else -> "Starting 25 min…" }
        send(p) { api ->
            when (what) {
                "done" -> api.push("check", JSONObject(p.check.toString()).put("now", p.isNow))
                "start" -> api.push("now_focus", p.start!!)
                else -> api.push("now_skip", JSONObject().put("key", p.skip))
            }
        }
    }

    private fun send(p: Ping?, call: (Api) -> JSONObject) {
        val c = applicationContext
        thread {
            val r = runCatching { call(Api(c)) }
            r.getOrNull()?.takeIf { p?.isNow == true }?.let { out ->
                val next = out.optJSONObject("next")
                if (next == null) Notifier.cancelNow(c) else Notifier.show(c, Ping.parse(next), quiet = true)
            }
            NowWidget.refresh(c, r.getOrNull()?.optJSONObject("next"))
            runOnUiThread {
                r.exceptionOrNull()?.let { Toast.makeText(c, "Couldn't do that: ${it.message?.take(60)}", Toast.LENGTH_LONG).show() }
                reload()
            }
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
