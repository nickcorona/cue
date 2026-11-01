package com.nickcorona.cue

import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Bitmap
import android.graphics.Canvas
import android.view.View
import androidx.test.core.app.ApplicationProvider
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config as RConfig
import org.robolectric.annotation.GraphicsMode
import java.io.File

// Renders the dumbphone screens to build/screens so design changes can be looked at side by
// side without a phone.
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@RConfig(sdk = [34], qualifiers = "w411dp-h900dp-night-xxhdpi")
class ScreensTest {
    private val c get() = ApplicationProvider.getApplicationContext<android.content.Context>()

    @Before fun apps() {
        val pm = shadowOf(c.packageManager)
        listOf("Phone", "Messages", "Camera", "Maps", "Spotify", "Claude", "RBC", "Uber", "Chrome", "YouTube", "Reddit", "Instagram", "TikTok").forEach { label ->
            val pkg = "app.${label.lowercase()}"
            val comp = ComponentName(pkg, "$pkg.Main")
            pm.addActivityIfNotPresent(comp)
            pm.addIntentFilterForActivity(comp, IntentFilter(Intent.ACTION_MAIN).apply { addCategory(Intent.CATEGORY_LAUNCHER) })
            pm.getInternalMutablePackageInfo(pkg).applicationInfo!!.nonLocalizedLabel = label
        }
        Cue.prefs(c).edit().putString("key", "test").putFloat("balcony_deg", 200f).apply()
        Rules(c).apply {
            allowed()
            listOf("phone", "messages", "camera", "maps", "spotify").forEach { allow("app.$it") }
            listOf("claude", "rbc", "uber").forEach { setLevel("app.$it", Rules.DRAWER) }
            listOf("instagram", "tiktok").forEach { setLevel("app.$it", Rules.OFF) }
            lock()
            setLevel("app.youtube", Rules.DRAWER)
        }
    }

    private fun shoot(name: String, a: Activity) {
        val root = a.window.decorView
        val bmp = Bitmap.createBitmap(root.width.coerceAtLeast(1), root.height.coerceAtLeast(1), Bitmap.Config.ARGB_8888)
        Canvas(bmp).apply { drawColor(0xFF000000.toInt()) }.also { root.draw(it) }
        File("build/screens").mkdirs()
        File("build/screens/$name.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    @Test fun rules() = shoot("rules", Robolectric.buildActivity(RulesActivity::class.java).setup().get())
    @Test fun unlock() = shoot("unlock", Robolectric.buildActivity(UnlockActivity::class.java).setup().get())
    @Test fun drawer() = shoot("drawer", Robolectric.buildActivity(DrawerActivity::class.java).setup().get())
}
