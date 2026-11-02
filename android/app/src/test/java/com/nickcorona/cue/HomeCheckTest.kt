package com.nickcorona.cue

import android.app.NotificationManager
import android.content.Intent
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config as RConfig

@RunWith(RobolectricTestRunner::class)
@RConfig(sdk = [34])
class HomeCheckTest {
    private val c get() = ApplicationProvider.getApplicationContext<android.content.Context>()

    @Test fun anUpdateThatLostTheHomeScreenSaysSoAndTheTapOpensCueHome() {
        Notifier.channels(c)
        HomeCheck().onReceive(c, Intent(Intent.ACTION_MY_PACKAGE_REPLACED))
        val posted = shadowOf(c.getSystemService(NotificationManager::class.java)).allNotifications
        val n = posted.single { it.extras.getString("android.title") == "Cue Home isn't your home screen" }
        val opens = shadowOf(n.contentIntent).savedIntent
        // As the launcher (the Home button's intent), not by class name, which would put it in Recents.
        assertEquals(c.packageName, opens.`package`)
        assertTrue(opens.hasCategory(Intent.CATEGORY_HOME))
        assertTrue(opens.getBooleanExtra("fix_home", false))

        Notifier.homeBack(c)
        assertTrue(shadowOf(c.getSystemService(NotificationManager::class.java)).allNotifications.none { it.extras.getString("android.title") == "Cue Home isn't your home screen" })
    }

    @Test fun aStoppedGuardSaysSoAndClearsOnceItsBack() {
        Notifier.channels(c)
        val nm = shadowOf(c.getSystemService(NotificationManager::class.java))
        HomeCheck.run(c)
        assertTrue(nm.allNotifications.any { it.extras.getString("android.title") == "Cue's guard is off" })
        android.provider.Settings.Secure.putString(c.contentResolver, android.provider.Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES, "${c.packageName}/.Guard")
        HomeCheck.run(c)
        assertTrue(nm.allNotifications.none { it.extras.getString("android.title") == "Cue's guard is off" })
    }

    @Test fun aSilentNoFromAndroidFallsBackToTheHomeAppSettingsPage() {
        val a = org.robolectric.Robolectric.buildActivity(HomeActivity::class.java,
            Intent(c, HomeActivity::class.java).putExtra("fix_home", true)).setup().get()
        // Opening from the notification asks even though this Home already asked once.
        assertTrue(shadowOf(a).nextStartedActivity != null)
        // Android answering "no" without showing anything: Settings' Home app page instead.
        a.homeAnswer(ASK_HOME)
        assertEquals(android.provider.Settings.ACTION_HOME_SETTINGS, shadowOf(a).nextStartedActivity?.action)
    }
}
