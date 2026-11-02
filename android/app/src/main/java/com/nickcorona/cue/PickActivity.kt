package com.nickcorona.cue

import android.app.Activity
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.text.Editable
import android.text.InputType
import android.text.TextWatcher
import android.view.Gravity
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Toast
import org.json.JSONArray
import org.json.JSONObject
import kotlin.concurrent.thread

// Home's "pick": today's open habits, then the open tasks in Cue's order with a search box, for when the ranking has it
// wrong. Tapping one pins it for today, so it becomes Now on Home and in the notification;
// once it's done (or put off) the ranking takes over again.
class PickActivity : Activity() {
    private lateinit var search: EditText
    private lateinit var list: LinearLayout
    private var tasks: List<JSONObject> = emptyList()
    private var picking = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Cue.key(this) == null) return finish()
        window.setGravity(Gravity.BOTTOM)
        window.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)

        search = EditText(this).apply {
            hint = "Search tasks"
            textSize = 18f
            setTextColor(FG)
            setHintTextColor(DIM)
            background = null
            setPadding(0, dp(6), 0, dp(6))
            inputType = InputType.TYPE_CLASS_TEXT
            imeOptions = EditorInfo.IME_ACTION_DONE
            addTextChangedListener(object : TextWatcher {
                override fun afterTextChanged(s: Editable?) = show()
                override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
                override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
            })
        }
        list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val scroll = ScrollView(this).apply { addView(list) }

        setContentView(LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24), dp(18), dp(24), dp(12))
            background = GradientDrawable().apply {
                setColor(SHEET)
                cornerRadii = FloatArray(8) { if (it < 4) dp(20).toFloat() else 0f }
            }
            addView(label("Pick what's next").apply { setPadding(0, 0, 0, dp(2)) })
            addView(search)
            addView(scroll, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, (resources.displayMetrics.heightPixels * 0.5).toInt()))
        })

        // Last time's list at once, then the fresh one.
        tasks = parse(Cue.prefs(this).getString("queue", null))
        build()
        val c = applicationContext
        thread {
            val fresh = runCatching { Api(c).push("queue", JSONObject()).optJSONArray("tasks") }.getOrNull() ?: return@thread
            val old = Cue.prefs(c).getString("queue", null)
            if (fresh.toString() == old) return@thread
            Cue.prefs(c).edit().putString("queue", fresh.toString()).apply()
            runOnUiThread { if (!isFinishing) { tasks = parse(fresh.toString()); build() } }
        }
    }

    private fun parse(s: String?): List<JSONObject> =
        s?.let { runCatching { JSONArray(it) }.getOrNull() }?.let { a -> (0 until a.length()).map { a.getJSONObject(it) } }.orEmpty()

    // The rows are made once per list; typing only shows and hides them.
    private var rows: List<Pair<String, android.view.View>> = emptyList()
    private val empty by lazy { text("", 15f, DIM) }

    private fun build() {
        list.removeAllViews()
        list.addView(empty)
        rows = tasks.map { t ->
            val pinned = t.optBoolean("pinned")
            val min = t.optInt("est_min")
            val row = LinearLayout(this).apply {
                addView(text(t.optString("title"), 17f, if (pinned) ACCENT else MID).apply {
                    setPadding(0, dp(8), dp(12), dp(8))
                    maxLines = 2
                    ellipsize = android.text.TextUtils.TruncateAt.END
                }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
                addView(text(if (min > 0) "${min}m" else "", 15f, DIM).apply { setPadding(0, dp(9), 0, 0) })
                setOnClickListener { pick(t) }
            }
            list.addView(row)
            "${t.optString("title")} ${t.optString("project")}".lowercase() to row
        }
        show()
    }

    private fun show() {
        if (picking || !::search.isInitialized) return
        val words = search.text.toString().trim().lowercase().split(Regex("\\s+")).filter { it.isNotEmpty() }
        val cap = if (words.isEmpty()) 30 else 100
        var n = 0
        for ((hay, row) in rows) {
            val hit = n < cap && words.all { hay.contains(it) }
            row.visibility = if (hit) android.view.View.VISIBLE else android.view.View.GONE
            if (hit) n++
        }
        empty.text = if (tasks.isEmpty()) "…" else "Nothing matches"
        empty.visibility = if (n == 0) android.view.View.VISIBLE else android.view.View.GONE
    }

    // Saved before closing, so Home comes back already showing it.
    private fun pick(t: JSONObject) {
        if (picking) return
        picking = true
        list.removeAllViews()
        list.addView(text("Up next: ${t.optString("title")}…", 17f, FG))
        val c = applicationContext
        thread {
            val r = runCatching { Api(c).push("pin", JSONObject().put("id", t.optString("id")).put("kind", t.optString("kind", "task"))) }
            r.getOrNull()?.optJSONObject("widget")?.let { NowSync.apply(c, it) }
            runOnUiThread {
                r.exceptionOrNull()?.let { Toast.makeText(c, "Couldn't pick that: ${it.message?.take(60)}", Toast.LENGTH_LONG).show() }
                finish()
            }
        }
    }
}
