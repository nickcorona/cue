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
import android.widget.ScrollView
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
    private var clocksBox: LinearLayout? = null
    private var music: Music? = null
    private var weatherText: TextView? = null
    private var toolsBox: LinearLayout? = null
    private var bigClock: TextClock? = null
    private var dateClock: TextClock? = null
    private var askedHome = false
    private var shownPage: String? = null
    private var shownNow: String? = null
    // Bumped by every tap that changes Cue (Done, Start, Undo...). A refresh that started before
    // one, or lands while one is in flight, carries the old state and would flip Now back.
    private var taps = 0
    private var inFlight = 0
    private var shownKey: String? = null

    // Waking the phone lands here, so nothing is rebuilt unless it changed: the page only when
    // the app list or unlock count did, the Now block only when the server says something new.
    override fun onResume() {
        super.onResume()
        val t0 = android.os.SystemClock.uptimeMillis()
        rules = Rules(this)
        if (isHome()) Notifier.homeBack(this)
        // Ask once on its own; always when opened from the "isn't your home screen" notification.
        val fix = intent.getBooleanExtra("fix_home", false)
        if (!isHome() && (fix || !askedHome)) {
            askedHome = true
            intent.removeExtra("fix_home")
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
        music?.start()
        // A stopwatch or timer running in the Clock app, live above Now.
        Clocks.onChange = { runOnUiThread { clocksBox?.let { Clocks.show(this, it) } } }
        clocksBox?.let { Clocks.show(this, it) }
        reload()
        // A fresh fix for home vs out; Now refreshes once it arrives.
        if (Where.home(this) != null) Where.refresh(this) { if (it != null) reload() }
        val c = applicationContext
        thread { Day.weather(c)?.let { w -> runOnUiThread { showDay(w) } } }
        // Slow wakes go in the phone log: how long this took, and on a fresh start (Android had
        // closed Cue) how long since the process began.
        val took = android.os.SystemClock.uptimeMillis() - t0
        val sinceStart = android.os.SystemClock.uptimeMillis() - android.os.Process.getStartUptimeMillis()
        // A fresh start only if Home came up with the process (the guard can start it long before).
        val fresh = if (!resumedOnce && sinceStart < 15_000) sinceStart else null
        resumedOnce = true
        if (took > 300 || (fresh ?: 0) > 1000) Diag.log(this, "slow home: ${took} ms" + (fresh?.let { ", fresh start ${it} ms" } ?: ""))
    }

    private var resumedOnce = false

    // Quiet lines: the weather rides on the date line, then the one or two things worth knowing
    // soon (an event, rain, balcony sun, sunset), then the body line from the scale.
    private fun showDay(w: JSONObject?) {
        weatherText?.text = Day.conditions(w)?.let { "  ·  $it" } ?: ""
        val box = dayBox ?: return
        val widget = Cue.prefs(this).getString("widget", null)?.let { runCatching { JSONObject(it) }.getOrNull() }
        val events = widget?.optJSONArray("events")?.let { a -> (0 until a.length()).map { a.getJSONObject(it) } }.orEmpty()
        val now = System.currentTimeMillis()
        val midnight = java.time.LocalDate.now().plusDays(1).atStartOfDay(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli()
        box.removeAllViews()
        // The next event gets its own line (wrapping to two for a long title) and opens the
        // calendar; the rest share one line under it.
        val event = Day.eventLine(events, now, Day.clock(this))
        val next = Day.highlights(w, Day.balcony(this), now, midnight, Day.clock(this)).take(if (event == null) 2 else 1)
        val calendar = { runCatching { startActivity(Intent.makeMainSelectorActivity(Intent.ACTION_MAIN, Intent.CATEGORY_APP_CALENDAR).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }; Unit }
        event?.let { e ->
            // The time stays readable; the event's name is quieter, under the task in weight.
            val cut = e.indexOf("  ").takeIf { it > 0 } ?: 0
            val styled = android.text.SpannableString(e).apply {
                setSpan(android.text.style.ForegroundColorSpan(MID), 0, cut, 0)
                setSpan(android.text.style.ForegroundColorSpan(DIM), cut, e.length, 0)
            }
            box.addView(text("", 14f, DIM, calendar).apply {
                text = styled
                setPadding(0, dp(6), 0, 0)
                maxLines = 2
                ellipsize = android.text.TextUtils.TruncateAt.END
            })
        }
        if (next.isNotEmpty()) box.addView(text(next.joinToString("  ·  "), 14f, DIM).apply {
            setPadding(0, dp(if (event == null) 6 else 2), 0, 0)
            maxLines = 1
            ellipsize = android.text.TextUtils.TruncateAt.END
        })
        // The cut at a glance, from the scale repo: trend weight (not the day's weigh-in), the
        // week's move, against plan. One quiet line, no colour either way.
        widget?.optString("body")?.takeIf { it.isNotEmpty() && it != "null" }?.let { b ->
            box.addView(text(b, 14f, DIM).apply {
                setPadding(0, dp(2), 0, 0)
                maxLines = 1
                ellipsize = android.text.TextUtils.TruncateAt.END
            })
        }
    }

    override fun onPause() {
        music?.stop()
        Clocks.onChange = null
        super.onPause()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION") super.onActivityResult(requestCode, resultCode, data)
        homeAnswer(requestCode)
    }

    private fun reload() {
        if (Cue.key(this) == null) return
        val c = applicationContext
        val asOf = taps
        thread {
            // Ready before "more" is tapped.
            c.launchable()
            Capture.flush(c)
            HomeCheck.run(c)
            Diag.flush(c)
            Usage.sync(c)
            val fresh = runCatching { Api(c).widget(c) }.getOrNull() ?: return@thread
            runOnUiThread {
                if (asOf != taps || inFlight > 0) return@runOnUiThread
                NowSync.apply(c, fresh)
                showNow(fresh)
                showDay(Day.cached(c))
            }
        }
    }

    // One screen: clock and Now at the top, tools at the bottom where the thumb is. Only the
    // middle scrolls, and only when it's too long to fit.
    private fun render() {
        // Only the home screen's apps, not all 150 installed: looking every label up made waking slow.
        val apps = rules.allowed().mapNotNull { pkg ->
            if (packageManager.getLaunchIntentForPackage(pkg) == null) null
            else runCatching { App(packageManager.getApplicationLabel(packageManager.getApplicationInfo(pkg, 0)).toString(), pkg) }.getOrNull()
        }.associateBy { it.pkg }
        val openCue = { open(MainActivity::class.java) }
        val col = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(BG)
            setPadding(dp(28), dp(40), dp(28), dp(36))
            bigClock = clock("h:mm", "H:mm", 56f, FG).also(::addView)
            addView(LinearLayout(context).apply {
                dateClock = clock("EEEE, MMMM d", "EEEE, d MMMM", 15f, DIM).also { Look.style(it, "body", 15f) }.also(::addView)
                weatherText = text("", 15f, DIM).apply { setPadding(0, 0, 0, 0); maxLines = 1 }.also(::addView)
            })
            // The middle (events, Now, Also today) gets whatever room is left and scrolls if it
            // runs long (a done habit's mood row, paused routines), so the tools and the footer
            // under it are never pushed off the bottom.
            addView(ScrollView(context).apply {
                isVerticalScrollBarEnabled = false
                overScrollMode = View.OVER_SCROLL_NEVER
                addView(LinearLayout(context).apply {
                    orientation = LinearLayout.VERTICAL
                    dayBox = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }.also(::addView)
                    gap(18)
                    clocksBox = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }.also(::addView)
                    nowBox = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }.also(::addView)
                    addView(text("+ capture", 14f, DIM) { open(CaptureActivity::class.java) })
                    gap(8)
                })
            }, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
            music?.stop()
            music = Music(context, LinearLayout(context).apply {
                gravity = android.view.Gravity.CENTER_VERTICAL
                visibility = View.GONE
            }.also { addView(it, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { bottomMargin = dp(8) }) })
            // Past five tools they go two to a row, so the list never pushes the footer off screen.
            val tools = listOf("Cue" to openCue) + rules.allowed().mapNotNull { apps[it] }.sortedBy { it.label.lowercase() }
                .map { a -> a.label to { launch(a.pkg) } }
            val perRow = if (tools.size > 5) 2 else 1
            toolsBox = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }.also(::addView)
            tools.chunked(perRow).forEach { pair ->
                toolsBox!!.addView(LinearLayout(context).apply {
                    pair.forEach { (label, go) ->
                        addView(text(label, 17f, DIM) { go() }.apply { setPadding(0, dp(7), 0, dp(7)); maxLines = 1 },
                            LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                    }
                    if (pair.size < perRow) addView(View(context), LinearLayout.LayoutParams(0, 1, 1f))
                })
            }
            gap(20)
            val n = rules.unlocksToday()
            addView(LinearLayout(context).apply {
                addView(text("more", 14f, DIM) { open(DrawerActivity::class.java) { addFlags(Intent.FLAG_ACTIVITY_CLEAR_TASK) } }.apply { setPadding(0, dp(8), dp(28), dp(8)) })
                addView(text("unlock" + if (n > 0) " · $n today" else "", 14f, DIM) {
                    open(UnlockActivity::class.java) { addFlags(Intent.FLAG_ACTIVITY_CLEAR_TASK) }
                }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                addView(text("rules", 14f, DIM) { open(RulesActivity::class.java) })
            })
        }
        setContentView(col)
    }

    private fun showNow(d: JSONObject?) {
        val box = nowBox ?: return
        val live = buildSet {
            d?.optJSONObject("now")?.optJSONObject("check")?.let { add(Undo.key(it)) }
            d?.optJSONArray("today")?.let { a -> for (i in 0 until a.length()) add("task:${a.getJSONObject(i).optString("id")}:") }
        }
        val undo = Undo.pick(this, d?.optJSONObject("last_done"), open = live)
        // The server asks once per check-off (mood_ask); a tap here is remembered until it agrees.
        val asked = d?.optJSONObject("last_done")?.let { l -> l.optJSONObject("mood_ask")?.let { it to "${it.optString("id")}@${l.optString("at")}" } }
            ?.takeIf { (a, k) -> undo?.optString("id") == a.optString("id") && Cue.prefs(this).getString("mood_said", null) != k }
        // Redraw only for what's on screen: the prediction, the reply and the refresh after a
        // Done usually agree, and redrawing each time made the next task flicker in three times.
        val nowJ = d?.optJSONObject("now")
        val sig = listOf(
            Cue.key(this) != null, d != null,
            nowJ?.let { n -> listOf("title", "ctx", "body", "check", "start", "skip", "ends", "url").joinToString("|") { n.opt(it)?.toString() ?: "" } },
            d?.optJSONArray("today")?.toString(), d?.optJSONArray("paused")?.toString(), undo?.let { Undo.key(it) + it.optString("label") }, asked?.second,
        ).joinToString("§")
        if (sig == shownNow) return
        // Easing in only when Now is a different item, so finishing a thing reads as moving on,
        // and a refresh that keeps the same item doesn't replay it.
        val key = nowJ?.optString("now_key")?.ifEmpty { null } ?: nowJ?.optString("title")
        val ease = shownKey != null && key != shownKey
        shownKey = key
        shownNow = sig
        box.removeAllViews()
        if (ease) {
            box.alpha = 0f
            box.translationY = dp(10).toFloat()
            box.animate().alpha(1f).translationY(0f).setDuration(240).setInterpolator(android.view.animation.DecelerateInterpolator()).start()
        }

        // A check-off in the last 15 minutes can be taken back, for a mis-tap.
        undo?.let { u ->
            box.addView(text("✓ ${u.optString("label")}  ·  Undo", 14f, DIM) {
                Undo.forget(this)
                send(null) { it.push("check", JSONObject(u.toString()).put("undo", true).put("now", false)) }
            }.apply { maxLines = 1; ellipsize = android.text.TextUtils.TruncateAt.MIDDLE })
            asked?.let { (a, k) -> box.addView(moodRow(a, k)) }
            box.addView(View(this), LinearLayout.LayoutParams(1, dp(8)))
        }

        val now = d?.optJSONObject("now")?.let { Ping.parse(it) }
        val focusing = now?.ends != null && now.ends > System.currentTimeMillis()
        focusMode(focusing)
        if (focusing) return focus(box, now!!)
        // A task opens on itself in Cue; anything else (a routine step, a habit) at its own link.
        val target = now?.check?.takeIf { it.optString("kind") == "task" }?.let { "/?task=${it.optString("id")}" } ?: now?.url ?: "/"
        val openCue = { open(MainActivity::class.java) { putExtra("url", target) } }
        box.addView(label(now?.ctx?.ifEmpty { null } ?: "Now", onClick = openCue))
        val title = text(when {
            Cue.key(this) == null -> "Open Cue to sign in"
            d == null -> "…"
            now == null -> "Nothing up next"
            else -> now.title
        }, 26f, FG, openCue).apply {
            // A long title steps down a size and gets more lines, so the whole thing is readable.
            val long = (now?.title?.length ?: 0) > 40
            val size = if (long) 21f else 26f
            textSize = size; Look.style(this, "body", size); maxLines = if (long) 4 else 2
            ellipsize = android.text.TextUtils.TruncateAt.END; setPadding(0, dp(2), 0, dp(4))
        }.also(box::addView)
        nowTitle = title
        // Pick shows even with nothing up next, so there's always a way to choose something.
        if (d != null && Cue.key(this) != null) {
            val row = LinearLayout(this)
            if (now != null) {
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
            }
            row.addView(text("Pick", 17f, if (now == null) ACCENT else DIM) { open(PickActivity::class.java) }.apply { setPadding(0, dp(6), dp(28), dp(6)) })
            box.addView(row)
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
            // Circle, title wrapping to two lines under itself, minutes pinned right. The circle
            // checks it off; the title opens that task in Cue.
            val title = t.optString("title")
            val id = t.optString("id")
            val mark = text("○", 15f, DIM).apply { setPadding(0, dp(4), dp(16), dp(4)) }
            val name = text(title, 15f, DIM) { open(MainActivity::class.java) { putExtra("url", "/?task=$id") } }.apply {
                setPadding(0, dp(4), dp(12), dp(4))
                maxLines = 2
                ellipsize = android.text.TextUtils.TruncateAt.END
            }
            mark.setOnClickListener {
                mark.isEnabled = false
                name.isEnabled = false
                mark.text = "✓"
                mark.setTextColor(DIM)
                name.setTextColor(DIM)
                val check = JSONObject().put("kind", "task").put("id", id)
                Undo.remember(this@HomeActivity, check, title)
                send(null) { it.push("check", JSONObject(check.toString()).put("now", false)) }
            }
            box.addView(LinearLayout(this).apply {
                addView(mark)
                addView(name, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                addView(text("${t.optInt("est_min")}m", 13f, DIM).apply { setPadding(0, dp(5), 0, 0) })
            })
        }
    }

    // During a block the countdown is the only big number: the time moves into the date line,
    // the day lines step aside and the tools dim, still there for whatever the task needs.
    private fun focusMode(on: Boolean) {
        bigClock?.visibility = if (on) View.GONE else View.VISIBLE
        dateClock?.apply {
            format12Hour = if (on) "h:mm  ·  EEEE, MMMM d" else "EEEE, MMMM d"
            format24Hour = if (on) "H:mm  ·  EEEE, d MMMM" else "EEEE, d MMMM"
        }
        dayBox?.visibility = if (on) View.GONE else View.VISIBLE
        toolsBox?.alpha = if (on) 0.3f else 1f
    }

    // A running focus block takes over the top of Home: the task, a live countdown and Done.
    // The day lines and the rest of today step aside and the tools dim, still there for
    // whatever the task needs.
    private fun focus(box: LinearLayout, p: Ping) {
        box.addView(View(this), LinearLayout.LayoutParams(1, dp(12)))
        box.addView(label("Focus", ACCENT))
        box.addView(text(p.title, 30f, FG) { open(MainActivity::class.java) { putExtra("url", p.url) } }
            .apply { Look.style(this, "body", 30f); maxLines = 3; ellipsize = android.text.TextUtils.TruncateAt.END })
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

    // Did that change your mood? One tap under the check-off, fine to ignore. For a task with a
    // predicted mood it's against the guess instead. Feeds the Mood tab and the weekly review.
    private fun moodRow(a: JSONObject, k: String): LinearLayout {
        val vs = a.optString("type") == "vs"
        val row = LinearLayout(this).apply { gravity = android.view.Gravity.CENTER_VERTICAL }
        row.addView(text(if (vs) "Than you expected?" else "Mood after?", 14f, DIM).apply { setPadding(0, dp(4), dp(20), dp(4)) })
        listOf(-1 to "worse", 0 to "same", 1 to "better").forEach { (v, l) ->
            row.addView(text(l, 15f, MID) {
                Cue.prefs(this).edit().putString("mood_said", k).apply()
                row.removeAllViews()
                row.addView(text(if (v > 0) "Better. Noted." else if (v < 0) "Worse. Noted." else "Noted.", 14f, DIM).apply { setPadding(0, dp(4), 0, dp(4)) })
                send(null) { it.push("mood", JSONObject().put("id", a.optString("id")).put(if (vs) "vs_predicted" else "change", v)) }
            }.apply { setPadding(0, dp(4), dp(20), dp(4)) })
        }
        return row
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
            box.addView(text(shown, 26f, DIM).apply { Look.style(this, "body", 26f) })
            focusMode(false)
            Cue.saveNow(this, null)
        }
        if (what == "done") {
            Undo.remember(this, p.check, p.title)
            predicted(p, "after_done")?.let { showNow(it); shownNow = null }
        }
        if (what == "skip") predicted(p, "after_skip")?.let { showNow(it); shownNow = null }
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

    // The server sends what Now becomes once the current item is ticked (after_done) or put off
    // (after_skip), so Done and Not now move on at once; the reply replaces it if anything
    // turned out different.
    private fun predicted(p: Ping, field: String): JSONObject? {
        val w = Cue.prefs(this).getString("widget", null)?.let { runCatching { JSONObject(it) }.getOrNull() } ?: return null
        val cur = w.optJSONObject("now") ?: return null
        if (!w.has(field) || cur.optString("now_key") != p.raw.optString("now_key")) return null
        return JSONObject(w.toString()).apply {
            put("now", opt(field))
            remove("after_done")
            remove("after_skip")
            if (field == "after_done") remove("last_done")
            p.check?.takeIf { field == "after_done" && it.optString("kind") == "task" }?.optString("id")?.let { id ->
                optJSONArray("today")?.let { a -> (a.length() - 1 downTo 0).filter { a.getJSONObject(it).optString("id") == id }.forEach(a::remove) }
            }
        }
    }

    private fun send(p: Ping?, call: (Api) -> JSONObject) {
        val c = applicationContext
        taps++
        inFlight++
        val mine = taps
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
                inFlight--
                // A later tap's reply is the one to show; this one would step back.
                if (mine != taps) return@runOnUiThread
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
    // Only written when it isn't already on: a settings write on every wake costs a frame or two.
    private fun grayscale() {
        if (Settings.Secure.getInt(contentResolver, "accessibility_display_daltonizer_enabled", 0) == 1 &&
            Settings.Secure.getInt(contentResolver, "accessibility_display_daltonizer", -1) == 0) return
        try {
            Settings.Secure.putInt(contentResolver, "accessibility_display_daltonizer_enabled", 1)
            Settings.Secure.putInt(contentResolver, "accessibility_display_daltonizer", 0)
        } catch (_: SecurityException) {
        }
    }
}
