package com.nickcorona.cue

import android.view.View
import android.view.ViewGroup
import android.widget.TextClock
import androidx.test.core.app.ApplicationProvider
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config as RConfig

// Home's top reads like a phone's: the time opens the clock, the weather the weather app.
@RunWith(RobolectricTestRunner::class)
@RConfig(sdk = [34], qualifiers = "w411dp-h900dp-night-xxhdpi")
class HeaderTest {
    private val c get() = ApplicationProvider.getApplicationContext<android.content.Context>()
    private fun all(v: View): List<View> = if (v is ViewGroup) listOf(v) + (0 until v.childCount).flatMap { all(v.getChildAt(it)) } else listOf(v)

    @Test fun timeOpensAlarmsAndWeatherOpensWeather() {
        val weather = JSONObject().put("fetched", System.currentTimeMillis())
            .put("current", JSONObject().put("temperature_2m", 19.0).put("apparent_temperature", 19.0).put("weather_code", 3))
        Cue.prefs(c).edit().putString("key", "test").putString("weather", weather.toString()).apply()
        val a = Robolectric.buildActivity(HomeActivity::class.java).setup().get()
        val root = a.window.decorView
        all(root).filterIsInstance<TextClock>().first { it.textSize > 100f }.performClick()
        assertEquals(android.provider.AlarmClock.ACTION_SHOW_ALARMS, shadowOf(a).nextStartedActivity?.action)
        all(root).filterIsInstance<android.widget.TextView>().first { it !is TextClock && it.text.contains("feels") }.performClick()
        assertEquals(android.content.Intent.ACTION_VIEW, shadowOf(a).nextStartedActivity?.action)
    }
}
