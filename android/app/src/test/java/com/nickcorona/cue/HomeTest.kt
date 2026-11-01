package com.nickcorona.cue

import android.content.ComponentName
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Bitmap
import android.graphics.Canvas
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.test.core.app.ApplicationProvider
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config as RConfig
import org.robolectric.annotation.GraphicsMode
import java.io.File

@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@RConfig(sdk = [34], qualifiers = "w411dp-h900dp-night-xxhdpi")
class HomeTest {
    private val c get() = ApplicationProvider.getApplicationContext<android.content.Context>()
    private fun all(v: View): List<View> = if (v is ViewGroup) listOf(v) + (0 until v.childCount).flatMap { all(v.getChildAt(it)) } else listOf(v)

    @Test fun nowHasButtonsAndTodayIsListed() {
        val now = JSONObject("""{"title":"Email Sam the ratios","body":"Today · 1/3\n~20 min","ctx":"Today · 1/3","tag":"cue-now",
            "check":{"kind":"task","id":"t1"},"start":{"task_id":"t1"},"skip":"task:t1"}""")
        val d = JSONObject().put("now", now).put("done", 1).put("total", 3)
            .put("last_done", JSONObject().put("kind", "task").put("id", "t0").put("label", "Reply to Rachel's inspection email"))
            .put("today", JSONArray()
            .put(JSONObject().put("id", "t1").put("title", "Email Sam the ratios").put("est_min", 20))
            .put(JSONObject().put("id", "t2").put("title", "Tenant insurance: buy").put("est_min", 15))
            .put(JSONObject().put("id", "t3").put("title", "Book Velocity elevator for move-out").put("est_min", 15))
            .put(JSONObject().put("id", "t4").put("title", "Order cheques").put("est_min", 10)))
        val pm = shadowOf(c.packageManager)
        val apps = listOf("Phone", "Messages", "Camera", "Maps", "Spotify", "WhatsApp", "Claude")
        apps.forEach { label ->
            val comp = ComponentName("app.${label.lowercase()}", "app.${label.lowercase()}.Main")
            pm.addActivityIfNotPresent(comp)
            pm.addIntentFilterForActivity(comp, IntentFilter(Intent.ACTION_MAIN).apply { addCategory(Intent.CATEGORY_LAUNCHER) })
            pm.getInternalMutablePackageInfo(comp.packageName).applicationInfo!!.nonLocalizedLabel = label
        }
        Rules(c).apply { allowed(); apps.forEach { allow("app.${it.lowercase()}") } }
        d.put("events", JSONArray().put(JSONObject().put("title", "Dentist").put("start", System.currentTimeMillis() + 3_600_000).put("end", System.currentTimeMillis() + 7_200_000)))
        val weather = JSONObject().put("fetched", System.currentTimeMillis())
            .put("current", JSONObject().put("temperature_2m", 7.2).put("apparent_temperature", 3.1).put("weather_code", 3))
            .put("daily", JSONObject().put("temperature_2m_max", JSONArray().put(11.4)).put("temperature_2m_min", JSONArray().put(4.0))
                .put("uv_index_max", JSONArray().put(4.0)).put("sunset", JSONArray().put(System.currentTimeMillis() / 1000 + 4 * 3600)))
        Cue.prefs(c).edit().putString("key", "test").putString("widget", d.toString()).putString("weather", weather.toString())
            .putFloat("balcony_deg", 200f).apply()

        val a = Robolectric.buildActivity(HomeActivity::class.java).setup().get()
        val root = a.window.decorView
        val texts = all(root).filterIsInstance<TextView>().map { it.text.toString() }
        for (t in listOf("Email Sam the ratios", "Done", "Start 25", "Not now", "ALSO TODAY")) assertTrue(t, t in texts)
        assertTrue(texts.any { it.startsWith("○  Tenant insurance") })
        assertTrue(texts.any { it.startsWith("✓ Reply to Rachel") && it.endsWith("Undo") })
        assertTrue(texts.none { it.startsWith("○  Email Sam") })
        assertTrue(texts.toString(), texts.any { it.contains("feels 3° · cloudy") })
        assertTrue(texts.toString(), texts.any { it.startsWith("Dentist") })

        val w = root.width.coerceAtLeast(1); val h = root.height.coerceAtLeast(1)
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        root.draw(Canvas(bmp))
        File("build/screens").mkdirs()
        File("build/screens/home.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    @Test fun aRunningFocusBlockTakesOverTheTop() {
        val ends = System.currentTimeMillis() + 12 * 60_000
        val now = JSONObject().put("title", "Set hydro and internet end date").put("ctx", "Focus · until 1:57").put("tag", "cue-now")
            .put("check", JSONObject().put("kind", "focus").put("id", "f1")).put("ends", ends).put("prog", JSONArray().put(13).put(25))
        val d = JSONObject().put("now", now).put("done", 0).put("total", 3)
            .put("today", JSONArray().put(JSONObject().put("id", "t2").put("title", "Tenant insurance: buy").put("est_min", 15)))
        Cue.prefs(c).edit().putString("key", "test").putString("widget", d.toString())
            .putString("weather", JSONObject().put("fetched", System.currentTimeMillis())
                .put("current", JSONObject().put("temperature_2m", 7.0).put("apparent_temperature", 7.0).put("weather_code", 0)).toString()).apply()
        val a = Robolectric.buildActivity(HomeActivity::class.java).setup().get()
        val root = a.window.decorView
        val shown = all(root).filter { it.isShown }.filterIsInstance<TextView>().map { it.text.toString() }
        for (t in listOf("FOCUS", "Set hydro and internet end date", "Done", "Stop", "more")) assertTrue(shown.toString(), t in shown)
        assertTrue(shown.any { it.matches(Regex("""1[12]:\d\d""")) })
        assertTrue(shown.none { it.startsWith("○  Tenant") || it.startsWith("Not now") || it.startsWith("Dentist") })

        val bmp = Bitmap.createBitmap(root.width.coerceAtLeast(1), root.height.coerceAtLeast(1), Bitmap.Config.ARGB_8888)
        root.draw(Canvas(bmp))
        all(root).filterIsInstance<TextView>().first { it.text == "Stop" }.performClick()
        val after = all(root).filter { it.isShown }.filterIsInstance<TextView>().map { it.text.toString() }
        assertTrue(after.toString(), "Stopped" in after && "Stop" !in after && after.none { it.matches(Regex("""1[12]:\d\d""")) })
        File("build/screens/home-focus.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    @Test fun aRoutineStepOffersSkipStepAndLaterAndPausedRoutinesStayVisible() {
        val now = JSONObject("""{"title":"Brush teeth","ctx":"Morning routine · 3/6","tag":"cue-now",
            "check":{"kind":"routine_step","id":"r_m","step_id":"b","date":"2026-11-01"},"skip":"step:r_m:b"}""")
        val d = JSONObject().put("now", now).put("paused", JSONArray().put(JSONObject().put("id", "r_d").put("name", "Dinner").put("done", 0).put("total", 2)))
        Cue.prefs(c).edit().putString("key", "test").putString("widget", d.toString()).apply()
        val a = Robolectric.buildActivity(HomeActivity::class.java).setup().get()
        val texts = all(a.window.decorView).filterIsInstance<TextView>().map { it.text.toString() }
        for (t in listOf("Done", "Skip step", "Later", "Dinner paused · 0/2 · resume")) assertTrue(texts.toString(), t in texts)
        assertTrue("Not now" !in texts)
        all(a.window.decorView).filterIsInstance<TextView>().first { it.text.startsWith("Dinner paused") }.performClick()
        assertTrue(all(a.window.decorView).filter { it.isShown }.filterIsInstance<TextView>().none { it.text.startsWith("Dinner paused") })
        assertTrue(JSONObject(Cue.prefs(c).getString("widget", null)!!).getJSONArray("paused").length() == 0)
    }
}
