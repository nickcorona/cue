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

// Warm near-black and paper-ish greys rather than pure black and blue-grey: calmer to look at,
// and they keep their lightness steps when grayscale is on.
// Shared bits for the dumbphone screens (Home, More, Unlock, Rules, Capture): type on black,
// no icons. Structure comes from small all-caps labels; the one accent colour marks the main
// action (Done, Open, Lock it in) and focus, red marks Off, everything else is white or grey.
const val BG = 0xFF0B0B0A.toInt()
const val FG = 0xFFEEEBE4.toInt()
const val MID = 0xFFBDB9B0.toInt()
const val DIM = 0xFF8E8A82.toInt()
const val FAINT = 0xFF2B2A27.toInt()
const val FAINT_TEXT = 0xFF4D4A45.toInt()
const val ACCENT = 0xFF7CF2C0.toInt()
const val FOCUS = ACCENT
const val RED = 0xFFE07A6F.toInt()
const val SHEET = 0xFF151412.toInt()

data class App(val label: String, val pkg: String)

fun Context.dp(v: Int) = (v * resources.displayMetrics.density).toInt()

// The typefaces, bundled (all SIL Open Font License). Display is for the clock, the countdown
// and big titles; body for everything else; label for the small capitals.
object Look {
    var option = "mono"

    private fun font(c: Context, id: Int) = c.resources.getFont(id)

    fun display(c: Context): Typeface = when (option) {
        "system" -> Typeface.create("sans-serif-thin", Typeface.NORMAL)
        "serif" -> font(c, R.font.instrument_serif)
        "grotesk" -> font(c, R.font.space_grotesk)
        else -> font(c, R.font.plex_mono_light)
    }

    fun body(c: Context): Typeface = when (option) {
        "system" -> Typeface.create("sans-serif", Typeface.NORMAL)
        "serif" -> font(c, R.font.inter)
        "grotesk" -> font(c, R.font.space_grotesk)
        else -> font(c, R.font.plex_sans)
    }

    fun label(c: Context): Typeface = when (option) {
        "system" -> Typeface.create("sans-serif-medium", Typeface.NORMAL)
        "serif" -> font(c, R.font.inter)
        "grotesk" -> font(c, R.font.space_grotesk)
        else -> font(c, R.font.plex_mono_medium)
    }

    // Variable fonts take their weight from a variation setting; the static ones ignore it.
    fun style(v: TextView, role: String, size: Float) {
        val c = v.context
        when (role) {
            "display" -> { v.typeface = display(c); v.fontVariationSettings = "'wght' 300" }
            "label" -> { v.typeface = label(c); v.fontVariationSettings = "'wght' 600" }
            else -> {
                v.typeface = if (option == "system" && size >= 20f) Typeface.create("sans-serif-light", Typeface.NORMAL) else body(c)
                v.fontVariationSettings = if (size >= 20f) "'wght' 330" else "'wght' 420"
            }
        }
    }
}

// Display face for big type (26sp and up), the body face below that.
fun Context.text(s: String, size: Float = 18f, color: Int = FG, onClick: (() -> Unit)? = null) = TextView(this).apply {
    text = s
    textSize = size
    setTextColor(color)
    Look.style(this, if (size >= 26f) "display" else "body", size)
    setPadding(0, dp(8), 0, dp(8))
    onClick?.let { f -> setOnClickListener { f() } }
}

// A section label: small, spaced capitals.
fun Context.label(s: String, color: Int = DIM, onClick: (() -> Unit)? = null) = text(s.uppercase(), 11.5f, color, onClick).apply {
    letterSpacing = 0.14f
    Look.style(this, "label", 11.5f)
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

// Apps added from Chrome open in Cue's own window on their one site (see SiteActivity).
fun Context.launch(pkg: String, until: Long = 0) {
    SiteActivity.startUrl(this, pkg)?.let { return SiteActivity.open(this, it, until) }
    packageManager.getLaunchIntentForPackage(pkg)?.let { startActivity(it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
}

// Everything Home opens goes in its own task, so Home's task holds only Home and swiping
// home never flashes whatever was last opened from it.
fun Context.open(cls: Class<*>, build: Intent.() -> Unit = {}) =
    startActivity(Intent(this, cls).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK).apply(build))

// Android's own "make this the home app?" prompt. After a couple of declines Android stops
// showing it and just answers no, so a "no" while still not home opens the Home app page in
// Settings instead (see homeAnswer).
const val ASK_HOME = 41

fun Activity.askToBeHome() {
    val roles = getSystemService(RoleManager::class.java)
    if (roles != null && roles.isRoleAvailable(RoleManager.ROLE_HOME) && !roles.isRoleHeld(RoleManager.ROLE_HOME))
        startActivityForResult(roles.createRequestRoleIntent(RoleManager.ROLE_HOME), ASK_HOME)
    else startActivity(Intent(Settings.ACTION_HOME_SETTINGS))
}

fun Activity.homeAnswer(requestCode: Int) {
    if (requestCode == ASK_HOME && !isHome()) startActivity(Intent(Settings.ACTION_HOME_SETTINGS))
}

fun Context.isHome() = getSystemService(RoleManager::class.java)?.isRoleHeld(RoleManager.ROLE_HOME) == true

fun hours(ms: Long) = "${(ms / 3_600_000).coerceAtLeast(0)}h ${(ms / 60_000 % 60).coerceAtLeast(0)}m"
