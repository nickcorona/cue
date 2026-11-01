package com.nickcorona.cue

import android.content.ComponentName
import android.content.Intent
import android.content.IntentFilter
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.TextView
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config as RConfig
import org.robolectric.shadows.ShadowLooper

@RunWith(RobolectricTestRunner::class)
@RConfig(sdk = [34])
class UnlockTest {
    private fun all(v: View): List<View> = if (v is ViewGroup) listOf(v) + (0 until v.childCount).flatMap { all(v.getChildAt(it)) } else listOf(v)

    @Test fun openForFiveMinutesLaunchesTheApp() {
        val ctx = org.robolectric.RuntimeEnvironment.getApplication()
        val pm = shadowOf(ctx.packageManager)
        val comp = ComponentName("com.reddit.frontpage", "com.reddit.Main")
        pm.addActivityIfNotPresent(comp)
        pm.addIntentFilterForActivity(comp, IntentFilter(Intent.ACTION_MAIN).apply { addCategory(Intent.CATEGORY_LAUNCHER) })

        val a = Robolectric.buildActivity(UnlockActivity::class.java).setup().get()
        val root = a.window.decorView
        all(root).filterIsInstance<TextView>().first { it.text == "com.reddit.Main" || it.text.contains("reddit", true) }.performClick()
        val open = all(root).filterIsInstance<TextView>().first { it.text.startsWith("open for 5 min") }
        open.performClick()
        assertEquals(null, shadowOf(a).nextStartedActivity)
        assertTrue(all(root).filterIsInstance<TextView>().any { it.text.startsWith("Say what it's for") })
        all(root).filterIsInstance<EditText>().single().setText("reply to the DM thread")
        open.performClick()
        assertTrue(all(root).filterIsInstance<TextView>().any { it.text.startsWith("Wait ") })
        ShadowLooper.idleMainLooper((WAIT_S + 1) * 1000L, java.util.concurrent.TimeUnit.MILLISECONDS)
        assertEquals("open for 5 min", open.text)
        open.performClick()
        val next = shadowOf(a).nextStartedActivity
        assertEquals("com.reddit.frontpage", next?.component?.packageName ?: next?.`package`)
        assertTrue(a.isFinishing)
    }

    @Test fun onlyGatedAppsAreOfferedToUnlock() {
        val ctx = org.robolectric.RuntimeEnvironment.getApplication()
        val pm = shadowOf(ctx.packageManager)
        for (pkg in listOf("app.bank", "app.tiktok", "app.reddit")) {
            val comp = ComponentName(pkg, "$pkg.Main")
            pm.addActivityIfNotPresent(comp)
            pm.addIntentFilterForActivity(comp, IntentFilter(Intent.ACTION_MAIN).apply { addCategory(Intent.CATEGORY_LAUNCHER) })
        }
        Rules(ctx).apply { setLevel("app.bank", Rules.DRAWER); setLevel("app.tiktok", Rules.OFF) }
        val a = Robolectric.buildActivity(UnlockActivity::class.java).setup().get()
        val texts = all(a.window.decorView).filterIsInstance<TextView>().map { it.text.toString() }
        assertTrue(texts.toString(), texts.any { it.contains("reddit") })
        assertTrue(texts.none { it.contains("bank") || it.contains("tiktok") })
    }
}
