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

    // Share from a screenshot or an app opens Android 14's share sheet, its own package.
    @Test fun theShareSheetIsNeverGated() {
        r.lock()
        assertTrue(r.isAllowed("com.android.intentresolver"))
        assertTrue(r.isAllowed("com.google.android.ext.services"))
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

    // A link out of YouTube into Chrome used to end the YouTube unlock.
    @Test fun unlockingASecondAppKeepsTheFirstOnesTime() {
        r.lock()
        r.unlock("com.google.android.youtube", 15, "watch the moving video")
        t += 2 * 60_000L
        r.unlock("com.android.chrome", 5, "open the link from it")
        assertTrue(r.isAllowed("com.google.android.youtube"))
        assertTrue(r.isAllowed("com.android.chrome"))
        t += 6 * 60_000L
        assertFalse(r.isAllowed("com.android.chrome"))
        assertTrue(r.isAllowed("com.google.android.youtube"))
        assertTrue(r.expired("com.android.chrome"))
        t += 8 * 60_000L
        assertFalse(r.isAllowed("com.google.android.youtube"))
    }

    @Test fun cueAndSettingsAreNeverBlocked() {
        r.lock()
        assertTrue(r.isAllowed(c.packageName))
        assertTrue(r.isAllowed("com.android.settings"))
    }

    @Test fun drawerAppsOpenFreelyButStayOffHome() {
        r.setLevel("com.bank", Rules.DRAWER)
        assertTrue(r.isAllowed("com.bank"))
        assertFalse("com.bank" in r.allowed())
        assertTrue("com.bank" in r.drawer())
    }

    @Test fun offAppsCantBeUnlocked() {
        r.setLevel("com.tiktok", Rules.OFF)
        r.lock()
        r.unlock("com.tiktok", 5, "just this once please")
        assertFalse(r.isAllowed("com.tiktok"))
    }

    @Test fun claudeIsPreApprovedAndCantBeBlocked() {
        r.lock()
        r.setLevel("com.anthropic.claude", Rules.OFF)
        assertEquals(Rules.DRAWER, r.level("com.anthropic.claude"))
        assertTrue(r.isAllowed("com.anthropic.claude"))
        assertTrue("com.anthropic.claude" in r.drawer())
    }

    @Test fun thePhonesBasicToolsArePreApprovedButNotEverySystemApp() {
        val ctx = ApplicationProvider.getApplicationContext<Context>()
        val pm = org.robolectric.Shadows.shadowOf(ctx.packageManager)
        val calc = android.content.ComponentName("com.google.android.calculator", "Calc")
        pm.addActivityIfNotPresent(calc)
        pm.addIntentFilterForActivity(calc, android.content.IntentFilter(android.content.Intent.ACTION_MAIN).apply { addCategory(android.content.Intent.CATEGORY_APP_CALCULATOR) })
        val rules = Rules(ctx)
        rules.lock()
        rules.setLevel("com.google.android.calculator", Rules.OFF)
        rules.setLevel("com.google.android.youtube", Rules.OFF)
        assertEquals(Rules.DRAWER, rules.level("com.google.android.calculator"))
        assertEquals(Rules.OFF, rules.level("com.google.android.youtube"))
    }

    @Test fun androidsOwnScreensAreNeverGated() {
        r.lock()
        assertTrue(r.isAllowed("com.google.android.apps.wellbeing"))
        assertTrue(r.isAllowed("com.google.android.gms"))
    }

    @Test fun loosenerLevelsWaitADayTighterAreInstant() {
        r.setLevel("com.reddit", Rules.OFF)
        r.lock()
        r.setLevel("com.reddit", Rules.DRAWER)
        assertEquals(Rules.OFF, r.level("com.reddit"))
        assertEquals(Rules.DRAWER, r.pendingLevel("com.reddit"))
        r.setLevel("com.reddit", Rules.GATED)
        assertEquals(Rules.GATED, r.pendingLevel("com.reddit"))
        t += DELAY_MS
        assertEquals(Rules.GATED, r.level("com.reddit"))
        r.setLevel("com.reddit", Rules.OFF)
        assertEquals(Rules.OFF, r.level("com.reddit"))
        assertEquals(null, r.pendingLevel("com.reddit"))
    }

    @Test fun homeToDrawerIsTighterAndInstant() {
        r.allow("com.spotify")
        r.lock()
        r.setLevel("com.spotify", Rules.DRAWER)
        assertEquals(Rules.DRAWER, r.level("com.spotify"))
        assertFalse("com.spotify" in r.allowed())
    }

    // A reinstall wipes the phone's rules; the server's copy brings back the list, the lock and
    // anything still waiting out its 24h.
    @Test fun aSnapshotRestoresTheRulesTheLockAndWhatsPending() {
        r.allow("com.reddit")
        r.setLevel("com.netflix", Rules.OFF)
        r.lock()
        r.allow("com.youtube")
        val snap = org.json.JSONObject(r.snapshot().toString())
        c.getSharedPreferences("rules", Context.MODE_PRIVATE).edit().clear().commit()
        assertFalse(Rules(c).locked)
        val back = Rules(c).apply { restore(snap) }
        assertTrue(back.locked)
        assertTrue(back.isAllowed("com.reddit"))
        assertEquals(Rules.OFF, back.level("com.netflix"))
        assertFalse(back.isAllowed("com.youtube"))
        assertTrue(back.pending().any { it.arg == "com.youtube" || it.arg.startsWith("com.youtube=") })
        t += DELAY_MS + 1
        assertTrue(back.isAllowed("com.youtube"))
    }
}
