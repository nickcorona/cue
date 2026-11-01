package com.nickcorona.cue

import android.app.Activity

// "more" on Home: the Drawer apps. They open freely, they just aren't on Home, where every
// name is a cue to open it.
class DrawerActivity : Activity() {
    override fun onResume() {
        super.onResume()
        val rules = Rules(this)
        val drawer = rules.drawer()
        page {
            addView(text("More", 28f))
            gap(12)
            val apps = launchable().filter { it.pkg in drawer }
            if (apps.isEmpty()) addView(text("Nothing here yet. Put apps in the Drawer from rules.", 15f, DIM))
            apps.forEach { a -> addView(text(a.label, 22f) { launch(a.pkg); finish() }.apply { setPadding(0, dp(6), 0, dp(6)) }) }
        }
    }
}
