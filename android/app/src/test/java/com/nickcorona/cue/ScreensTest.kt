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

    // One Home per typeface option, same content, to choose between.
    @Test fun looks() {
        val now = org.json.JSONObject("""{"title":"Book movers for Nov 30","ctx":"Today · 1/3","tag":"cue-now",
            "check":{"kind":"task","id":"t1"},"start":{"task_id":"t1"},"skip":"task:t1"}""")
        val d = org.json.JSONObject().put("now", now).put("done", 1).put("total", 3)
            .put("today", org.json.JSONArray()
                .put(org.json.JSONObject().put("id", "t2").put("title", "Reply to Rachel's inspection email").put("est_min", 10))
                .put(org.json.JSONObject().put("id", "t3").put("title", "Shoulder posture routine").put("est_min", 10)))
            .put("events", org.json.JSONArray().put(org.json.JSONObject().put("title", "Dentist").put("start", System.currentTimeMillis() + 3_600_000).put("end", System.currentTimeMillis() + 7_200_000)))
        val w = org.json.JSONObject().put("fetched", System.currentTimeMillis())
            .put("current", org.json.JSONObject().put("temperature_2m", 14.2).put("apparent_temperature", 13.0).put("weather_code", 0))
            .put("daily", org.json.JSONObject().put("temperature_2m_max", org.json.JSONArray().put(16.2)).put("temperature_2m_min", org.json.JSONArray().put(4.4))
                .put("uv_index_max", org.json.JSONArray().put(3.2)).put("sunset", org.json.JSONArray().put(System.currentTimeMillis() / 1000 + 4 * 3600)))
        Cue.prefs(c).edit().putString("widget", d.toString()).putString("weather", w.toString()).apply()
        for (o in listOf("mono", "serif", "grotesk")) {
            Look.option = o
            shoot("look-$o", Robolectric.buildActivity(HomeActivity::class.java).setup().get())
        }
        Look.option = "mono"
    }
}
