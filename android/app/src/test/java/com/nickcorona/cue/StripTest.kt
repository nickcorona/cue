package com.nickcorona.cue

import android.content.ComponentName
import android.content.Intent
import android.content.IntentFilter
import android.os.SystemClock
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.shadows.ShadowLooper
import org.robolectric.annotation.Config as RConfig

// The A-Z strip on Home replaces the drawer: free apps by first letter, Gated and Off ones left
// out, and sliding from a letter onto an app opens it.
@RunWith(RobolectricTestRunner::class)
@RConfig(sdk = [34], qualifiers = "w411dp-h900dp-night-xxhdpi")
class StripTest {
    private val c get() = ApplicationProvider.getApplicationContext<android.content.Context>()
    private fun all(v: View): List<View> = if (v is ViewGroup) listOf(v) + (0 until v.childCount).flatMap { all(v.getChildAt(it)) } else listOf(v)

    @Test fun groupsByFirstLetterWithSymbolsLast() {
        val g = Strip.group(listOf(App("uber", "u"), App("Maps", "m"), App("1Password", "p"), App("Messages", "s"), App("Calendar", "c")))
        assertEquals(listOf('C', 'M', 'U', '#'), g.map { it.first })
        assertEquals(listOf("Maps", "Messages"), g[1].second.map { it.label })
    }

    @Test fun homeStripHasFreeAppsAndSlidingOpensOne() {
        val pm = shadowOf(c.packageManager)
        listOf("Maps", "Messages", "RBC", "YouTube", "TikTok").forEach { label ->
            val pkg = "app.${label.lowercase()}"
            val comp = ComponentName(pkg, "$pkg.Main")
            pm.addActivityIfNotPresent(comp)
            pm.addIntentFilterForActivity(comp, IntentFilter(Intent.ACTION_MAIN).apply { addCategory(Intent.CATEGORY_LAUNCHER) })
            pm.getInternalMutablePackageInfo(pkg).applicationInfo!!.nonLocalizedLabel = label
        }
        Apps.clear()
        Rules(c).apply {
            allowed()
            allow("app.maps")
            setLevel("app.messages", Rules.DRAWER)
            setLevel("app.rbc", Rules.DRAWER)
            setLevel("app.tiktok", Rules.OFF)
        }
        Cue.prefs(c).edit().putString("key", "test").apply()
        val a = Robolectric.buildActivity(HomeActivity::class.java).setup().visible().get()
        val root = a.window.decorView
        assertTrue("no more link", all(root).filterIsInstance<TextView>().none { it.text == "more" })
        val strip = all(root).filterIsInstance<Strip>().single()
        // The letters come in off the main thread.
        val until = SystemClock.uptimeMillis() + 5000
        while (strip.groups.isEmpty() && SystemClock.uptimeMillis() < until) { Thread.sleep(20); ShadowLooper.idleMainLooper() }
        val names = strip.groups.flatMap { g -> g.second.map { it.label } }
        assertTrue(names.toString(), "Maps" in names && "Messages" in names && "RBC" in names)
        assertTrue(names.toString(), "YouTube" !in names && "TikTok" !in names)

        // Touch the M slot, then slide left onto Messages and let go.
        root.measure(View.MeasureSpec.makeMeasureSpec(1233, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(2700, View.MeasureSpec.EXACTLY))
        root.layout(0, 0, 1233, 2700)
        val m = strip.groups.indexOfFirst { it.first == 'M' }
        val slot = minOf(strip.height.toFloat() / strip.groups.size, c.dp(30).toFloat())
        val y = (strip.height - slot * strip.groups.size) / 2f + slot * m + slot / 2
        val at = IntArray(2).also { strip.getLocationOnScreen(it) }
        strip.dispatchTouchEvent(MotionEvent.obtain(0, 0, MotionEvent.ACTION_DOWN, at[0] + strip.width / 2f, at[1] + y, 0).also { it.setLocation(strip.width / 2f, y) })
        root.measure(View.MeasureSpec.makeMeasureSpec(1233, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(2700, View.MeasureSpec.EXACTLY))
        root.layout(0, 0, 1233, 2700)
        val row = all(root).filterIsInstance<TextView>().first { it.text == "Messages" && it.isShown }
        val r = IntArray(2).also { row.getLocationOnScreen(it) }
        val rowY = r[1] + row.height / 2f - at[1]
        // Raw coordinates are the screen ones (the strip finds the row by rawY); local ones are the strip's.
        strip.dispatchTouchEvent(MotionEvent.obtain(0, 0, MotionEvent.ACTION_MOVE, (at[0] - 200).toFloat(), (r[1] + row.height / 2).toFloat(), 0).also { it.setLocation(-200f, rowY) })
        strip.dispatchTouchEvent(MotionEvent.obtain(0, 0, MotionEvent.ACTION_UP, (at[0] - 200).toFloat(), (r[1] + row.height / 2).toFloat(), 0).also { it.setLocation(-200f, rowY) })
        val started = shadowOf(a).nextStartedActivity
        assertEquals("app.messages", started?.component?.packageName ?: started?.`package`)
    }
}
