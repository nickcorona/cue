package com.nickcorona.cue

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MusicTest {
    @Test fun songTitlesLoseTheirTags() {
        assertEquals("DANCE...", Music.plain("DANCE... - Edit"))
        assertEquals("Hey Jude", Music.plain("Hey Jude - Remastered 2015"))
        assertEquals("Levitating", Music.plain("Levitating (feat. DaBaby)"))
        assertEquals("Live Wire", Music.plain("Live Wire"))
        assertEquals("Song - Part 2", Music.plain("Song - Part 2"))
    }

    @Test fun likedSongsAreToldApart() {
        val liked = listOf("Remove from Liked Songs", "com.spotify.music.REMOVE_FROM_COLLECTION", "Liked", "Unlike")
        val notYet = listOf("Add to Liked Songs", "com.spotify.music.ADD_TO_COLLECTION", "Like", "Save to library")
        (liked + notYet).forEach { assertTrue(it, Music.LIKE.containsMatchIn(it)) }
        liked.forEach { assertTrue(it, Music.LIKED.containsMatchIn(it)) }
        notYet.forEach { assertFalse(it, Music.LIKED.containsMatchIn(it)) }
    }
}
