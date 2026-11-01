package com.nickcorona.cue

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast

// An app added from Chrome ("Install app") is only a shell that hands its site to Chrome, and
// Chrome may show whatever site it had open instead (unlocking GitHub once brought back
// bet365). So Cue opens those sites itself, in a window that stays on that one site: links
// elsewhere don't open, and a time box from Unlock closes it when it runs out. Logins are
// separate from Chrome's.
class SiteActivity : Activity() {
    private lateinit var web: WebView
    private val handler = Handler(Looper.getMainLooper())

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val url = intent.getStringExtra("url") ?: return finish()
        val site = siteOf(Uri.parse(url).host)
        web = WebView(this).apply {
            setBackgroundColor(BG)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            CookieManager.getInstance().setAcceptCookie(true)
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest) = siteOf(request.url.host) != site
            }
        }
        setContentView(web)
        web.loadUrl(url)
        val until = intent.getLongExtra("until", 0)
        if (until > 0) handler.postDelayed({
            Toast.makeText(this, "Time's up", Toast.LENGTH_SHORT).show()
            finish()
        }, (until - System.currentTimeMillis()).coerceAtLeast(0))
    }

    override fun onPause() {
        super.onPause()
        CookieManager.getInstance().flush()
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (web.canGoBack()) web.goBack() else @Suppress("DEPRECATION") super.onBackPressed()
    }

    companion object {
        // github.com, www.github.com and gist.github.com are one site; another domain isn't.
        fun siteOf(host: String?) = host?.lowercase()?.split('.')?.takeLast(2)?.joinToString(".")

        // The start address of an app Chrome installed (a WebAPK), or null for a real app.
        fun startUrl(c: Context, pkg: String): String? {
            if (!pkg.startsWith("org.chromium.webapk")) return null
            return runCatching {
                c.packageManager.getApplicationInfo(pkg, PackageManager.GET_META_DATA).metaData?.getString("org.chromium.webapk.shell_apk.startUrl")
            }.getOrNull()
        }

        fun open(c: Context, url: String, until: Long = 0) =
            c.startActivity(Intent(c, SiteActivity::class.java).putExtra("url", url).putExtra("until", until).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}
