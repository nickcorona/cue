package com.nickcorona.cue

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

// Right after Cue is updated: if Android gave the home screen back to the stock launcher,
// say so straight away rather than leaving it to be noticed on the next unlock.
class HomeCheck : BroadcastReceiver() {
    override fun onReceive(c: Context, i: Intent) {
        if (Rules(c).guardOn() && !c.isHome()) Notifier.homeLost(c)
    }
}
