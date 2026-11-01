package com.nickcorona.cue

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config as RConfig

@RunWith(RobolectricTestRunner::class)
@RConfig(sdk = [34])
class RulesTest {
    private val c get() = ApplicationProvider.getApplicationContext<Context>()
    private var t = 1_800_000_000_000L
    private lateinit var r: Rules

    @Before fun setUp() {
        Rules.clock = { t }
        r = Rules(c)
    }

    @After fun tearDown() {
        Rules.clock = System::currentTimeMillis
    }

    @Test fun setupModeChangesAreInstant() {
        r.allow("com.reddit")
        assertTrue(r.isAllowed("com.reddit"))
        r.block("com.reddit")
        assertFalse(r.isAllowed("com.reddit"))
    }

    @Test fun lockedAllowWaitsADay() {
        r.lock()
        r.allow("com.reddit")
        assertFalse(r.isAllowed("com.reddit"))
        assertEquals(1, r.pending().size)
        r.allow("com.reddit")
        assertEquals(1, r.pending().size)
        t += DELAY_MS - 1
        assertFalse(r.isAllowed("com.reddit"))
        t += 1
        assertTrue(r.isAllowed("com.reddit"))
        assertTrue(r.pending().isEmpty())
    }

    @Test fun blockIsInstantAndCancelsAPendingAllow() {
        r.allow("com.maps")
        r.lock()
        r.block("com.maps")
        assertFalse(r.isAllowed("com.maps"))
        r.allow("com.reddit")
        r.block("com.reddit")
        t += DELAY_MS
        assertFalse(r.isAllowed("com.reddit"))
    }

    @Test fun guardOffWaitsADayThenUnlocksSetup() {
        r.lock()
        r.turnGuardOff()
        assertTrue(r.guardOn())
        assertFalse(r.isAllowed("com.reddit"))
        t += DELAY_MS
        assertFalse(r.guardOn())
        assertFalse(r.locked)
        assertTrue(r.isAllowed("com.reddit"))
    }

    @Test fun unlockIsTimeBoxedAndLogged() {
        r.lock()
        r.unlock("com.reddit", 5, "  check   the DM from Sam ")
        assertTrue(r.isAllowed("com.reddit"))
        assertFalse(r.isAllowed("com.instagram"))
        t += 5 * 60_000L
        assertFalse(r.isAllowed("com.reddit"))
        assertEquals(1, r.unlocksToday())
        assertTrue(r.log().single().endsWith("|com.reddit|5|check the DM from Sam"))
    }

    @Test fun cueAndSettingsAreNeverBlocked() {
        r.lock()
        assertTrue(r.isAllowed(c.packageName))
        assertTrue(r.isAllowed("com.android.settings"))
    }
}
