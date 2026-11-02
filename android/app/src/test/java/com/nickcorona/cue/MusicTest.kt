package com.nickcorona.cue

import org.junit.Assert.assertEquals
import org.junit.Test

class MusicTest {
    @Test fun songTitlesLoseTheirTags() {
        assertEquals("DANCE...", Music.plain("DANCE... - Edit"))
        assertEquals("Hey Jude", Music.plain("Hey Jude - Remastered 2015"))
        assertEquals("Levitating", Music.plain("Levitating (feat. DaBaby)"))
        assertEquals("Live Wire", Music.plain("Live Wire"))
        assertEquals("Song - Part 2", Music.plain("Song - Part 2"))
    }
}
