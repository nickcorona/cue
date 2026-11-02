package com.nickcorona.cue

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.LinearLayout

const val WAIT_S = 20

// Opening something off the list costs a stated reason, a short wait and a time box. The
// guard sends him here when he opens a Gated app any other way, and Home when the box runs out.
class UnlockActivity : Activity() {
    private val handler = Handler(Looper.getMainLooper())
    private val fromGuard get() = intent.getStringExtra("pkg") != null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val pkg = intent.getStringExtra("pkg")
        val app = pkg?.let { p -> launchable().firstOrNull { it.pkg == p } }
        if (app != null) ask(app) else pick()
    }

    // Never left half-done in the background: coming back to an old screen still set to the
    // last app is how unlock ended up opening the wrong one. Leaving closes it.
    override fun onStop() {
        super.onStop()
        if (!isChangingConfigurations) finish()
    }

    // Sent here by the guard, the app he tried is right behind, so Back goes Home instead.
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (fromGuard) goHome()
        @Suppress("DEPRECATION") super.onBackPressed()
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    private fun pick() {
        val rules = Rules(this)
        val always = rules.always()
        val now = System.currentTimeMillis()
        val apps = launchable()
        page {
            val n = rules.unlocksToday()
            addView(label(if (n == 0) "None today" else "$n today"))
            addView(text("Unlock", 32f).apply { setPadding(0, 0, 0, dp(4)) })
            addView(text("A reason, a ${WAIT_S}s wait, then 5 or 15 minutes.", 15f, DIM))
            gap(8)
            // Only Gated apps go through here: Home and Drawer apps open freely, Off apps never.
            // One still inside its time box just opens.
            apps.filter { it.pkg !in always && rules.level(it.pkg) == Rules.GATED }.forEach { a ->
                val until = rules.unlockedUntil(a.pkg)
                val go = {
                    val u = rules.unlockedUntil(a.pkg)
                    if (u > System.currentTimeMillis()) { launch(a.pkg, u); finish() } else ask(a)
                }
                addView(LinearLayout(context).apply {
                    gravity = android.view.Gravity.CENTER_VERTICAL
                    addView(text(a.label, 22f, onClick = go).apply { setPadding(0, dp(10), 0, dp(10)) }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                    if (until > now) addView(text("${(until - now + 59_999) / 60_000}m left", 15f, ACCENT, go))
                })
            }
            // What he opened today and why, so the reasons get read back.
            val today = rules.todaysLog()
            if (today.isNotEmpty()) {
                addView(label("Today"))
                val fmt = Day.clock(context)
                today.forEach { u ->
                    val name = apps.firstOrNull { it.pkg == u.pkg }?.label ?: u.pkg
                    addView(text("${fmt(u.at)}  $name · ${u.minutes}m", 15f, MID).apply { setPadding(0, dp(6), 0, 0) })
                    addView(text(u.reason, 14f, DIM).apply { setPadding(0, 0, 0, dp(6)) })
                }
            }
        }
    }

    private fun ask(app: App) {
        val rules = Rules(this)
        val reason = EditText(this).apply {
            hint = "What are you opening it for?"
            textSize = 20f
            setTextColor(FG)
            setHintTextColor(DIM)
            Look.style(this, "body", 20f)
            imeOptions = EditorInfo.IME_ACTION_DONE
            setSingleLine()
        }
        val status = text("", 15f, DIM)
        var left = WAIT_S
        fun words() = reason.text.trim().split(Regex("\\s+")).count { it.isNotEmpty() }
        fun blocker() = when {
            words() < 3 -> "Say what it's for, in 3 words or more"
            left > 0 -> "Wait ${left}s"
            else -> null
        }
        // Taps always answer: early ones say what's still missing instead of doing nothing.
        val options = listOf(5, 15).map { m ->
            m to text("", 22f) {
                val why = blocker()
                if (why != null) {
                    status.text = why
                    status.setTextColor(FG)
                    return@text
                }
                rules.unlock(app.pkg, m, reason.text.toString())
                launch(app.pkg, System.currentTimeMillis() + m * 60_000L)
                finish()
            }
        }
        page {
            addView(label(if (fromGuard) "Gated · unlock to open" else "Unlock"))
            addView(text(app.label, 32f).apply { setPadding(0, 0, 0, dp(12)) })
            addView(reason)
            addView(status)
            gap(12)
            options.forEach { addView(it.second) }
            gap(12)
            addView(text("never mind", 16f, DIM) { goHome(); finish() })
        }
        reason.requestFocus()
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE or WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)

        fun refresh() {
            val ok = blocker() == null
            options.forEach { (m, v) ->
                v.text = "open for $m min" + if (left > 0) " · ${left}s" else ""
                v.setTextColor(if (ok) ACCENT else DIM)
            }
            status.text = blocker()?.takeIf { words() < 3 } ?: ""
            status.setTextColor(DIM)
        }
        reason.addTextChangedListener(object : TextWatcher {
            override fun afterTextChanged(s: Editable?) = refresh()
            override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
            override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
        })
        val tick = object : Runnable {
            override fun run() {
                left--
                refresh()
                if (left > 0) handler.postDelayed(this, 1000)
            }
        }
        refresh()
        handler.postDelayed(tick, 1000)
    }

    companion object {
        fun ask(c: Context, pkg: String) = c.startActivity(Intent(c, UnlockActivity::class.java).putExtra("pkg", pkg)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
    }
}
