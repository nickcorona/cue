package com.nickcorona.cue

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.content.res.ColorStateList
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout

// What's playing, as one quiet line above the tools: song · artist, then like (when the player
// offers it), back, pause/play and next. With nothing playing, a Spotify DJ line whose play
// starts DJ in the background, without opening Spotify.
// Any player (Spotify, YouTube Music, a podcast app) through its media session; reading them
// rides on the notification access Cue already has for the filter. Paused, only Spotify shows.
class Music(private val c: Context, private val box: LinearLayout) {
    private val sessions = c.getSystemService(MediaSessionManager::class.java)
    private val listener = ComponentName(c, Quiet::class.java)
    private val main = Handler(Looper.getMainLooper())
    private var watched: MediaController? = null
    private var failed = false
    private var logged = ""
    private var wantDj = 0L
    private val onChange = object : MediaController.Callback() {
        override fun onMetadataChanged(metadata: MediaMetadata?) = show()
        override fun onPlaybackStateChanged(state: PlaybackState?) = show()
        override fun onSessionDestroyed() = show()
    }
    private val onSessions = MediaSessionManager.OnActiveSessionsChangedListener { show() }

    companion object {
        const val SPOTIFY = "com.spotify.music"
        val LIKE = Regex("like|heart|favou?rite|save|add to|collection|library", RegexOption.IGNORE_CASE)
        // Thumbs down and playlists aren't the heart.
        val NOT_LIKE = Regex("dislike|thumbs? ?down|playlist", RegexOption.IGNORE_CASE)
        fun isLike(s: String) = LIKE.containsMatchIn(s) && !NOT_LIKE.containsMatchIn(s)
        // "Remove from Liked Songs", Spotify's REMOVE_FROM_COLLECTION, or a bare "Liked"; "Add to
        // Liked Songs" is the not-yet-liked one.
        val LIKED = Regex("remove|unlike|unsave|unheart|^(liked|saved|added)", RegexOption.IGNORE_CASE)

        // "Song - Radio Edit", "Song (feat. X)", "Song - 2011 Remaster": just the song.
        val EXTRA = Regex("""\s*(\s-\s.*\b(edit|remaster(ed)?|version|mix|live|mono|stereo)\b.*|\((feat|with|ft)\.?\s[^)]*\)|\[[^\]]*\])\s*$""", RegexOption.IGNORE_CASE)

        fun plain(title: String) = title.replace(EXTRA, "").ifBlank { title }

        data class Player(val pkg: String, val playing: Boolean)

        // Which session the line shows: whatever is playing (Spotify first if two are); with
        // nothing playing, only Spotify paused, so play resumes it. Another app's paused leftover
        // (a YouTube video watched earlier) isn't music he's listening to: the line falls back
        // to Spotify DJ instead of showing it and opening YouTube on a tap.
        fun pick(players: List<Player>): Int? =
            players.indices.filter { players[it].playing }.minByOrNull { if (players[it].pkg == SPOTIFY) 0 else 1 }
                ?: players.indexOfFirst { it.pkg == SPOTIFY }.takeIf { it >= 0 }
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
        val mc = pick(playing.map { Player(it.packageName.orEmpty(), it.playbackState?.state == PlaybackState.STATE_PLAYING) })?.let { playing[it] }
        if (mc != watched) {
            watched?.unregisterCallback(onChange)
            mc?.registerCallback(onChange, main)
            watched = mc
        }
        box.removeAllViews()
        if (mc == null) return idle()
        box.visibility = View.VISIBLE
        val m = mc.metadata!!
        val song = listOfNotNull(m.getString(MediaMetadata.METADATA_KEY_TITLE)?.let(::plain), m.getString(MediaMetadata.METADATA_KEY_ARTIST)).joinToString(" · ")
        val on = mc.playbackState?.state == PlaybackState.STATE_PLAYING
        box.addView(c.text("♪  $song", 14f, DIM) { openPlayer(mc) }.apply {
            maxLines = 1
            ellipsize = android.text.TextUtils.TruncateAt.END
        }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        // Spotify (and others) offer liking the song as a custom action; its name or id flips once liked.
        val actions = mc.playbackState?.customActions.orEmpty()
        // Started from the DJ line: once Spotify's session is up, switch it to DJ.
        if (wantDj > System.currentTimeMillis() - 30_000 && mc.packageName == SPOTIFY) actions.firstOrNull { it.action == "SUMMON_DJ" }?.let {
            wantDj = 0
            mc.transportControls.sendCustomAction(it, null)
        }
        val seen = actions.joinToString { "${it.name}=${it.action}" }
        if (seen != logged) { logged = seen; Diag.log(c, "music actions ${mc.packageName}: ${seen.take(300)}") }
        actions.firstOrNull { isLike(it.name.toString()) || isLike(it.action) }?.let { a ->
            val liked = LIKED.containsMatchIn(a.name.toString()) || LIKED.containsMatchIn(a.action)
            box.addView(icon(if (liked) R.drawable.ic_heart else R.drawable.ic_heart_line, if (liked) ACCENT else DIM, if (liked) "Liked" else "Like") {
                mc.transportControls.sendCustomAction(a, null)
            })
        }
        box.addView(icon(R.drawable.ic_prev, DIM, "Back") { mc.transportControls.skipToPrevious() })
        box.addView(icon(if (on) R.drawable.ic_pause else R.drawable.ic_play, MID, if (on) "Pause" else "Play") {
            if (on) mc.transportControls.pause() else resume(mc)
        })
        box.addView(icon(R.drawable.ic_next, DIM, "Next") { mc.transportControls.skipToNext() })
    }

    // Nothing playing: Spotify DJ, if Spotify is installed. Play is a media button sent straight
    // to Spotify, which starts playback in the background; the DJ switch happens in show().
    private fun idle() {
        if (c.packageManager.getLaunchIntentForPackage(SPOTIFY) == null) { box.visibility = View.GONE; return }
        box.visibility = View.VISIBLE
        box.addView(c.text("♪  Spotify DJ", 14f, DIM) { c.launch(SPOTIFY) }, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        box.addView(icon(R.drawable.ic_play, MID, "Play DJ") {
            wantDj = System.currentTimeMillis()
            appKey(SPOTIFY)
            // If Spotify's receiver didn't take it, the system's last media app gets the key.
            main.postDelayed({ if (wantDj != 0L && watched == null) systemKey() }, 2500)
        })
    }

    // Play on a paused session. A player left in the background a while (Spotify's "Up next ·
    // DJ X") often ignores the session's play, so the tap did nothing: if it isn't playing
    // 1.5 s later, the app gets a play key of its own, then the system's, and the log says which took.
    private fun resume(mc: MediaController) {
        val pkg = mc.packageName
        fun playing() = sessions?.let { runCatching { it.getActiveSessions(listener) }.getOrNull() }.orEmpty()
            .any { it.packageName == pkg && it.playbackState?.state == PlaybackState.STATE_PLAYING }
        mc.transportControls.play()
        main.postDelayed({
            if (playing()) return@postDelayed
            appKey(pkg)
            main.postDelayed({
                if (playing()) { Diag.log(c, "music play: $pkg needed its own play key"); return@postDelayed }
                systemKey()
                main.postDelayed({ Diag.log(c, "music play: $pkg " + if (playing()) "needed the system play key" else "didn't start") }, 1500)
            }, 1500)
        }, 1500)
    }

    // The player's own "now playing" screen (the session's activity: Spotify's full-screen
    // player with the song), not the app's home with the song minimised at the bottom.
    private fun openPlayer(mc: MediaController) {
        val pi = mc.sessionActivity ?: return c.launch(mc.packageName)
        val opts = if (android.os.Build.VERSION.SDK_INT >= 34) android.app.ActivityOptions.makeBasic()
            .setPendingIntentBackgroundActivityStartMode(android.app.ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED).toBundle() else null
        runCatching { pi.send(c, 0, null, null, null, null, opts) }.onFailure {
            Diag.log(c, "music open: ${it.javaClass.simpleName}")
            c.launch(mc.packageName)
        }
    }

    private fun appKey(pkg: String) {
        for (a in listOf(KeyEvent.ACTION_DOWN, KeyEvent.ACTION_UP)) c.sendBroadcast(Intent(Intent.ACTION_MEDIA_BUTTON).setPackage(pkg)
            .putExtra(Intent.EXTRA_KEY_EVENT, KeyEvent(a, KeyEvent.KEYCODE_MEDIA_PLAY)))
    }

    private fun systemKey() {
        val am = c.getSystemService(AudioManager::class.java)
        am.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_MEDIA_PLAY))
        am.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_MEDIA_PLAY))
    }

    private fun icon(res: Int, color: Int, what: String, onClick: () -> Unit) = ImageView(c).apply {
        setImageResource(res)
        imageTintList = ColorStateList.valueOf(color)
        contentDescription = what
        setPadding(c.dp(12), c.dp(12), c.dp(12), c.dp(12))
        layoutParams = LinearLayout.LayoutParams(c.dp(48), c.dp(48))
        setOnClickListener { onClick() }
    }
}
