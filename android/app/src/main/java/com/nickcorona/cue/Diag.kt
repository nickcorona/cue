package com.nickcorona.cue

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

// A short log of what happens to the home screen and the guard. Both can go wrong at random and
// only on the phone, so the log goes to the server, where it can be read from anywhere (the
// settings tool shows it).
object Diag {
    @Synchronized
    fun log(c: Context, event: String) {
        val p = Cue.prefs(c)
        val a = runCatching { JSONArray(p.getString("diag", "[]")) }.getOrDefault(JSONArray())
        a.put(JSONObject().put("at", System.currentTimeMillis()).put("e", event))
        while (a.length() > 100) a.remove(0)
        p.edit().putString("diag", a.toString()).apply()
    }

    // Blocking: off the main thread. Only what was sent gets cleared.
    fun flush(c: Context) {
        val sent = synchronized(this) { Cue.prefs(c).getString("diag", null) } ?: return
        val a = JSONArray(sent)
        if (a.length() == 0 || Cue.key(c) == null) return
        runCatching { Api(c).push("diag", JSONObject().put("events", a).put("app", BuildConfig.VERSION_NAME)) }.onSuccess {
            synchronized(this) {
                val p = Cue.prefs(c)
                val now = runCatching { JSONArray(p.getString("diag", "[]")) }.getOrDefault(JSONArray())
                val rest = JSONArray()
                for (i in a.length() until now.length()) rest.put(now.get(i))
                p.edit().putString("diag", rest.toString()).apply()
            }
        }
    }
}
