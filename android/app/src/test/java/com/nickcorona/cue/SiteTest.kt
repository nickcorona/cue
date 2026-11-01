package com.nickcorona.cue

import android.content.ComponentName
import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config as RConfig

@RunWith(RobolectricTestRunner::class)
@RConfig(sdk = [34])
class SiteTest {
    private val c get() = ApplicationProvider.getApplicationContext<android.app.Application>()

    @Test fun subdomainsAreTheSameSiteOtherDomainsArent() {
        assertEquals(SiteActivity.siteOf("github.com"), SiteActivity.siteOf("gist.github.com"))
        assertEquals(SiteActivity.siteOf("github.com"), SiteActivity.siteOf("WWW.GitHub.com"))
        assertNotEquals(SiteActivity.siteOf("github.com"), SiteActivity.siteOf("www.bet365.com"))
    }

    @Test fun aChromeAddedAppOpensInTheSiteWindowWithItsTimeBox() {
        val pkg = "org.chromium.webapk.a1b2c3"
        val pm = shadowOf(c.packageManager)
        val comp = ComponentName(pkg, "org.chromium.webapk.shell_apk.MainActivity")
        pm.addActivityIfNotPresent(comp)
        pm.addIntentFilterForActivity(comp, IntentFilter(Intent.ACTION_MAIN).apply { addCategory(Intent.CATEGORY_LAUNCHER) })
        pm.getInternalMutablePackageInfo(pkg).applicationInfo!!.metaData = Bundle().apply {
            putString("org.chromium.webapk.shell_apk.startUrl", "https://github.com/")
        }
        assertEquals("https://github.com/", SiteActivity.startUrl(c, pkg))
        assertNull(SiteActivity.startUrl(c, "com.github.android"))

        val until = System.currentTimeMillis() + 5 * 60_000
        c.launch(pkg, until)
        val started = shadowOf(c).nextStartedActivity
        assertEquals(SiteActivity::class.java.name, started.component?.className)
        assertEquals("https://github.com/", started.getStringExtra("url"))
        assertEquals(until, started.getLongExtra("until", 0))
    }
}
