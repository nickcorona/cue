package com.nickcorona.cue

import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.AlarmClock
import android.provider.MediaStore
import android.provider.Settings
import android.provider.Telephony
import android.telecom.TelecomManager
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

// Dumbphone mode's rules. Tightening is instant; once locked, anything that loosens them waits
// DELAY_MS, so a craving has to survive a day before it gets its way.
const val DELAY_MS = 24 * 60 * 60 * 1000L

data class Unlocked(val at: Long, val pkg: String, val minutes: Int, val reason: String)

data class Pending(val at: Long, val op: String, val arg: String) {
    override fun toString() = "$at|$op|$arg"
}

class Rules(private val c: Context) {
    private val p = c.getSharedPreferences("rules", Context.MODE_PRIVATE)
    private fun now() = clock()

    val locked: Boolean
        get() {
            settle()
            return p.getBoolean("locked", false)
        }

    fun lock() = p.edit().putBoolean("locked", true).putBoolean("guard", true).apply()

    fun guardOn(): Boolean {
        settle()
        return p.getBoolean("guard", true)
    }

    fun allowed(): Set<String> {
        settle()
        if (!p.contains("allowed")) p.edit().putStringSet("allowed", defaultTools(c)).apply()
        return p.getStringSet("allowed", emptySet())!!.toSet()
    }

    fun pending(): List<Pending> = p.getStringSet("pending", emptySet())!!.map {
        val (at, op, arg) = it.split("|", limit = 3)
        Pending(at.toLong(), op, arg)
    }.sortedBy { it.at }

    // Four levels, loosest first. Home: on the home screen. Drawer: on the A-Z strip only, opens
    // freely. Gated: opens only through Unlock (reason, wait, time box). Off: never opens.
    // Moving an app to a looser level is a loosening (24h once locked); tighter is instant.
    // Pre-approved apps are never stricter than Drawer, whatever was set: the ones named in
    // ESSENTIAL, and whatever app does each of the phone's basic jobs (see tools). Not every
    // system app: Chrome, YouTube and the Play Store are system apps too.
    val essential: Set<String> by lazy { ESSENTIAL + tools(c) }

    fun level(pkg: String): Int = when (pkg) {
        in allowed() -> HOME
        in essential -> DRAWER
        in p.getStringSet("drawer", emptySet())!! -> DRAWER
        in p.getStringSet("off", emptySet())!! -> OFF
        else -> GATED
    }

    fun drawer(): Set<String> {
        settle()
        return p.getStringSet("drawer", emptySet())!!.toSet() + essential - allowed()
    }

    fun pendingLevel(pkg: String): Int? =
        pending().firstOrNull { it.op == "level" && it.arg.substringBefore('=') == pkg }?.arg?.substringAfter('=')?.toInt()
            ?: if (pending().any { it.op == "allow" && it.arg == pkg }) HOME else null

    fun setLevel(pkg: String, to: Int) {
        if (pkg in essential && to > DRAWER) return
        val from = level(pkg)
        savePending(pending().filterNot { (it.op == "level" && it.arg.substringBefore('=') == pkg) || (it.op == "allow" && it.arg == pkg) })
        if (to == from) return
        if (to > from) p.edit().also { place(it, pkg, to) }.apply()
        else loosen("level", "$pkg=$to") { place(it, pkg, to) }
    }

    fun allow(pkg: String) = setLevel(pkg, HOME)

    fun block(pkg: String) = setLevel(pkg, GATED)

    private fun place(e: SharedPreferences.Editor, pkg: String, to: Int) {
        val sets = mapOf(HOME to "allowed", DRAWER to "drawer", OFF to "off")
        for ((lvl, key) in sets) {
            val cur = p.getStringSet(key, if (key == "allowed") allowed() else emptySet())!!.toMutableSet()
            if (lvl == to) cur += pkg else cur -= pkg
            e.putStringSet(key, cur)
        }
    }

    fun turnGuardOff() = loosen("guard_off", "") { it.putBoolean("guard", false).putBoolean("locked", false) }

    fun cancel(op: String, arg: String) = savePending(pending().filterNot { it.op == op && it.arg == arg })

    fun isAllowed(pkg: String) = !guardOn() || pkg in always() || pkg in allowed() || pkg in drawer() ||
        (unlockedUntil(pkg) > now() && level(pkg) == GATED)

    // Never touched: Cue, the system shell, the keyboard, calls, and Settings (which the guard
    // watches for Cue's name instead, see Guard).
    fun always(): Set<String> = setOfNotNull(
        c.packageName, "android", "com.android.systemui", "com.android.server.telecom",
        c.getSystemService(TelecomManager::class.java)?.defaultDialerPackage,
        Settings.Secure.getString(c.contentResolver, Settings.Secure.DEFAULT_INPUT_METHOD)?.substringBefore('/'),
    ) + PROTECTED + SYSTEM

    // Each app keeps its own time box: unlocking Chrome for a link out of YouTube used to end
    // the YouTube unlock (one slot for all apps), so going back asked again. Ended ones stay a
    // day so a just-expired unlock can still say "time's up".
    fun unlock(pkg: String, minutes: Int, reason: String) {
        val t = now()
        val keep = unlocks().filter { (k, until) -> k != pkg && until > t - DELAY_MS }.map { (k, until) -> "$k|$until" }
        p.edit().putStringSet("unlocks", (keep + "$pkg|${t + minutes * 60_000L}").toSet()).remove("unlock_pkg").remove("unlock_until")
            .putStringSet("log", log() + "$t|$pkg|$minutes|${reason.trim().replace(Regex("\\s+"), " ")}").apply()
    }

    private fun unlocks(): Map<String, Long> {
        val m = p.getStringSet("unlocks", emptySet())!!.mapNotNull { e -> e.substringBeforeLast('|').takeIf { it.isNotEmpty() }?.let { it to (e.substringAfterLast('|').toLongOrNull() ?: 0L) } }.toMap().toMutableMap()
        // The one-slot unlock from before, until it's replaced.
        p.getString("unlock_pkg", null)?.let { old -> if (old !in m) m[old] = p.getLong("unlock_until", 0) }
        return m
    }

    fun unlockedUntil(pkg: String) = unlocks()[pkg] ?: 0L

    fun log(): Set<String> = p.getStringSet("log", emptySet())!!.toSet()

    // An unlock that just ran out (the last few minutes), as opposed to an app opened fresh.
    fun expired(pkg: String) = unlockedUntil(pkg).let { it in now() - 5 * 60_000L..now() }

    fun unlocksToday() = todaysLog().size

    fun todaysLog(): List<Unlocked> {
        val midnight = Calendar.getInstance().apply {
            timeInMillis = now()
            set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
        }.timeInMillis
        return log().map { it.split("|", limit = 4) }.filter { it.size == 4 && it[0].toLong() >= midnight }
            .map { Unlocked(it[0].toLong(), it[1], it[2].toInt(), it[3]) }.sortedBy { it.at }
    }

    // Every rule as JSON, so the server can hold a copy (see sync). Typed, so it comes back as it went.
    fun snapshot(): JSONObject = JSONObject().also { j ->
        for ((k, v) in p.all) when (v) {
            is Boolean -> j.put(k, JSONObject().put("b", v))
            is String -> j.put(k, JSONObject().put("s", v))
            is Long -> j.put(k, JSONObject().put("l", v))
            is Int -> j.put(k, JSONObject().put("i", v))
            is Set<*> -> j.put(k, JSONObject().put("set", JSONArray(v.map { it.toString() })))
        }
    }

    fun restore(j: JSONObject) {
        val e = p.edit().clear()
        for (k in j.keys()) {
            val v = j.optJSONObject(k) ?: continue
            when {
                v.has("b") -> e.putBoolean(k, v.getBoolean("b"))
                v.has("s") -> e.putString(k, v.getString("s"))
                v.has("l") -> e.putLong(k, v.getLong("l"))
                v.has("i") -> e.putInt(k, v.getInt("i"))
                v.has("set") -> v.getJSONArray("set").let { a -> e.putStringSet(k, (0 until a.length()).map { a.getString(it) }.toSet()) }
            }
        }
        e.commit()
    }

    private fun loosen(op: String, arg: String, apply: (SharedPreferences.Editor) -> Unit) {
        if (!locked) {
            p.edit().also(apply).apply()
            return
        }
        if (pending().none { it.op == op && it.arg == arg }) savePending(pending() + Pending(now() + DELAY_MS, op, arg))
    }

    private fun savePending(list: List<Pending>) = p.edit().putStringSet("pending", list.map { it.toString() }.toSet()).apply()

    private fun settle() {
        val (due, later) = pending().partition { it.at <= now() }
        if (due.isEmpty()) return
        savePending(later)
        val e = p.edit()
        for (d in due) when (d.op) {
            "allow" -> place(e, d.arg, HOME).also { e.apply() }
            "level" -> place(e, d.arg.substringBefore('='), d.arg.substringAfter('=').toInt()).also { e.apply() }
            "guard_off" -> e.putBoolean("guard", false).putBoolean("locked", false)
        }
        e.apply()
    }

    companion object {
        const val HOME = 0
        const val DRAWER = 1
        const val GATED = 2
        const val OFF = 3
        val LEVELS = listOf("Home", "A–Z", "Gated", "Off")

        // Tools he needs at any moment, so they can never be blocked by mistake: they open freely
        // (Drawer at least) whatever the rules say. The authenticators and banks are there so a
        // login code or a payment is never stuck behind the gate; the ones not installed don't matter.
        val ESSENTIAL = setOf("com.anthropic.claude", "com.spotify.music", "com.whatsapp",
            "com.google.android.apps.authenticator2", "com.authy.authy", "com.azure.authenticator",
            "com.rbc.mobile.android", "com.td", "com.scotiabank.banking", "com.bmo.mobile",
            "com.cibc.android.mobi", "ca.tangerine.clients.banking.app", "com.neofinancial.neo",
            "com.google.android.googlequicksearchbox")

        var clock: () -> Long = System::currentTimeMillis

        // The rules live only on the phone, so a reinstall wiped them (and the lock with them).
        // The server keeps a copy: a fresh install puts it back the first time it can reach the
        // server, then every change is sent. Nothing is sent until that first check has worked,
        // so a fresh install's defaults never overwrite the copy. Blocking: off the main thread.
        // True when rules were just restored, so Home redraws.
        fun sync(c: Context): Boolean {
            val api = Api(c)
            val cp = Cue.prefs(c)
            val r = Rules(c)
            var restored = false
            if (!cp.getBoolean("rules_checked", false)) {
                val saved = api.get("/push", "rules").optJSONObject("rules")
                saved?.optJSONObject("prefs")?.let {
                    r.restore(it)
                    restored = true
                    Diag.log(c, "rules restored from the server (saved ${saved.optString("at")})")
                }
                cp.edit().putBoolean("rules_checked", true).commit()
            }
            val snap = r.snapshot().toString()
            if (snap != cp.getString("rules_sent", null)) {
                api.push("rules", JSONObject().put("prefs", JSONObject(snap)))
                cp.edit().putString("rules_sent", snap).apply()
            }
            return restored
        }

        // Parts of Android that open on their own or on another app's behalf, not apps he goes
        // to: Digital Wellbeing (bedtime mode, app timers), Google sign-in and account pickers,
        // the file and photo pickers, and the share sheet (Android 14+ moved it out of "android").
        val SYSTEM = setOf(
            "com.google.android.apps.wellbeing",
            "com.google.android.gms",
            "com.google.android.gsf",
            "com.google.android.documentsui",
            "com.android.documentsui",
            "com.google.android.providers.media.module",
            "com.android.providers.media.module",
            "com.google.android.photopicker",
            "com.android.intentresolver",
            "com.google.android.ext.services",
        )

        val PROTECTED = setOf(
            "com.android.settings",
            "com.google.android.permissioncontroller",
            "com.android.permissioncontroller",
            "com.google.android.packageinstaller",
            "com.android.packageinstaller",
        )

        // The starting list: phone, messages, camera, clock, maps. Tools, not feeds.
        // The apps doing the phone's basic jobs, found by what they do so a switch of dialer or
        // camera carries over: the starting tools plus contacts, calculator, calendar and files.
        fun tools(c: Context): Set<String> = Apps.tools(c) { findTools(c) }

        private fun findTools(c: Context): Set<String> {
            fun all(category: String) = c.packageManager.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(category), 0)
                .map { it.activityInfo.packageName }
            val contacts = c.packageManager.resolveActivity(Intent(Intent.ACTION_VIEW, android.provider.ContactsContract.Contacts.CONTENT_URI), PackageManager.MATCH_DEFAULT_ONLY)
                ?.activityInfo?.packageName
            return defaultTools(c) + setOfNotNull(contacts).filter { it != "android" } +
                all(Intent.CATEGORY_APP_CALCULATOR) + all(Intent.CATEGORY_APP_CALENDAR) + all(Intent.CATEGORY_APP_FILES)
        }

        fun defaultTools(c: Context): Set<String> {
            fun handler(i: Intent) =
                c.packageManager.resolveActivity(i, PackageManager.MATCH_DEFAULT_ONLY)?.activityInfo?.packageName
            return setOfNotNull(
                c.getSystemService(TelecomManager::class.java)?.defaultDialerPackage,
                Telephony.Sms.getDefaultSmsPackage(c),
                handler(Intent(MediaStore.ACTION_IMAGE_CAPTURE)),
                handler(Intent(AlarmClock.ACTION_SHOW_ALARMS)),
                handler(Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=home"))),
            ).filter { it != "android" }.toSet()
        }
    }
}
