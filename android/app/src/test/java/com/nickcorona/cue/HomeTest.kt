package com.nickcorona.cue

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
        val d = JSONObject().put("now", now).put("done", 1).put("total", 3).put("today", JSONArray()
            .put(JSONObject().put("id", "t1").put("title", "Email Sam the ratios").put("est_min", 20))
            .put(JSONObject().put("id", "t2").put("title", "Tenant insurance: buy").put("est_min", 15)))
        Cue.prefs(c).edit().putString("key", "test").putString("widget", d.toString()).apply()

        val a = Robolectric.buildActivity(HomeActivity::class.java).setup().get()
        val root = a.window.decorView
        val texts = all(root).filterIsInstance<TextView>().map { it.text.toString() }
        for (t in listOf("Email Sam the ratios", "Done", "Start 25", "Not now", "Also today")) assertTrue(t, t in texts)
        assertTrue(texts.any { it.startsWith("○  Tenant insurance") })
        assertTrue(texts.none { it.startsWith("○  Email Sam") })

        val w = root.width.coerceAtLeast(1); val h = root.height.coerceAtLeast(1)
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        root.draw(Canvas(bmp))
        File("build/screens").mkdirs()
        File("build/screens/home.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }
}
