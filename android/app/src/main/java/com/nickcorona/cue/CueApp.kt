package com.nickcorona.cue

import android.app.Application
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONObject
import kotlin.concurrent.thread

class CueApp : Application() {
    override fun onCreate() {
        super.onCreate()
        Notifier.channels(this)
        // A crash goes in the phone log (and reaches the server on the next send) before the
        // usual crash handling.
        val crash = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { t, e ->
            runCatching {
                val at = e.stackTrace.firstOrNull { it.className.startsWith(packageName) } ?: e.stackTrace.firstOrNull()
                Diag.log(this, "crash: ${e.javaClass.simpleName} ${e.message?.take(100)} at $at")
            }
            crash?.uncaughtException(t, e)
        }
        // The app list cache (see Apps) goes stale when an app comes or goes.
        val f = android.content.IntentFilter().apply {
            addAction(android.content.Intent.ACTION_PACKAGE_ADDED)
            addAction(android.content.Intent.ACTION_PACKAGE_REMOVED)
            addAction(android.content.Intent.ACTION_PACKAGE_CHANGED)
            addDataScheme("package")
        }
        val r = object : android.content.BroadcastReceiver() {
            override fun onReceive(c: android.content.Context, i: android.content.Intent) = Apps.clear()
        }
        if (android.os.Build.VERSION.SDK_INT >= 33) registerReceiver(r, f, RECEIVER_NOT_EXPORTED) else registerReceiver(r, f)
        Push.init(this)
        NowSync.start(this)
        // Captures held while offline go out as soon as there's a network again.
        getSystemService(android.net.ConnectivityManager::class.java)?.registerDefaultNetworkCallback(object : android.net.ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: android.net.Network) { thread { Capture.flush(this@CueApp) } }
        })
    }
}

// FCM. Firebase is set up by hand from the IDs the build read out of google-services.json, so
// a build without that file still runs (no push, everything else works).
object Push {
    val configured get() = BuildConfig.FCM_APPID.isNotEmpty()

    fun init(c: android.content.Context) {
        if (!configured || FirebaseApp.getApps(c).isNotEmpty()) return
        FirebaseApp.initializeApp(c, FirebaseOptions.Builder()
            .setApplicationId(BuildConfig.FCM_APPID)
            .setApiKey(BuildConfig.FCM_APIKEY)
            .setProjectId(BuildConfig.FCM_PROJECTID)
            .setGcmSenderId(BuildConfig.FCM_SENDERID)
            .build())
    }

    // Make sure the server has this phone's token (on every launch; cheap when nothing changed).
    fun sync(c: android.content.Context) {
        if (!configured || Cue.key(c) == null) return
        runCatching {
            FirebaseMessaging.getInstance().token.addOnSuccessListener { t -> thread { register(c, t, force = false) } }
        }
    }

    fun register(c: android.content.Context, token: String, force: Boolean = true) {
        val p = Cue.prefs(c)
        val fresh = p.getString("fcm_token", null) == token && System.currentTimeMillis() - p.getLong("fcm_at", 0) < 3 * 86400_000L
        if (!force && fresh) return
        try {
            val r = Api(c).push("fcm_register", JSONObject().put("token", token).put("device", android.os.Build.MODEL))
            p.edit().putString("fcm_token", token).putLong("fcm_at", System.currentTimeMillis()).apply()
            // Put the Now notification up straight away instead of waiting for the next ping.
            r.optJSONObject("next")?.let { if (Cue.lastNow(c) == null) Notifier.show(c, Ping.parse(it), quiet = true) }
        } catch (e: Exception) {
            android.util.Log.w("Cue", "fcm register failed: ${e.message}")
        }
    }
}
