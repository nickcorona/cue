package com.nickcorona.cue

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.view.Gravity
import android.view.HapticFeedbackConstants
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.concurrent.thread

// The A-Z strip down Home's right edge, in place of a drawer: every app that opens freely
// (Home and Drawer level) by its first letter. Slide a thumb down the strip and that letter's
// apps show beside it while the rest of Home fades back; slide left onto one and let go to open
// it. Letting go anywhere else puts Home back.
// Alphabetical on purpose: places never move, and nothing rises for being used most.
// Gated and Off apps aren't on it; those go through Unlock as before.
class Strip(c: Context, private val apps: () -> List<App>, private val open: (App) -> Unit) : View(c) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        textAlign = Paint.Align.CENTER
        textSize = c.dp(12).toFloat()
        typeface = Look.label(c)
    }
    private lateinit var panel: LinearLayout
    private lateinit var scrim: View
    private lateinit var screen: View
    var groups: List<Pair<Char, List<App>>> = emptyList()
        private set
    private var letter: Char? = null
    private var shown: List<App> = emptyList()
    private var hot = -1

    // Looking labels up can be slow on a cold start, so the letters are filled in off the main thread.
    fun refresh() = thread {
        val g = group(apps())
        post { groups = g; invalidate() }
    }

    // Each letter gets the same slot, packed toward the middle when there are only a few.
    private fun slot() = if (groups.isEmpty()) 0f else minOf(height.toFloat() / groups.size, context.dp(30).toFloat())
    private fun top() = (height - slot() * groups.size) / 2f

    override fun onDraw(canvas: Canvas) {
        if (groups.isEmpty()) return
        // At rest it's only a faint handle on the edge, so Home stays quiet; the letters show
        // while a thumb is on it (or its list is open).
        if (letter == null) {
            paint.color = FAINT_TEXT
            val w = context.dp(3).toFloat(), h = context.dp(44).toFloat()
            canvas.drawRoundRect(width - context.dp(6) - w, height / 2f - h / 2, width - context.dp(6).toFloat(), height / 2f + h / 2, w, w, paint)
            return
        }
        val s = slot()
        val t = top()
        groups.forEachIndexed { i, (l, _) ->
            paint.color = if (l == letter) ACCENT else DIM
            canvas.drawText(l.toString(), width / 2f, t + s * i + s / 2 + paint.textSize / 3, paint)
        }
    }

    override fun onTouchEvent(e: MotionEvent): Boolean {
        if (groups.isEmpty()) return false
        val onStrip = e.x >= -context.dp(12)
        when (e.actionMasked) {
            MotionEvent.ACTION_DOWN, MotionEvent.ACTION_MOVE -> {
                parent?.requestDisallowInterceptTouchEvent(true)
                if (onStrip) {
                    val i = ((e.y - top()) / slot()).toInt().coerceIn(0, groups.size - 1)
                    val (l, list) = groups[i]
                    if (l != letter) {
                        letter = l
                        show(list, e.rawY)
                        performHapticFeedback(HapticFeedbackConstants.CLOCK_TICK)
                        invalidate()
                    }
                    light(-1)
                } else light(rowAt(e.rawY))
            }
            // Letting go on an app opens it; anywhere else puts Home back.
            MotionEvent.ACTION_UP -> if (hot >= 0) pick(shown[hot]) else hide()
            MotionEvent.ACTION_CANCEL -> hide()
        }
        return true
    }

    private fun pick(a: App) {
        hide()
        open(a)
    }

    private fun show(list: List<App>, rawY: Float) {
        shown = list
        panel.removeAllViews()
        list.forEach { a ->
            panel.addView(context.text(a.label, 26f) { pick(a) }.apply { maxLines = 1; setPadding(0, context.dp(12), 0, context.dp(12)) })
        }
        if (panel.visibility != VISIBLE) {
            // Home steps back while a letter is up, so the apps are the only thing to read.
            screen.animate().alpha(0.12f).setDuration(140).start()
            panel.alpha = 0f
            panel.animate().alpha(1f).setDuration(140).start()
        }
        panel.visibility = VISIBLE
        scrim.visibility = VISIBLE
        // Beside the thumb, kept on screen.
        val root = panel.parent as View
        panel.measure(MeasureSpec.makeMeasureSpec(root.width, MeasureSpec.AT_MOST), MeasureSpec.makeMeasureSpec(root.height, MeasureSpec.AT_MOST))
        val at = IntArray(2).also { root.getLocationOnScreen(it) }
        panel.translationY = (rawY - at[1] - panel.measuredHeight / 2f).coerceIn(0f, (root.height - panel.measuredHeight).toFloat().coerceAtLeast(0f))
    }

    // Which of the shown apps is level with the thumb, or -1.
    private fun rowAt(rawY: Float): Int {
        if (panel.visibility != VISIBLE) return -1
        val at = IntArray(2)
        for (i in 0 until panel.childCount) {
            val v = panel.getChildAt(i)
            v.getLocationOnScreen(at)
            if (rawY >= at[1] && rawY < at[1] + v.height) return i
        }
        return -1
    }

    private fun light(i: Int) {
        hot = i
        for (k in 0 until panel.childCount) (panel.getChildAt(k) as? TextView)?.setTextColor(if (k == i) ACCENT else FG)
    }

    fun hide() {
        if (panel.visibility == VISIBLE) screen.animate().alpha(1f).setDuration(160).start()
        panel.visibility = GONE
        scrim.visibility = GONE
        letter = null
        hot = -1
        invalidate()
    }

    companion object {
        fun letterOf(label: String): Char = label.trim().firstOrNull()?.uppercaseChar()?.takeIf { it in 'A'..'Z' } ?: '#'

        // Letters A to Z that have apps, then # for anything starting with a digit or symbol.
        fun group(apps: List<App>): List<Pair<Char, List<App>>> = apps.distinctBy { it.pkg }
            .sortedBy { it.label.lowercase() }
            .groupBy { letterOf(it.label) }
            .toList()
            .sortedBy { (l, _) -> if (l == '#') '[' else l }

        // Lays the strip over a screen: the screen itself, a scrim that closes the letter's
        // list on a tap elsewhere, the list, and the strip on the right edge.
        fun over(screen: View, apps: () -> List<App>, open: (App) -> Unit): Pair<FrameLayout, Strip> {
            val c = screen.context
            val root = FrameLayout(c).apply { setBackgroundColor(BG) }
            val strip = Strip(c, apps, open).apply { contentDescription = "A to Z" }
            root.addView(screen, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            strip.screen = screen
            strip.scrim = View(c).apply { visibility = GONE; setOnClickListener { strip.hide() } }
            root.addView(strip.scrim, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
            strip.panel = LinearLayout(c).apply {
                orientation = LinearLayout.VERTICAL
                visibility = GONE
                setPadding(c.dp(22), c.dp(10), c.dp(12), c.dp(10))
                minimumWidth = c.dp(200)
                gravity = Gravity.END
            }
            root.addView(strip.panel, FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.END or Gravity.TOP).apply {
                rightMargin = c.dp(40)
            })
            root.addView(strip, FrameLayout.LayoutParams(c.dp(28), ViewGroup.LayoutParams.MATCH_PARENT, Gravity.END).apply {
                topMargin = c.dp(150)
                bottomMargin = c.dp(150)
            })
            strip.refresh()
            return root to strip
        }
    }
}
