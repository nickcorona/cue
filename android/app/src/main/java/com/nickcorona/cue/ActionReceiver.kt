package com.nickcorona.cue

import android.app.RemoteInput
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import org.json.JSONObject
import kotlin.concurrent.thread

// Done, Start 25 min, Not now and Add, from the notification or the widget. Unlike a web
// notification, a native button doesn't collapse the shade, so the next item replaces this
// one silently and he can walk a routine from the shade.
class ActionReceiver : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) {
        val what = i.getStringExtra("what") ?: return
        val p = Ping.parse(JSONObject(i.getStringExtra("p") ?: return))
        val text = RemoteInput.getResultsFromIntent(i)?.getCharSequence("text")?.toString()
        val pending = goAsync()
        thread {
            try { handle(c.applicationContext, what, p, text) } finally { pending.finish() }
        }
    }

    private fun handle(c: Context, what: String, p: Ping, text: String?) {
        if (what == "capture") return capture(c, text)
        val now = p.isNow
        if (now) {
            when (what) {
                "done" -> Notifier.ack(c, "✓ Done", "Next one coming…")
                "start" -> Notifier.ack(c, "Starting 25 min…", p.title)
                "skip" -> Notifier.ack(c, "Skipped for today", "Next one coming…")
            }
            NowWidget.busy(c, if (what == "skip") "Skipped" else "✓ ${p.title}")
            if (what == "done") Undo.remember(c, p.check, p.title)
        }
        try {
            val api = Api(c)
            val r = when (what) {
                "done" -> api.push("check", JSONObject(p.check.toString()).put("now", now))
                "start" -> api.push("now_focus", p.start ?: return)
                "skip" -> api.push("now_skip", JSONObject().put("key", p.skip ?: return))
                else -> return
            }
            if (!now) { Notifier.cancel(c, p.tag); return }
            val next = r.optJSONObject("next")
            if (next == null) Notifier.cancelNow(c) else Notifier.show(c, Ping.parse(next), quiet = true)
            NowWidget.refresh(c, next)
        } catch (e: Exception) {
            if (now) Notifier.show(c, p, quiet = true) // put it back so the tap can be retried
            NowWidget.refresh(c)
            Notifier.note(c, "Couldn't do that", "Open Cue to tick it. (${e.message?.take(60)})", "cue-check-err")
        }
    }

    private fun capture(c: Context, text: String?) {
        // The reply field shows a spinner until the notification is posted again.
        Cue.lastNow(c)?.let { Notifier.show(c, Ping.parse(it), quiet = true) }
        if (text.isNullOrBlank()) return
        val msg = runCatching { Capture.send(c, text) }.getOrElse { "Couldn't save it: ${it.message?.take(60)}" }
        Notifier.note(c, "Captured", msg)
    }
}

object Capture {
    // Captures that couldn't reach the server (no signal in an elevator) wait on the phone and
    // go out on their own once there's a connection: when the network comes back, the screen
    // turns on, or Home refreshes. Only a "not signed in" or bad-request answer drops one.
    private const val QUEUE = "capture_queue"

    fun offline(e: Throwable) = e !is HttpError || e.code >= 500

    @Synchronized fun queue(c: Context, text: String) {
        val p = Cue.prefs(c)
        val a = runCatching { org.json.JSONArray(p.getString(QUEUE, "[]")) }.getOrDefault(org.json.JSONArray())
        p.edit().putString(QUEUE, a.put(text).toString()).apply()
    }

    fun waiting(c: Context) = runCatching { org.json.JSONArray(Cue.prefs(c).getString(QUEUE, "[]")).length() }.getOrDefault(0)

    // Blocking; call off the main thread.
    @Synchronized fun flush(c: Context) {
        val p = Cue.prefs(c)
        val a = runCatching { org.json.JSONArray(p.getString(QUEUE, "[]")) }.getOrDefault(org.json.JSONArray())
        if (a.length() == 0) return
        val left = org.json.JSONArray()
        val sent = mutableListOf<String>()
        for (i in 0 until a.length()) {
            val t = a.getString(i)
            runCatching { send(c, t) }.onSuccess { sent += it }.onFailure { if (offline(it)) left.put(t) }
        }
        p.edit().putString(QUEUE, left.toString()).apply()
        if (sent.isNotEmpty()) Notifier.note(c, if (sent.size == 1) "Captured" else "Captured ${sent.size}", sent.joinToString(" · "))
    }

    // Send one line to /capture; returns what Cue made of it, for a toast or a note.
    fun send(c: Context, text: String): String {
        val r = Api(c).post("/capture", null, JSONObject().put("text", text))
        val added = r.optJSONArray("added")
        val first = added?.optJSONObject(0)
        val listed = r.optJSONArray("listed")?.optJSONObject(0)
        return when {
            r.optBoolean("inbox") -> "Saved to inbox: ${first?.optString("title") ?: text}"
            first != null -> buildString {
                append(first.optString("title"))
                val bits = listOfNotNull(first.optInt("est_min").takeIf { it > 0 }?.let { "$it min" }, first.optString("project").takeIf { it.isNotEmpty() })
                if (bits.isNotEmpty()) append(" · ").append(bits.joinToString(" · "))
                if (added.length() > 1) append(" (+${added.length() - 1} more)")
            }
            listed != null -> "Added to ${listed.optString("list")}"
            else -> "Saved"
        }
    }
}
