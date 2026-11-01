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
        assertEquals(HomeActivity::class.java.name, opens.component?.className)
        assertTrue(opens.getBooleanExtra("fix_home", false))

        Notifier.homeBack(c)
        assertTrue(shadowOf(c.getSystemService(NotificationManager::class.java)).allNotifications.none { it.extras.getString("android.title") == "Cue Home isn't your home screen" })
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
