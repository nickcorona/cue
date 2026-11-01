package com.nickcorona.cue

import android.location.Location
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config as RConfig

@RunWith(RobolectricTestRunner::class)
@RConfig(sdk = [34])
class WhereTest {
    private val c get() = ApplicationProvider.getApplicationContext<android.content.Context>()
    private fun at(lat: Double, lon: Double, acc: Float = 20f) = Location("t").apply { latitude = lat; longitude = lon; accuracy = acc }

    @Test fun homeWithinAFewHundredMetresOutBeyond() {
        val home = at(43.6455, -79.3835)
        assertEquals("home", Where.place(home, at(43.6460, -79.3830)))       // ~70 m: same building
        assertEquals("out", Where.place(home, at(43.6532, -79.3832)))        // ~850 m: up the street
        // A rough fix (1 km accuracy) near home isn't called out.
        assertEquals("home", Where.place(home, at(43.6480, -79.3835, 1000f)))
    }

    @Test fun unknownUntilHomeIsSet() {
        Cue.prefs(c).edit().remove("home_lat").remove("home_lon").apply()
        assertNull(Where.now(c))
        Where.setHome(c, at(43.6455, -79.3835))
        assertEquals(43.6455, Where.home(c)!!.latitude, 1e-4)
    }
}
