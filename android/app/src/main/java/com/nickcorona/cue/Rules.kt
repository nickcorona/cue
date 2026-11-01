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
import java.util.Calendar

// Dumbphone mode's rules. Tightening is instant; once locked, anything that loosens them waits
// DELAY_MS, so a craving has to survive a day before it gets its way.
const val DELAY_MS = 24 * 60 * 60 * 1000L

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

    fun allow(pkg: String) = loosen("allow", pkg) { it.putStringSet("allowed", allowed() + pkg) }

    fun block(pkg: String) {
        p.edit().putStringSet("allowed", allowed() - pkg).apply()
        cancel("allow", pkg)
    }

    fun turnGuardOff() = loosen("guard_off", "") { it.putBoolean("guard", false).putBoolean("locked", false) }

    fun cancel(op: String, arg: String) = savePending(pending().filterNot { it.op == op && it.arg == arg })

    fun isAllowed(pkg: String) = !guardOn() || pkg in always() || pkg in allowed() || unlockedUntil(pkg) > now()

    // Never touched: Cue, the system shell, the keyboard, calls, and Settings (which the guard
    // watches for Cue's name instead, see Guard).
    fun always(): Set<String> = setOfNotNull(
        c.packageName, "android", "com.android.systemui", "com.android.server.telecom",
        c.getSystemService(TelecomManager::class.java)?.defaultDialerPackage,
        Settings.Secure.getString(c.contentResolver, Settings.Secure.DEFAULT_INPUT_METHOD)?.substringBefore('/'),
    ) + PROTECTED

    fun unlock(pkg: String, minutes: Int, reason: String) {
        val t = now()
        p.edit().putString("unlock_pkg", pkg).putLong("unlock_until", t + minutes * 60_000L)
            .putStringSet("log", log() + "$t|$pkg|$minutes|${reason.trim().replace(Regex("\\s+"), " ")}").apply()
    }

    fun unlockedUntil(pkg: String) = if (p.getString("unlock_pkg", null) == pkg) p.getLong("unlock_until", 0) else 0

    fun log(): Set<String> = p.getStringSet("log", emptySet())!!.toSet()

    fun unlocksToday(): Int {
        val midnight = Calendar.getInstance().apply {
            timeInMillis = now()
            set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
        }.timeInMillis
        return log().count { it.substringBefore('|').toLong() >= midnight }
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
        val e = p.edit()
        val allowed = p.getStringSet("allowed", emptySet())!!.toMutableSet()
        for (d in due) when (d.op) {
            "allow" -> allowed += d.arg
            "guard_off" -> e.putBoolean("guard", false).putBoolean("locked", false)
        }
        e.putStringSet("allowed", allowed).putStringSet("pending", later.map { it.toString() }.toSet()).apply()
    }

    companion object {
        var clock: () -> Long = System::currentTimeMillis

        val PROTECTED = setOf(
            "com.android.settings",
            "com.google.android.permissioncontroller",
            "com.android.permissioncontroller",
            "com.google.android.packageinstaller",
            "com.android.packageinstaller",
        )

        // The starting list: phone, messages, camera, clock, maps. Tools, not feeds.
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
