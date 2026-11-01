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

// Shared bits for the dumbphone screens (Home, More, Unlock, Rules, Capture): type on black,
// no icons. Structure comes from small all-caps labels; the one accent colour marks the main
// action (Done, Open, Lock it in) and focus, red marks Off, everything else is white or grey.
const val BG = 0xFF000000.toInt()
const val FG = 0xFFECEDEF.toInt()
const val MID = 0xFFB9BCC2.toInt()
const val DIM = 0xFF8A8E96.toInt()
const val FAINT = 0xFF2A2C31.toInt()
const val FAINT_TEXT = 0xFF4A4D53.toInt()
const val ACCENT = 0xFF7CF2C0.toInt()
const val FOCUS = ACCENT
const val RED = 0xFFE07A6F.toInt()
const val SHEET = 0xFF111215.toInt()

data class App(val label: String, val pkg: String)

fun Context.dp(v: Int) = (v * resources.displayMetrics.density).toInt()

// Light for big type, regular below 20sp where light gets thin and hard to read in grey.
fun Context.text(s: String, size: Float = 18f, color: Int = FG, onClick: (() -> Unit)? = null) = TextView(this).apply {
    text = s
    textSize = size
    setTextColor(color)
    typeface = Typeface.create(if (size >= 20f) "sans-serif-light" else "sans-serif", Typeface.NORMAL)
    setPadding(0, dp(8), 0, dp(8))
    onClick?.let { f -> setOnClickListener { f() } }
}

// A section label: small, spaced capitals.
fun Context.label(s: String, color: Int = DIM, onClick: (() -> Unit)? = null) = text(s.uppercase(), 11.5f, color, onClick).apply {
    letterSpacing = 0.14f
    typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
    setPadding(0, dp(18), 0, dp(4))
}

// A sheet from the bottom, styled like Capture, for picking one of a few options.
fun Activity.sheet(title: String, options: List<Pair<String, Int>>, pick: (Int) -> Unit) {
    val d = android.app.Dialog(this, R.style.Cue_Dialog)
    d.setContentView(LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(28), dp(12), dp(28), dp(20))
        background = android.graphics.drawable.GradientDrawable().apply {
            setColor(SHEET)
            cornerRadii = FloatArray(8) { if (it < 4) dp(20).toFloat() else 0f }
        }
        addView(label(title))
        options.forEachIndexed { i, (name, color) ->
            addView(text(name, 20f, color) { d.dismiss(); pick(i) }.apply { setPadding(0, dp(12), 0, dp(12)) })
        }
    })
    d.window?.apply {
        setGravity(android.view.Gravity.BOTTOM)
        setLayout(android.view.ViewGroup.LayoutParams.MATCH_PARENT, android.view.ViewGroup.LayoutParams.WRAP_CONTENT)
    }
    d.show()
}

fun Activity.page(build: LinearLayout.() -> Unit) {
    val col = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(28), dp(56), dp(28), dp(40))
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
