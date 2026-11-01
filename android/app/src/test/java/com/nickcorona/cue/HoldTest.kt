package com.nickcorona.cue

import android.app.Notification
import androidx.test.core.app.ApplicationProvider
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config as RConfig

@RunWith(RobolectricTestRunner::class)
@RConfig(sdk = [34])
class HoldTest {
    private val c get() = ApplicationProvider.getApplicationContext<android.content.Context>()

    private fun focusing(ends: Long) = Cue.saveNow(c, JSONObject().put("title", "Book movers").put("tag", "cue-now")
        .put("check", JSONObject().put("kind", "focus").put("id", "f1")).put("ends", ends))

    @Test fun nothingIsHeldOutsideFocus() {
        Cue.saveNow(c, JSONObject().put("title", "Book movers").put("check", JSONObject().put("kind", "task").put("id", "t1")))
        assertFalse(Hold.shouldHold(c, "com.whatsapp", Notification.CATEGORY_MESSAGE, false))
        focusing(System.currentTimeMillis() - 1000)
        assertFalse(Hold.shouldHold(c, "com.whatsapp", Notification.CATEGORY_MESSAGE, false))
    }

    @Test fun duringFocusMessagesWaitButCallsAlarmsCueAndOngoingDont() {
        focusing(System.currentTimeMillis() + 20 * 60_000)
        assertTrue(Hold.shouldHold(c, "com.whatsapp", Notification.CATEGORY_MESSAGE, false))
        assertFalse(Hold.shouldHold(c, "com.google.android.dialer", Notification.CATEGORY_CALL, false))
        assertFalse(Hold.shouldHold(c, "com.google.android.deskclock", Notification.CATEGORY_ALARM, false))
        assertFalse(Hold.shouldHold(c, c.packageName, null, false))
        assertFalse(Hold.shouldHold(c, "com.spotify.music", Notification.CATEGORY_TRANSPORT, true))
    }

    @Test fun heldCountIsPerBlockAndCountsEachNotificationOnce() {
        val ends = System.currentTimeMillis() + 20 * 60_000
        focusing(ends)
        Hold.note(c, "a"); Hold.note(c, "b"); Hold.note(c, "a")
        assertEquals(2, Hold.count(c))
        focusing(ends + 60_000)
        assertEquals(0, Hold.count(c))
    }
}
