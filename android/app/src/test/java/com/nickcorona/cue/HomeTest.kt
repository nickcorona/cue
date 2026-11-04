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
import org.junit.Assert.assertEquals
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
            .put("last_done", JSONObject().put("kind", "task").put("id", "t0").put("label", "Reply to Rachel's inspection email")
                .put("mood_ask", JSONObject().put("type", "change").put("id", "t0").put("label", "Reply to Rachel's inspection email")))
            .put("today", JSONArray()
            .put(JSONObject().put("id", "t1").put("title", "Email Sam the ratios").put("est_min", 20))
            .put(JSONObject().put("id", "t2").put("title", "Tenant insurance: buy").put("est_min", 15))
            .put(JSONObject().put("id", "t3").put("title", "Book Velocity elevator for move-out day and email Rachel the confirmation").put("est_min", 15))
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
        d.put("body", "214.9 lb  ·  −1.6 this week  ·  0.8 under plan  ·  21% fat")
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
        assertTrue(texts.any { it.startsWith("Tenant insurance") })
        // The title opens that task in Cue; only the circle checks it off.
        all(a.window.decorView).filterIsInstance<TextView>().first { it.text.startsWith("Tenant insurance") }.performClick()
        val opened = shadowOf(a).nextStartedActivity
        assertTrue(opened.toString(), opened.component?.className == MainActivity::class.java.name && opened.getStringExtra("url") == "/?task=t2")
        assertTrue(texts.any { it.startsWith("✓ Reply to Rachel") && it.endsWith("Undo") })
        assertTrue(texts.count { it == "Email Sam the ratios" } == 1)
        assertTrue(texts.toString(), texts.any { it.contains("feels 3° · cloudy") })
        assertTrue(texts.toString(), texts.any { it.endsWith("  Dentist") })
        assertTrue(texts.toString(), "214.9 lb  ·  −1.6 this week  ·  0.8 under plan  ·  21% fat" in texts)

        assertTrue(texts.toString(), "Mood after?" in texts && "worse" in texts && "better" in texts)

        val w = root.width.coerceAtLeast(1); val h = root.height.coerceAtLeast(1)
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        root.draw(Canvas(bmp))
        File("build/screens").mkdirs()
        File("build/screens/home.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }

        // One tap answers it, and it stays answered when Home redraws from the same data.
        all(root).filterIsInstance<TextView>().first { it.text == "better" }.performClick()
        assertTrue(all(root).filterIsInstance<TextView>().any { it.text == "Better. Noted." })
        Cue.prefs(c).edit().putString("widget", d.put("at", 1).toString()).apply()
        val again = Robolectric.buildActivity(HomeActivity::class.java).setup().get()
        assertTrue(all(again.window.decorView).filterIsInstance<TextView>().none { it.text == "Mood after?" })
    }

    // A long middle (a done habit's mood row, paused routines, a full Also today) scrolls; the
    // tools and the footer stay on screen.
    @Test fun theFooterStaysOnScreenWhenNowRunsLong() {
        val now = JSONObject().put("title", "Apply: 1 role + referral ask").put("ctx", "Habit · 6/6").put("tag", "cue-now")
            .put("check", JSONObject().put("kind", "habit").put("id", "h1"))
        val today = JSONArray()
        for (i in 1..12) today.put(JSONObject().put("id", "t$i").put("title", "Deposit the uncashed cheques: mobile deposit $i").put("est_min", 10))
        val d = JSONObject().put("now", now).put("done", 1).put("total", 12).put("today", today)
            .put("last_done", JSONObject().put("kind", "habit").put("id", "h0").put("label", "Evening dog park")
                .put("mood_ask", JSONObject().put("type", "change").put("id", "h0").put("label", "Evening dog park")))
        Cue.prefs(c).edit().putString("key", "test").putString("widget", d.toString()).apply()
        val a = Robolectric.buildActivity(HomeActivity::class.java).setup().visible().get()
        val root = a.window.decorView
        root.measure(View.MeasureSpec.makeMeasureSpec(root.width, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(root.height, View.MeasureSpec.EXACTLY))
        root.layout(0, 0, root.width, root.height)
        val rules = all(root).filterIsInstance<TextView>().first { it.text == "rules" }
        val at = IntArray(2).also { rules.getLocationInWindow(it) }
        assertTrue("rules at ${at[1]}+${rules.height}, screen ${root.height}", rules.height > 0 && at[1] + rules.height <= root.height)
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
        assertTrue(all(root).any { it is android.widget.Chronometer && it.isShown })
        // The countdown is the only big number; the time rides on the date line.
        val clocks = all(root).filterIsInstance<android.widget.TextClock>()
        assertTrue(clocks.none { it.isShown && it.textSize > 100f })
        assertTrue(clocks.any { it.isShown && it.format24Hour.startsWith("H:mm") })
        assertTrue(shown.none { it.startsWith("Tenant") || it.startsWith("Not now") || it.startsWith("Dentist") })

        val bmp = Bitmap.createBitmap(root.width.coerceAtLeast(1), root.height.coerceAtLeast(1), Bitmap.Config.ARGB_8888)
        root.draw(Canvas(bmp))
        all(root).filterIsInstance<TextView>().first { it.text == "Stop" }.performClick()
        val after = all(root).filter { it.isShown }.filterIsInstance<TextView>().map { it.text.toString() }
        assertTrue(after.toString(), "Stopped" in after && "Stop" !in after)
        assertTrue(all(root).none { it is android.widget.Chronometer && it.isShown })
        assertTrue(all(root).filterIsInstance<android.widget.TextClock>().any { it.isShown && it.textSize > 100f })
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

    @Test fun doneShowsTheNextItemStraightAwayFromThePrediction() {
        val now = JSONObject("""{"title":"Rinse face","ctx":"Morning routine · 4/17","tag":"cue-now","now_key":"step:r_m:a",
            "check":{"kind":"routine_step","id":"r_m","step_id":"a","date":"2026-11-01"},"skip":"step:r_m:a"}""")
        val after = JSONObject("""{"title":"Make bed","ctx":"Morning routine · 5/17","tag":"cue-now","now_key":"step:r_m:b",
            "check":{"kind":"routine_step","id":"r_m","step_id":"b","date":"2026-11-01"},"skip":"step:r_m:b"}""")
        Cue.prefs(c).edit().putString("key", "test").putString("widget", JSONObject().put("now", now).put("after_done", after).toString()).apply()
        val a = Robolectric.buildActivity(HomeActivity::class.java).setup().get()
        all(a.window.decorView).filterIsInstance<TextView>().first { it.text == "Done" }.performClick()
        val texts = all(a.window.decorView).filterIsInstance<TextView>().map { it.text.toString() }
        assertTrue(texts.toString(), "Make bed" in texts)
    }

    @Test fun notNowShowsTheNextItemStraightAwayToo() {
        val now = JSONObject("""{"title":"Drink water","ctx":"Habit · 1/3","tag":"cue-now","now_key":"habit:h1",
            "check":{"kind":"habit","id":"h1","date":"2026-11-01"},"skip":"habit:h1"}""")
        val after = JSONObject("""{"title":"Book movers","ctx":"Today · 1/5","tag":"cue-now","now_key":"task:t1",
            "check":{"kind":"task","id":"t1"},"skip":"task:t1"}""")
        Cue.prefs(c).edit().putString("key", "test").putString("widget", JSONObject().put("now", now).put("after_skip", after).toString()).apply()
        val a = Robolectric.buildActivity(HomeActivity::class.java).setup().get()
        all(a.window.decorView).filterIsInstance<TextView>().first { it.text == "Not now" }.performClick()
        val texts = all(a.window.decorView).filterIsInstance<TextView>().map { it.text.toString() }
        assertTrue(texts.toString(), "Book movers" in texts)
        assertTrue(texts.toString(), "Later" !in texts)
    }

    @Test fun whatsPlayingShowsAsOneLineWithPauseAndNext() {
        val session = android.media.session.MediaSession(c, "test").apply {
            setMetadata(android.media.MediaMetadata.Builder()
                .putString(android.media.MediaMetadata.METADATA_KEY_TITLE, "Midnight City")
                .putString(android.media.MediaMetadata.METADATA_KEY_ARTIST, "M83").build())
            setPlaybackState(android.media.session.PlaybackState.Builder()
                .setState(android.media.session.PlaybackState.STATE_PLAYING, 0, 1f).build())
            isActive = true
        }
        val ctl = session.controller
        shadowOf(ctl).setMetadata(android.media.MediaMetadata.Builder()
            .putString(android.media.MediaMetadata.METADATA_KEY_TITLE, "Midnight City")
            .putString(android.media.MediaMetadata.METADATA_KEY_ARTIST, "M83").build())
        shadowOf(ctl).setPlaybackState(android.media.session.PlaybackState.Builder()
            .setState(android.media.session.PlaybackState.STATE_PLAYING, 0, 1f)
            .addCustomAction("spotify.like", "Add to Liked Songs", R.drawable.ic_stat).build())
        shadowOf(c.getSystemService(android.media.session.MediaSessionManager::class.java)).addController(ctl)
        Cue.prefs(c).edit().putString("key", "test").remove("widget").apply()
        val a = Robolectric.buildActivity(HomeActivity::class.java).setup().get()
        val shown = all(a.window.decorView).filter { it.isShown }.filterIsInstance<TextView>().map { it.text.toString() }
        val icons = all(a.window.decorView).filter { it.isShown && it is android.widget.ImageView }.map { it.contentDescription.toString() }
        assertTrue(shown.toString(), "♪  Midnight City · M83" in shown)
        assertEquals(listOf("Like", "Back", "Pause", "Next"), icons)
        val bmp = Bitmap.createBitmap(a.window.decorView.width.coerceAtLeast(1), a.window.decorView.height.coerceAtLeast(1), Bitmap.Config.ARGB_8888)
        a.window.decorView.draw(Canvas(bmp))
        File("build/screens/home-music.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
        session.release()
    }
}
