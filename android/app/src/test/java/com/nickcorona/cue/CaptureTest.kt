package com.nickcorona.cue

import android.graphics.Bitmap
import android.graphics.Canvas
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.TextView
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
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
class CaptureTest {
    private val c get() = ApplicationProvider.getApplicationContext<android.content.Context>()
    private fun all(v: View): List<View> = if (v is ViewGroup) listOf(v) + (0 until v.childCount).flatMap { all(v.getChildAt(it)) } else listOf(v)

    @Test fun enterSavesAndStaysOpenForTheNextOne() {
        Cue.prefs(c).edit().putString("key", "test").apply()
        val a = Robolectric.buildActivity(CaptureActivity::class.java).setup().get()
        val root = a.window.decorView
        val box = all(root).filterIsInstance<EditText>().single()
        box.setText("Email Sam the ratios")
        box.onEditorAction(EditorInfo.IME_ACTION_DONE)
        assertEquals("", box.text.toString())
        assertFalse(a.isFinishing)
        assertTrue(all(root).filterIsInstance<TextView>().any { it.text.contains("Email Sam the ratios") && it !is EditText })
        box.setText("Order cheques")
        box.onEditorAction(EditorInfo.IME_ACTION_DONE)
        assertEquals(2, all(root).filterIsInstance<TextView>().count { it.text.contains("Email Sam") || it.text.contains("Order cheques") })

        // An empty Enter closes the sheet.
        box.onEditorAction(EditorInfo.IME_ACTION_DONE)
        assertTrue(a.isFinishing)

        val content = a.findViewById<ViewGroup>(android.R.id.content).getChildAt(0)
        val bmp = Bitmap.createBitmap(content.width.coerceAtLeast(1), content.height.coerceAtLeast(1), Bitmap.Config.ARGB_8888)
        Canvas(bmp).apply { drawColor(0xFF000000.toInt()) }.also { content.draw(it) }
        File("build/screens").mkdirs()
        File("build/screens/capture.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    @Test fun noSignalIsHeldOnThePhoneButARejectionIsNot() {
        assertTrue(Capture.offline(java.net.UnknownHostException("nick-cue.vercel.app")))
        assertTrue(Capture.offline(java.net.SocketException("Software caused connection abort")))
        assertTrue(Capture.offline(HttpError(503, "down")))
        assertFalse(Capture.offline(HttpError(401, "not signed in")))
        val before = Capture.waiting(c)
        Capture.queue(c, "mail forward before moving")
        Capture.queue(c, "buy tape")
        assertEquals(before + 2, Capture.waiting(c))
    }
}
