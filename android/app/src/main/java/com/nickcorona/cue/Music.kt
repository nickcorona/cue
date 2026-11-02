package com.nickcorona.cue

import android.content.ComponentName
import android.content.Context
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.LinearLayout

// What's playing, as one quiet line above the tools: song · artist, then like (when the player
// offers it), pause/play and next.
// Any player (Spotify, YouTube Music, a podcast app) through its media session; reading them
// rides on the notification access Cue already has for the filter. Hidden when nothing plays.
class Music(private val c: Context, private val box: LinearLayout) {
    private val sessions = c.getSystemService(MediaSessionManager::class.java)
    private val listener = ComponentName(c, Quiet::class.java)
    private val main = Handler(Looper.getMainLooper())
    private var watched: MediaController? = null
    private var failed = false
    private val onChange = object : MediaController.Callback() {
        override fun onMetadataChanged(metadata: MediaMetadata?) = show()
        override fun onPlaybackStateChanged(state: PlaybackState?) = show()
        override fun onSessionDestroyed() = show()
    }
    private val onSessions = MediaSessionManager.OnActiveSessionsChangedListener { show() }

    private companion object {
        val LIKE = Regex("like|heart|favou?rite|save|add to", RegexOption.IGNORE_CASE)
        // "Remove from Liked Songs" or a bare "Liked"; "Add to Liked Songs" is the not-yet-liked one.
        val LIKED = Regex("^(remove|unlike|liked|saved|added)", RegexOption.IGNORE_CASE)
    }

    fun start() {
        runCatching { sessions?.addOnActiveSessionsChangedListener(onSessions, listener, main) }
        show()
    }

    fun stop() {
        runCatching { sessions?.removeOnActiveSessionsChangedListener(onSessions) }
        watched?.unregisterCallback(onChange)
        watched = null
    }

    fun show() {
        val playing = runCatching { sessions?.getActiveSessions(listener) }
            .onFailure { if (!failed) { failed = true; Diag.log(c, "music line: ${it.javaClass.simpleName} ${it.message?.take(120)}") } }
            .getOrNull().orEmpty()
            .filter { it.metadata?.getString(MediaMetadata.METADATA_KEY_TITLE) != null }
            .sortedByDescending { it.playbackState?.state == PlaybackState.STATE_PLAYING }
        val mc = playing.firstOrNull()
        if (mc != watched) {
            watched?.unregisterCallback(onChange)
            mc?.registerCallback(onChange, main)
            watched = mc
        }
        box.removeAllViews()
        box.visibility = if (mc == null) View.GONE else View.VISIBLE
        mc ?: return
        val m = mc.metadata!!
        val song = listOfNotNull(m.getString(MediaMetadata.METADATA_KEY_TITLE), m.getString(MediaMetadata.METADATA_KEY_ARTIST)).joinToString(" · ")
        val on = mc.playbackState?.state == PlaybackState.STATE_PLAYING
        box.addView(c.text("♪  $song", 15f, MID) { c.launch(mc.packageName) }.apply {
            maxLines = 1
            ellipsize = android.text.TextUtils.TruncateAt.END
        }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        // Spotify (and others) offer liking the song as a custom action; its name flips once liked.
        mc.playbackState?.customActions?.firstOrNull { LIKE.containsMatchIn(it.name.toString()) || LIKE.containsMatchIn(it.action) }?.let { a ->
            val liked = LIKED.containsMatchIn(a.name.toString()) || LIKED.containsMatchIn(a.action)
            box.addView(c.text(if (liked) "♥" else "♡", 17f, if (liked) ACCENT else MID) {
                mc.transportControls.sendCustomAction(a, null)
            }.apply { setPadding(c.dp(16), c.dp(8), 0, c.dp(8)) })
        }
        box.addView(c.text(if (on) "pause" else "play", 15f, FG) {
            if (on) mc.transportControls.pause() else mc.transportControls.play()
        }.apply { setPadding(c.dp(16), c.dp(8), c.dp(8), c.dp(8)) })
        box.addView(c.text("next", 15f, DIM) { mc.transportControls.skipToNext() }.apply { setPadding(c.dp(12), c.dp(8), 0, c.dp(8)) })
    }
}
