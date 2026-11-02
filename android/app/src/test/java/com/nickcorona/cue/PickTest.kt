package com.nickcorona.cue

import android.graphics.Bitmap
import android.graphics.Canvas
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.TextView
import androidx.test.core.app.ApplicationProvider
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
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
class PickTest {
    private val c get() = ApplicationProvider.getApplicationContext<android.content.Context>()
    private fun all(v: View): List<View> = if (v is ViewGroup) listOf(v) + (0 until v.childCount).flatMap { all(v.getChildAt(it)) } else listOf(v)

    @Test fun searchNarrowsTheQueue() {
        val q = JSONArray()
            .put(JSONObject().put("id", "t1").put("title", "Review Jira board").put("est_min", 20).put("project", "Work"))
            .put(JSONObject().put("id", "t2").put("title", "Tell Terrence the David plan").put("est_min", 15).put("project", "Work"))
            .put(JSONObject().put("id", "t3").put("title", "Order cheques").put("est_min", 10).put("project", "Money & admin"))
        Cue.prefs(c).edit().putString("key", "test").putString("queue", q.toString()).apply()
        val a = Robolectric.buildActivity(PickActivity::class.java).setup().get()
        val root = a.window.decorView
        fun titles() = all(root).filterIsInstance<TextView>().filter { it !is EditText }.map { it.text.toString() }
        assertTrue(titles().containsAll(listOf("Review Jira board", "Tell Terrence the David plan", "Order cheques")))
        all(root).filterIsInstance<EditText>().first().setText("terr")
        assertTrue(titles().contains("Tell Terrence the David plan"))
        assertTrue(!titles().contains("Order cheques"))
        all(root).filterIsInstance<EditText>().first().setText("work")
        assertEquals(2, titles().count { it.startsWith("Review") || it.startsWith("Tell") })

        all(root).filterIsInstance<EditText>().first().setText("")
        root.measure(View.MeasureSpec.makeMeasureSpec(1233, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(1600, View.MeasureSpec.AT_MOST))
        root.layout(0, 0, root.measuredWidth, root.measuredHeight)
        val bmp = Bitmap.createBitmap(root.width, root.height, Bitmap.Config.ARGB_8888)
        root.draw(Canvas(bmp))
        File("build/screens").mkdirs()
        File("build/screens/pick.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }
}
