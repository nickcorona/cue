package com.nickcorona.cue

import android.app.Activity
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.widget.EditText

const val WAIT_S = 20

// Opening something off the list costs a stated reason, a short wait and a time box. The
// guard sends him Home when the box runs out.
class UnlockActivity : Activity() {
    private val handler = Handler(Looper.getMainLooper())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        pick()
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    private fun pick() {
        val rules = Rules(this)
        val allowed = rules.allowed() + rules.always()
        page {
            addView(text("Unlock an app", 28f))
            addView(text("${rules.unlocksToday()} unlocks today", 14f, DIM))
            gap()
            launchable().filter { it.pkg !in allowed }.forEach { a -> addView(text(a.label, 20f) { ask(a) }) }
        }
    }

    private fun ask(app: App) {
        val rules = Rules(this)
        val reason = EditText(this).apply {
            hint = "What are you opening it for?"
            textSize = 20f
            setTextColor(FG)
            setHintTextColor(DIM)
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
                launch(app.pkg)
                finish()
            }
        }
        page {
            addView(text(app.label, 28f))
            gap(12)
            addView(reason)
            addView(status)
            gap(12)
            options.forEach { addView(it.second) }
        }

        fun refresh() {
            val ok = blocker() == null
            options.forEach { (m, v) ->
                v.text = "open for $m min" + if (left > 0) " · ${left}s" else ""
                v.setTextColor(if (ok) FG else DIM)
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
}
