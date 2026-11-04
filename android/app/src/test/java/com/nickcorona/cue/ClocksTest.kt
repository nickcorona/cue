package com.nickcorona.cue

import android.app.Notification
import android.os.Process
import android.service.notification.StatusBarNotification
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config as RConfig

@RunWith(RobolectricTestRunner::class)
@RConfig(sdk = [34])
class ClocksTest {
    private val c get() = ApplicationProvider.getApplicationContext<android.content.Context>()

    private fun sbn(pkg: String, ongoing: Boolean, build: Notification.Builder.() -> Unit): StatusBarNotification {
        val n = Notification.Builder(c, "x").setSmallIcon(R.drawable.ic_stat).setOngoing(ongoing).apply(build).build()
        return StatusBarNotification(pkg, pkg, 1, null, 0, 0, 0, n, Process.myUserHandle(), 0)
    }

    @Test fun aRunningStopwatchTicksAndAPausedOneShowsItsText() {
        val start = System.currentTimeMillis() - 90_000
        val run = Clocks.from(sbn("com.google.android.deskclock", true) {
            setCategory(Notification.CATEGORY_STOPWATCH).setContentTitle("Stopwatch").setUsesChronometer(true).setWhen(start)
        })!!
        assertTrue(run.running)
        assertEquals(start, run.whenMs)
        assertEquals(false, run.countDown)
        val paused = Clocks.from(sbn("com.google.android.deskclock", true) {
            setCategory(Notification.CATEGORY_STOPWATCH).setContentTitle("Stopwatch").setContentText("Paused · 01:30")
        })!!
        assertEquals(false, paused.running)
        assertEquals("Paused · 01:30", paused.text)
    }

    @Test fun aClockTimerCountsDownAndOtherAppsAreIgnored() {
        val t = Clocks.from(sbn("com.google.android.deskclock", true) {
            setContentTitle("5m timer").setUsesChronometer(true).setChronometerCountDown(true).setWhen(System.currentTimeMillis() + 240_000)
        })!!
        assertTrue(t.countDown)
        assertNull(Clocks.from(sbn("com.spotify.music", true) { setContentTitle("Midnight City").setUsesChronometer(true) }))
        assertNull(Clocks.from(sbn("com.google.android.deskclock", false) { setContentTitle("Alarm set for 7:30") }))
    }
}
