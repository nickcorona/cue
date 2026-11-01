package com.nickcorona.cue

import android.app.Activity
import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.graphics.Typeface
import android.provider.Settings
import android.view.View
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

// Shared bits for the dumbphone screens (Home, Unlock, Rules): plain text on black.
const val BG = 0xFF000000.toInt()
const val FG = 0xFFECEDEF.toInt()
const val DIM = 0xFF7A7E86.toInt()
const val FOCUS = 0xFF7CF2C0.toInt()

data class App(val label: String, val pkg: String)

fun Context.dp(v: Int) = (v * resources.displayMetrics.density).toInt()

fun Context.text(s: String, size: Float = 18f, color: Int = FG, onClick: (() -> Unit)? = null) = TextView(this).apply {
    text = s
    textSize = size
    setTextColor(color)
    typeface = Typeface.create("sans-serif-light", Typeface.NORMAL)
    setPadding(0, dp(8), 0, dp(8))
    onClick?.let { f -> setOnClickListener { f() } }
}

fun Activity.page(build: LinearLayout.() -> Unit) {
    val col = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(28), dp(48), dp(28), dp(36))
        build()
    }
    setContentView(ScrollView(this).apply { setBackgroundColor(BG); addView(col) })
}

fun LinearLayout.gap(h: Int = 24) = addView(View(context), LinearLayout.LayoutParams(1, context.dp(h)))

fun Context.launchable(): List<App> =
    packageManager.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER), 0)
        .map { App(it.loadLabel(packageManager).toString(), it.activityInfo.packageName) }
        .filter { it.pkg != packageName }
        .distinctBy { it.pkg }
        .sortedBy { it.label.lowercase() }

fun Context.launch(pkg: String) {
    packageManager.getLaunchIntentForPackage(pkg)?.let { startActivity(it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
}

// Android's own "make this the home app?" prompt; falls back to the settings page once it stops
// showing (Android hides it after a couple of declines).
fun Activity.askToBeHome() {
    val roles = getSystemService(RoleManager::class.java)
    if (roles != null && roles.isRoleAvailable(RoleManager.ROLE_HOME) && !roles.isRoleHeld(RoleManager.ROLE_HOME))
        startActivityForResult(roles.createRequestRoleIntent(RoleManager.ROLE_HOME), 1)
    else startActivity(Intent(Settings.ACTION_HOME_SETTINGS))
}

fun Context.isHome() = getSystemService(RoleManager::class.java)?.isRoleHeld(RoleManager.ROLE_HOME) == true

fun hours(ms: Long) = "${(ms / 3_600_000).coerceAtLeast(0)}h ${(ms / 60_000 % 60).coerceAtLeast(0)}m"
