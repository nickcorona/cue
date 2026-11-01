package com.nickcorona.cue

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.GeomagneticField
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.provider.Settings
import android.widget.TextView

class RulesActivity : Activity() {
    override fun onResume() {
        super.onResume()
        render()
    }

    private fun render() {
        val r = Rules(this)
        val now = System.currentTimeMillis()
        page {
            addView(text("Rules", 28f))
            addView(text(
                if (r.locked) "Locked. Allowing an app or turning the guard off takes 24h. Blocking is instant."
                else "Setup mode. Changes are instant until you lock it in.",
                14f, DIM,
            ))
            gap()

            if (!r.locked) {
                addView(step("Cue Home is the home app", isHome()) { askToBeHome(); null })
                addView(step("Guard is on (Accessibility, Cue)", enabled(Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)) {
                    Settings.ACTION_ACCESSIBILITY_SETTINGS
                })
                addView(step("Notification filter is on", enabled("enabled_notification_listeners")) {
                    // Straight to Cue's own switch where the phone supports it, not the whole list.
                    if (android.os.Build.VERSION.SDK_INT >= 30) {
                        startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
                            .putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, android.content.ComponentName(this@RulesActivity, Quiet::class.java).flattenToString()))
                        null
                    } else Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS
                })
                addView(step("Grayscale allowed (adb, see README)",
                    checkSelfPermission(Manifest.permission.WRITE_SECURE_SETTINGS) == PackageManager.PERMISSION_GRANTED) { null })
                gap(12)
                addView(text("→ Lock it in", 22f) { r.lock(); render() })
                gap()
            }

            addView(balconyRow())
            gap()

            r.pending().forEach { p ->
                val what = if (p.op == "allow") "Allow ${labelOf(p.arg)}" else "Guard turns off"
                addView(text("$what in ${hours(p.at - now)} · tap to cancel", 16f) { r.cancel(p.op, p.arg); render() })
            }
            if (r.pending().isNotEmpty()) gap()

            addView(text("Apps", 20f))
            addView(text("● on the home screen   ○ blocked", 13f, DIM))
            val waiting = r.pending().filter { it.op == "allow" }.map { it.arg }.toMutableSet()
            launchable().filter { it.pkg !in r.always() }.forEach { a ->
                val row = text("", 18f)
                fun paint() {
                    val on = a.pkg in r.allowed()
                    row.text = (if (on) "●  " else "○  ") + a.label + if (a.pkg in waiting) " · in 24h" else ""
                    row.setTextColor(if (on) FG else DIM)
                }
                row.setOnClickListener {
                    when {
                        a.pkg in r.allowed() -> { r.block(a.pkg); waiting -= a.pkg }
                        a.pkg in waiting -> { r.cancel("allow", a.pkg); waiting -= a.pkg }
                        else -> { r.allow(a.pkg); if (r.locked) waiting += a.pkg }
                    }
                    paint()
                }
                paint()
                addView(row)
            }

            if (r.locked && r.pending().none { it.op == "guard_off" }) {
                gap()
                addView(text("Turn the guard off (takes 24h)", 15f, DIM) { r.turnGuardOff(); render() })
            }
        }
    }

    // Which way the balcony faces, for "Balcony sun" on Home: stand at the railing with the phone
    // flat, top pointing straight out, and tap. Compass north is corrected to true north.
    private var compass: SensorEventListener? = null

    private fun balconyRow(): TextView {
        val row = text("", 17f)
        fun idle() {
            val d = Day.balcony(this)
            row.text = if (d == null) "Balcony direction: tap to set" else "Balcony faces ${Day.compass(d)} (${d.toInt()}°) · tap to reset"
        }
        var heading = 0.0
        row.setOnClickListener {
            val sm = getSystemService(SensorManager::class.java)
            val live = compass
            if (live != null) {
                sm.unregisterListener(live)
                compass = null
                Day.setBalcony(this, heading)
                idle()
                return@setOnClickListener
            }
            val sensor = sm.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR) ?: return@setOnClickListener
            val declination = GeomagneticField(Day.LAT.toFloat(), Day.LON.toFloat(), 80f, System.currentTimeMillis()).declination
            compass = object : SensorEventListener {
                private val m = FloatArray(9)
                private val o = FloatArray(3)
                override fun onSensorChanged(e: SensorEvent) {
                    SensorManager.getRotationMatrixFromVector(m, e.values)
                    SensorManager.getOrientation(m, o)
                    heading = ((Math.toDegrees(o[0].toDouble()) + declination) % 360 + 360) % 360
                    row.text = "Phone flat, top pointing out from the balcony: ${Day.compass(heading)} (${heading.toInt()}°) · tap to save"
                }
                override fun onAccuracyChanged(s: Sensor?, a: Int) {}
            }.also { sm.registerListener(it, sensor, SensorManager.SENSOR_DELAY_UI) }
        }
        idle()
        return row
    }

    override fun onPause() {
        super.onPause()
        compass?.let { getSystemService(SensorManager::class.java).unregisterListener(it) }
        compass = null
    }

    private fun step(label: String, done: Boolean, action: () -> String?): TextView =
        text((if (done) "✓  " else "✗  ") + label, 17f, if (done) DIM else FG) {
            action()?.let { startActivity(Intent(it)) }
        }

    private fun enabled(key: String) = Settings.Secure.getString(contentResolver, key)?.contains("$packageName/") == true

    private fun labelOf(pkg: String) = launchable().firstOrNull { it.pkg == pkg }?.label ?: pkg
}
