package com.nickcorona.cue

import android.app.Activity
import android.content.Intent
import android.graphics.Typeface
import android.os.Build
import android.provider.Settings
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.os.SystemClock
import android.widget.Chronometer
import android.widget.LinearLayout
import android.widget.ProgressBar
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
    private var weatherText: TextView? = null
    private var toolsBox: LinearLayout? = null
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

    // Two quiet lines at most: the weather rides on the date line, then the one or two things
    // worth knowing soon (an event, rain, balcony sun, sunset). Nothing close, no second line.
    private fun showDay(w: JSONObject?) {
        weatherText?.text = Day.conditions(w)?.let { "  ·  $it" } ?: ""
        val box = dayBox ?: return
        val events = Cue.prefs(this).getString("widget", null)?.let { runCatching { JSONObject(it) }.getOrNull() }
            ?.optJSONArray("events")?.let { a -> (0 until a.length()).map { a.getJSONObject(it) } }.orEmpty()
        val now = System.currentTimeMillis()
        val midnight = java.time.LocalDate.now().plusDays(1).atStartOfDay(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli()
        box.removeAllViews()
        val next = Day.highlights(w, events, Day.balcony(this), now, midnight, Day.clock(this)).take(2)
        if (next.isNotEmpty()) box.addView(text(next.joinToString("  ·  "), 15f, MID).apply {
            setPadding(0, dp(6), 0, 0)
            maxLines = 1
            ellipsize = android.text.TextUtils.TruncateAt.END
        })
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
            addView(LinearLayout(context).apply {
                addView(clock("EEEE, MMMM d", "EEEE, d MMMM", 15f, DIM).also { Look.style(it, "body", 15f) })
                weatherText = text("", 15f, DIM).apply { setPadding(0, 0, 0, 0); maxLines = 1 }.also(::addView)
            })
            dayBox = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }.also(::addView)
            gap(28)
            nowBox = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }.also(::addView)
            addView(text("+ capture", 14f, DIM) { startActivity(Intent(context, CaptureActivity::class.java)) })
            addView(View(context), LinearLayout.LayoutParams(1, 0, 1f))
            // Past five tools they go two to a row, so the list never pushes the footer off screen.
            val tools = listOf("Cue" to open) + rules.allowed().mapNotNull { apps[it] }.sortedBy { it.label.lowercase() }
                .map { a -> a.label to { launch(a.pkg) } }
            val perRow = if (tools.size > 5) 2 else 1
            toolsBox = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }.also(::addView)
            tools.chunked(perRow).forEach { pair ->
                toolsBox!!.addView(LinearLayout(context).apply {
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
                addView(text("more", 14f, DIM) { startActivity(Intent(context, DrawerActivity::class.java)) }.apply { setPadding(0, dp(8), dp(28), dp(8)) })
                addView(text("unlock" + if (n > 0) " · $n today" else "", 14f, DIM) {
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
        // A change after something was already shown (a Done, the next step) eases in, so
        // finishing a thing reads as moving on rather than the screen swapping under you.
        val ease = shownNow != null || box.childCount > 0
        shownNow = sig
        box.removeAllViews()
        if (ease) {
            box.alpha = 0f
            box.translationY = dp(10).toFloat()
            box.animate().alpha(1f).translationY(0f).setDuration(240).setInterpolator(android.view.animation.DecelerateInterpolator()).start()
        }

        // A check-off in the last 15 minutes can be taken back, for a mis-tap.
        Undo.pick(this, d?.optJSONObject("last_done"))?.let { u ->
            box.addView(text("✓ ${u.optString("label")}  ·  Undo", 14f, DIM) {
                Undo.forget(this)
                send(null) { it.push("check", JSONObject(u.toString()).put("undo", true).put("now", false)) }
            }.apply { maxLines = 1; ellipsize = android.text.TextUtils.TruncateAt.MIDDLE })
            box.addView(View(this), LinearLayout.LayoutParams(1, dp(8)))
        }

        val now = d?.optJSONObject("now")?.let { Ping.parse(it) }
        val focusing = now?.ends != null && now.ends > System.currentTimeMillis()
        dayBox?.visibility = if (focusing) View.GONE else View.VISIBLE
        toolsBox?.alpha = if (focusing) 0.3f else 1f
        if (focusing) return focus(box, now!!)
        val open = { startActivity(Intent(this, MainActivity::class.java).putExtra("url", now?.url ?: "/")) }
        box.addView(label(now?.ctx?.ifEmpty { null } ?: "Now", onClick = open))
        val title = text(when {
            Cue.key(this) == null -> "Open Cue to sign in"
            d == null -> "…"
            now == null -> "Nothing up next"
            else -> now.title
        }, 26f, FG, open).apply { maxLines = 2; ellipsize = android.text.TextUtils.TruncateAt.END; setPadding(0, dp(2), 0, dp(4)) }.also(box::addView)
        nowTitle = title
        if (now != null) {
            val row = LinearLayout(this)
            fun button(label: String, color: Int, what: String) = row.addView(text(label, 17f, color) { act(what, now) }.apply {
                setPadding(0, dp(6), dp(28), dp(6))
            })
            // On a routine step, skipping that one step and putting off the whole routine are
            // different things, so they're two buttons.
            val step = now.check?.optString("kind") == "routine_step"
            if (now.check != null) button("Done", ACCENT, "done")
            if (now.start != null) button("Start 25", if (now.check == null) ACCENT else DIM, "start")
            if (step) button("Skip step", DIM, "skipstep")
            if (now.skip != null) button(if (step) "Later" else "Not now", DIM, "skip")
            if (row.childCount > 0) box.addView(row)
        }

        // A routine put off with Later stays in sight until it's resumed or the day ends.
        d?.optJSONArray("paused")?.let { a ->
            for (i in 0 until a.length()) {
                val r = a.getJSONObject(i)
                val id = r.optString("id")
                val row = text("${r.optString("name")} paused · ${r.optInt("done")}/${r.optInt("total")} · resume", 15f, DIM)
                row.setPadding(0, dp(6), 0, dp(6))
                row.setOnClickListener {
                    // Gone at once, from the screen and the saved copy, so a slow reply can't
                    // leave it showing.
                    row.visibility = View.GONE
                    val saved = Cue.prefs(this).getString("widget", null)?.let { w -> runCatching { JSONObject(w) }.getOrNull() }
                    saved?.optJSONArray("paused")?.let { p -> (p.length() - 1 downTo 0).filter { p.getJSONObject(it).optString("id") == id }.forEach(p::remove) }
                    saved?.let { w -> Cue.prefs(this).edit().putString("widget", w.toString()).apply() }
                    send(Ping.parse(JSONObject().put("tag", Cue.NOW_TAG))) { api -> api.push("now_unskip", JSONObject().put("routine_id", id)) }
                }
                box.addView(row)
            }
        }

        // What's left of today; the Now item is usually its first task, so it isn't repeated.
        val today = d?.optJSONArray("today")
        val rows = (0 until (today?.length() ?: 0)).mapNotNull { today?.optJSONObject(it) }
            .filter { "task:" + it.optString("id") != now?.skip }.take(3)
        if (rows.isEmpty()) return
        box.addView(label("Also today"))
        rows.forEach { t ->
            val title = t.optString("title")
            box.addView(text("○  $title  ·  ${t.optInt("est_min")}m", 17f, MID).apply {
                setPadding(0, dp(5), 0, dp(5))
                maxLines = 1
                ellipsize = android.text.TextUtils.TruncateAt.END
                setOnClickListener { v ->
                    v.isEnabled = false
                    (v as TextView).text = "✓  $title"
                    v.setTextColor(DIM)
                    val check = JSONObject().put("kind", "task").put("id", t.optString("id"))
                    Undo.remember(this@HomeActivity, check, title)
                    send(null) { it.push("check", JSONObject(check.toString()).put("now", false)) }
                }
            })
        }
    }

    // A running focus block takes over the top of Home: the task, a live countdown and Done.
    // The day lines and the rest of today step aside and the tools dim, still there for
    // whatever the task needs.
    private fun focus(box: LinearLayout, p: Ping) {
        box.addView(View(this), LinearLayout.LayoutParams(1, dp(12)))
        box.addView(label("Focus", ACCENT))
        box.addView(text(p.title, 30f, FG) { startActivity(Intent(this, MainActivity::class.java).putExtra("url", p.url)) }
            .apply { maxLines = 3; ellipsize = android.text.TextUtils.TruncateAt.END })
        val total = p.prog?.second
        val bar = total?.let {
            ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
                max = it * 60
                progressTintList = android.content.res.ColorStateList.valueOf(FOCUS)
                progressBackgroundTintList = android.content.res.ColorStateList.valueOf(FAINT)
            }
        }
        box.addView(Chronometer(this).apply {
            isCountDown = true
            base = SystemClock.elapsedRealtime() + (p.ends!! - System.currentTimeMillis())
            textSize = 64f
            setTextColor(FG)
            Look.style(this, "display", textSize)
            setOnChronometerTickListener {
                val left = ((base - SystemClock.elapsedRealtime()) / 1000).toInt()
                bar?.let { b -> b.progress = b.max - left.coerceAtLeast(0) }
                if (left <= 0) { stop(); shownNow = null; reload() }
            }
            start()
        })
        bar?.let { box.addView(it, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(4)).apply { topMargin = dp(4); bottomMargin = dp(8) }) }
        box.addView(LinearLayout(this).apply {
            if (p.check != null) addView(text("Done", 20f, ACCENT) { act("done", p) }.apply { setPadding(0, dp(8), dp(32), dp(8)) })
            // Stop: a mis-tapped Start (under 2 min) leaves no trace; later it keeps the time.
            if (p.check?.optString("kind") == "focus") addView(text("Stop", 20f, DIM) { act("stop", p) }.apply { setPadding(0, dp(8), 0, dp(8)) })
        })
        // Notifications are held during the block (Hold); say how many, never what.
        box.addView(text(Hold.count(this).let { if (it == 0) "Notifications held until the block ends" else "$it held until the block ends" }, 14f, DIM))
        nowTitle = null
    }

    // The same calls as the notification's buttons; the next item replaces the Now notification
    // and the widget too, so they all stay in step.
    private fun act(what: String, p: Ping) {
        val shown = when (what) { "done" -> "✓ ${p.title}"; "skip" -> "Later"; "skipstep" -> "Skipped ${p.title}"; "stop" -> "Stopped"; else -> "Starting 25 min…" }
        nowTitle?.text = shown
        // Leaving a focus block shows at once: the countdown goes, the day and tools come back.
        if (p.ends != null) nowBox?.let { box ->
            box.removeAllViews()
            box.addView(label("Focus"))
            box.addView(text(shown, 26f, DIM))
            dayBox?.visibility = View.VISIBLE
            toolsBox?.alpha = 1f
            Cue.saveNow(this, null)
        }
        if (what == "done") Undo.remember(this, p.check, p.title)
        send(p) { api ->
            when (what) {
                "done" -> api.push("check", JSONObject(p.check.toString()).put("now", p.isNow))
                "start" -> api.push("now_focus", p.start!!)
                "skipstep" -> api.push("check", JSONObject(p.check.toString()).put("skip", true).put("now", p.isNow))
                "stop" -> api.push("focus_end", JSONObject().put("id", p.check!!.optString("id")))
                else -> api.push("now_skip", JSONObject().put("key", p.skip))
            }
        }
    }

    private fun send(p: Ping?, call: (Api) -> JSONObject) {
        val c = applicationContext
        thread {
            val r = runCatching { call(Api(c)) }
            val out = r.getOrNull()
            out?.takeIf { p?.isNow == true }?.let {
                val next = it.optJSONObject("next")
                if (next == null) Notifier.cancelNow(c) else Notifier.show(c, Ping.parse(next), quiet = true)
            }
            // The reply already carries the next Now item, so draw it straight away; the full
            // refresh (today's list, undo) follows, and the widget after that.
            runOnUiThread {
                shownNow = null
                r.exceptionOrNull()?.let { Toast.makeText(c, "Couldn't do that: ${it.message?.take(60)}", Toast.LENGTH_LONG).show() }
                val full = out?.optJSONObject("widget")
                if (full != null) {
                    NowSync.apply(c, full)
                    showNow(full)
                } else if (out != null && out.has("next")) {
                    val cached = Cue.prefs(c).getString("widget", null)?.let { runCatching { JSONObject(it) }.getOrNull() } ?: JSONObject()
                    showNow(cached.put("now", out.opt("next")))
                    shownNow = null
                }
                reload()
            }
            NowWidget.refresh(c, out?.optJSONObject("next"))
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
        Look.style(this, "display", textSize)
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
