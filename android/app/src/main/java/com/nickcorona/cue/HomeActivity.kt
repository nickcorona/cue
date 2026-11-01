package com.nickcorona.cue

import android.app.Activity
import android.content.Intent
import android.graphics.Typeface
import android.os.Build
import android.provider.Settings
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
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
    private var nowTitle: TextView? = null
    private var dayBox: LinearLayout? = null
    private var askedHome = false
    private var shownPage: String? = null
    private var shownNow: String? = null

    // Waking the phone lands here, so nothing is rebuilt unless it changed: the page only when
    // the app list or unlock count did, the Now block only when the server says something new.
    override fun onResume() {
        super.onResume()
        rules = Rules(this)
        if (!isHome() && !askedHome) {
            askedHome = true
            askToBeHome()
        }
        if (rules.locked) grayscale()
        val key = rules.allowed().sorted().joinToString() + "|" + rules.unlocksToday()
        if (key != shownPage) {
            shownPage = key
            shownNow = null
            render()
        }
        showNow(Cue.prefs(this).getString("widget", null)?.let { runCatching { JSONObject(it) }.getOrNull() })
        showDay(Day.cached(this))
        reload()
        val c = applicationContext
        thread { Day.weather(c)?.let { w -> runOnUiThread { showDay(w) } } }
    }

    // Weather, sunset, balcony sun and the next event, a few quiet lines under the date.
    private fun showDay(w: JSONObject?) {
        val box = dayBox ?: return
        val events = Cue.prefs(this).getString("widget", null)?.let { runCatching { JSONObject(it) }.getOrNull() }
            ?.optJSONArray("events")?.let { a -> (0 until a.length()).map { a.getJSONObject(it) } }.orEmpty()
        val now = System.currentTimeMillis()
        val midnight = java.time.LocalDate.now().plusDays(1).atStartOfDay(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli()
        box.removeAllViews()
        Day.lines(w, events, Day.balcony(this), now, midnight, Day.clock(this)).forEachIndexed { i, line ->
            box.addView(text(line, 14f, DIM).apply {
                setPadding(0, if (i == 0) dp(8) else dp(2), 0, dp(2))
                maxLines = 1
                ellipsize = android.text.TextUtils.TruncateAt.END
            })
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideStatusBar()
    }

    private fun reload() {
        if (Cue.key(this) == null) return
        val c = applicationContext
        thread {
            val fresh = runCatching { Api(c).get("/push", "widget") }.getOrNull() ?: return@thread
            NowSync.apply(c, fresh)
            runOnUiThread { showNow(fresh); showDay(Day.cached(c)) }
        }
    }

    // One screen, no scrolling: clock and Now at the top, tools at the bottom where the thumb is.
    private fun render() {
        val apps = launchable().associateBy { it.pkg }
        val open = { startActivity(Intent(this, MainActivity::class.java)) }
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(BG)
            setPadding(dp(28), dp(40), dp(28), dp(36))
            addView(clock("h:mm", "H:mm", 56f, FG))
            addView(clock("EEEE, MMMM d", "EEEE, d MMMM", 15f, DIM))
            dayBox = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }.also(::addView)
            gap(20)
            nowBox = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }.also(::addView)
            addView(text("+ capture", 14f, DIM) { startActivity(Intent(context, CaptureActivity::class.java)) })
            addView(View(context), LinearLayout.LayoutParams(1, 0, 1f))
            // Past five tools they go two to a row, so the list never pushes the footer off screen.
            val tools = listOf("Cue" to open) + rules.allowed().mapNotNull { apps[it] }.sortedBy { it.label.lowercase() }
                .map { a -> a.label to { launch(a.pkg) } }
            val perRow = if (tools.size > 5) 2 else 1
            tools.chunked(perRow).forEach { pair ->
                addView(LinearLayout(context).apply {
                    pair.forEach { (label, go) ->
                        addView(text(label, 24f) { go() }.apply { setPadding(0, dp(5), 0, dp(5)); maxLines = 1 },
                            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                    }
                    if (pair.size < perRow) addView(View(context), LinearLayout.LayoutParams(0, 1, 1f))
                })
            }
            gap(20)
            val n = rules.unlocksToday()
            addView(LinearLayout(context).apply {
                addView(text("unlock an app" + if (n > 0) " · $n today" else "", 14f, DIM) {
                    startActivity(Intent(context, UnlockActivity::class.java))
                }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                addView(text("rules", 14f, DIM) { startActivity(Intent(context, RulesActivity::class.java)) })
            })
        }
        setContentView(col)
    }

    private fun showNow(d: JSONObject?) {
        val box = nowBox ?: return
        val sig = d?.let { JSONObject(it.toString()).apply { remove("at") }.toString() } + Cue.key(this)
        if (sig == shownNow) return
        shownNow = sig
        box.removeAllViews()

        // A check-off in the last 15 minutes can be taken back, for a mis-tap.
        d?.optJSONObject("last_done")?.let { u ->
            box.addView(text("✓ ${u.optString("label")}  ·  Undo", 14f, DIM) {
                send(null) { it.push("check", JSONObject(u.toString()).put("undo", true).put("now", false)) }
            }.apply { maxLines = 1; ellipsize = android.text.TextUtils.TruncateAt.MIDDLE })
            box.addView(View(this), LinearLayout.LayoutParams(1, dp(8)))
        }

        val now = d?.optJSONObject("now")?.let { Ping.parse(it) }
        val open = { startActivity(Intent(this, MainActivity::class.java).putExtra("url", now?.url ?: "/")) }
        box.addView(text(now?.ctx?.ifEmpty { null } ?: "Now", 14f, DIM, open))
        val title = text(when {
            Cue.key(this) == null -> "Open Cue to sign in"
            d == null -> "…"
            now == null -> "Nothing up next"
            else -> now.title
        }, 24f, FG, open).apply { maxLines = 2; ellipsize = android.text.TextUtils.TruncateAt.END }.also(box::addView)
        nowTitle = title
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
            .filter { "task:" + it.optString("id") != now?.skip }.take(3)
        if (rows.isEmpty()) return
        box.addView(View(this), LinearLayout.LayoutParams(1, dp(12)))
        box.addView(text("Also today", 13f, DIM))
        rows.forEach { t ->
            val title = t.optString("title")
            box.addView(text("○  $title  ·  ${t.optInt("est_min")}m", 17f, FG).apply {
                setPadding(0, dp(5), 0, dp(5))
                maxLines = 1
                ellipsize = android.text.TextUtils.TruncateAt.END
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
        nowTitle?.text = when (what) { "done" -> "✓ ${p.title}"; "skip" -> "Skipped"; else -> "Starting 25 min…" }
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
                shownNow = null
                r.exceptionOrNull()?.let { Toast.makeText(c, "Couldn't do that: ${it.message?.take(60)}", Toast.LENGTH_LONG).show() }
                reload()
            }
        }
    }

    // The big clock already says the time, and the bar's notification icons are cues to go
    // check things. A swipe down still shows it for a moment.
    private fun hideStatusBar() {
        if (Build.VERSION.SDK_INT >= 30) window.insetsController?.let {
            it.hide(WindowInsets.Type.statusBars())
            it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        } else @Suppress("DEPRECATION") {
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
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
