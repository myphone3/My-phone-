package com.myphone.tvremote.mirror

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.projection.MediaProjectionConfig
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * אפליקציית "שלט מהפון" לאנדרואיד: השלט עצמו (אותו דף כמו בדפדפן) + שיקוף מסך מובנה.
 * בפעם הראשונה מוצאת לבד את הטלוויזיה ברשת הביתית, ואחר כך עובדת מכל מקום.
 */
class MirrorActivity : Activity() {

    private lateinit var web: WebView
    private var setup: View? = null
    private var setupText: TextView? = null
    private val main = Handler(Looper.getMainLooper())

    private var mirrorHost: String? = null
    private var mirrorPort = Protocol.PORT
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var recognizer: SpeechRecognizer? = null

    private var nsd: NsdManager? = null
    private var discovery: NsdManager.DiscoveryListener? = null
    private var multicastLock: WifiManager.MulticastLock? = null

    private val prefs by lazy { getSharedPreferences("remote", Context.MODE_PRIVATE) }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.parseColor("#FFF4F7")
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
        web = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            setBackgroundColor(Color.parseColor("#FFF4F7"))
            addJavascriptInterface(Bridge(), "TvApp")
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, request: android.webkit.WebResourceRequest): Boolean {
                    val url = request.url
                    // קישורים חיצוניים (למשל הורדת קובץ) נפתחים בדפדפן
                    if (url.host != Uri.parse(REMOTE_BASE).host && url.scheme != "http") {
                        try { startActivity(Intent(Intent.ACTION_VIEW, url)) } catch (e: Exception) { }
                        return true
                    }
                    return false
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                    fileCallback?.onReceiveValue(null)
                    fileCallback = callback
                    val pick = Intent(Intent.ACTION_GET_CONTENT).setType("image/*")
                        .addCategory(Intent.CATEGORY_OPENABLE)
                        .putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.mode == FileChooserParams.MODE_OPEN_MULTIPLE)
                    return try {
                        startActivityForResult(Intent.createChooser(pick, "בחרו תמונות"), REQ_FILES)
                        true
                    } catch (e: Exception) {
                        fileCallback = null
                        false
                    }
                }
            }
        }
        setContentView(web)
        if (savedInstanceState != null) web.restoreState(savedInstanceState)
        handle(intent)
        if (web.url == null) openRemote()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handle(intent)
    }

    override fun onResume() {
        super.onResume()
        MirrorService.onChange = { runOnUiThread { pushMirrorState() } }
        pushMirrorState()
        web.evaluateJavascript("window.poll && window.poll()", null)
    }

    override fun onPause() {
        MirrorService.onChange = null
        super.onPause()
    }

    override fun onDestroy() {
        stopDiscovery()
        recognizer?.destroy()
        super.onDestroy()
    }

    /** קישור מהשלט בדפדפן: tvremote://open?tv=... או tvmirror://start?tv=...&host=... */
    private fun handle(intent: Intent?) {
        val uri = intent?.data ?: return
        val tv = uri.getQueryParameter("tv")
        if (!tv.isNullOrBlank() && tv != prefs.getString("tv", null)) {
            prefs.edit().putString("tv", tv).apply()
            if (::web.isInitialized) openRemote()
        }
        val host = uri.getQueryParameter("host")
        if (uri.scheme == "tvmirror" && host != null && !MirrorService.isRunning) {
            startMirror(host, uri.getQueryParameter("port")?.toIntOrNull() ?: Protocol.PORT)
        }
    }

    private fun openRemote() {
        val tv = prefs.getString("tv", null)
        if (tv == null) {
            showSetup()
            discover()
            return
        }
        hideSetup()
        web.loadUrl("$REMOTE_BASE?tv=$tv&app=1")
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (setup == null && web.canGoBack()) web.goBack() else moveTaskToBack(true)
    }

    // ===== הגשר בין הדף לאפליקציה =====

    inner class Bridge {
        @JavascriptInterface fun isApp() = true

        @JavascriptInterface fun startMirror(host: String, port: Int) {
            main.post { startMirror(host, if (port > 0) port else Protocol.PORT) }
        }

        @JavascriptInterface fun stopMirror() {
            main.post { MirrorService.stop(this@MirrorActivity) }
        }

        @JavascriptInterface fun mirrorRunning() = MirrorService.isRunning

        @JavascriptInterface fun vibrate(ms: Int) {
            try {
                getSystemService(Vibrator::class.java)?.vibrate(VibrationEffect.createOneShot(ms.toLong().coerceIn(5, 200), 120))
            } catch (e: Exception) { }
        }

        @JavascriptInterface fun canListen() = SpeechRecognizer.isRecognitionAvailable(this@MirrorActivity)

        @JavascriptInterface fun listen(lang: String) {
            main.post { listenNow(lang.ifBlank { "he-IL" }) }
        }

        /** החלפת טלוויזיה (נדיר): שוכחים את הטלוויזיה הנוכחית ומחפשים מחדש */
        @JavascriptInterface fun forgetTv() {
            main.post {
                prefs.edit().remove("tv").apply()
                openRemote()
            }
        }
    }

    private fun js(code: String) = main.post { web.evaluateJavascript(code, null) }

    private fun pushMirrorState() {
        js("window.__mirrorState && window.__mirrorState(${MirrorService.isRunning}, ${JSONObject.quote(MirrorService.status)})")
    }

    // ===== דיבור (המיקרופון בשלט) =====

    private fun listenNow(lang: String) {
        if (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            pendingListen = lang
            requestPermissions(arrayOf(android.Manifest.permission.RECORD_AUDIO), REQ_MIC)
            return
        }
        val rec = recognizer ?: SpeechRecognizer.createSpeechRecognizer(this).also { recognizer = it }
        rec.setRecognitionListener(object : RecognitionListener {
            override fun onResults(results: Bundle) {
                val list = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION).orEmpty()
                js("window.__speechResult && window.__speechResult(${JSONArray(list)})")
            }
            override fun onError(error: Int) { js("window.__speechError && window.__speechError($error)") }
            override fun onEndOfSpeech() {}
            override fun onReadyForSpeech(params: Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onPartialResults(partialResults: Bundle?) {}
            override fun onEvent(eventType: Int, params: Bundle?) {}
        })
        rec.startListening(
            Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
                .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3),
        )
    }

    private var pendingListen: String? = null

    // ===== שיקוף מסך =====

    private fun startMirror(host: String, port: Int) {
        if (MirrorService.isRunning) return
        mirrorHost = host
        mirrorPort = port
        val needed = mutableListOf<String>()
        if (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            needed += android.Manifest.permission.RECORD_AUDIO
        }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            needed += android.Manifest.permission.POST_NOTIFICATIONS
        }
        if (needed.isNotEmpty()) {
            requestPermissions(needed.toTypedArray(), REQ_PERMISSIONS)
            return
        }
        askCapture()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        when (requestCode) {
            REQ_PERMISSIONS -> askCapture()
            REQ_MIC -> pendingListen?.let { pendingListen = null; if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) listenNow(it) }
        }
    }

    /**
     * אנדרואיד מחייב אישור "להתחיל לשתף?" בכל פעם - זו הגנה של המערכת שאף אפליקציה לא יכולה לדלג עליה.
     * מאנדרואיד 14 מבקשים ישר "כל המסך", כך שנשארת רק לחיצה אחת על "שיתוף המסך".
     */
    private fun askCapture() {
        val mpm = getSystemService(MediaProjectionManager::class.java)
        val intent = if (Build.VERSION.SDK_INT >= 34) {
            mpm.createScreenCaptureIntent(MediaProjectionConfig.createConfigForDefaultDisplay())
        } else {
            mpm.createScreenCaptureIntent()
        }
        @Suppress("DEPRECATION")
        startActivityForResult(intent, REQ_CAPTURE)
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == REQ_FILES) {
            val cb = fileCallback ?: return
            fileCallback = null
            val uris = mutableListOf<Uri>()
            if (resultCode == RESULT_OK && data != null) {
                data.clipData?.let { clip -> for (i in 0 until clip.itemCount) uris += clip.getItemAt(i).uri }
                if (uris.isEmpty()) data.data?.let { uris += it }
            }
            cb.onReceiveValue(if (uris.isEmpty()) null else uris.toTypedArray())
            return
        }
        if (requestCode != REQ_CAPTURE) return
        if (resultCode != RESULT_OK || data == null) {
            MirrorService.status = "השיקוף בוטל"
            pushMirrorState()
            return
        }
        val host = mirrorHost ?: return
        MirrorService.status = "מתחבר לטלוויזיה…"
        startForegroundService(
            Intent(this, MirrorService::class.java)
                .putExtra(MirrorService.EXTRA_HOST, host)
                .putExtra(MirrorService.EXTRA_PORT, mirrorPort)
                .putExtra(MirrorService.EXTRA_RESULT, resultCode)
                .putExtra(MirrorService.EXTRA_DATA, data),
        )
        pushMirrorState()
        // חוזרים למסך הבית של הטלפון - מה שרואים בטלפון רואים בטלוויזיה
        main.postDelayed({ moveTaskToBack(true) }, 900)
    }

    // ===== פעם ראשונה: מציאת הטלוויזיה ברשת =====

    private fun showSetup() {
        if (setup != null) return
        val d = resources.displayMetrics.density
        fun dp(v: Int) = (v * d).toInt()
        val page = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(32), dp(32), dp(32), dp(32))
            background = GradientDrawable(GradientDrawable.Orientation.TL_BR, intArrayOf(Color.parseColor("#FFF4F7"), Color.parseColor("#F1ECFF")))
        }
        page.addView(ImageView(this).apply { setImageResource(R.drawable.ic_launcher) }, LinearLayout.LayoutParams(dp(96), dp(96)))
        page.addView(TextView(this).apply {
            text = getString(R.string.app_name)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 26f)
            setTextColor(Color.parseColor("#2E1F47"))
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            setPadding(0, dp(16), 0, dp(8))
        })
        val status = TextView(this).apply {
            text = "מחפש את הטלוויזיה ברשת…\n\nהטלפון צריך להיות מחובר לאותו WiFi של הטלוויזיה (רק בפעם הראשונה).\nאפשר גם לפתוח את השלט מהדפדפן וללחוץ שם \"פתח באפליקציה\"."
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            setTextColor(Color.parseColor("#5B4387"))
            gravity = Gravity.CENTER
        }
        page.addView(status)
        setupText = status
        setup = page
        setContentView(page)
    }

    private fun hideSetup() {
        if (setup == null) return
        setup = null
        setupText = null
        stopDiscovery()
        setContentView(web)
    }

    private fun discover() {
        if (discovery != null) return
        val manager = getSystemService(NsdManager::class.java) ?: return
        nsd = manager
        multicastLock = getSystemService(WifiManager::class.java)?.createMulticastLock("tvremote")?.apply {
            setReferenceCounted(false)
            acquire()
        }
        val listener = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(serviceType: String) {}
            override fun onDiscoveryStopped(serviceType: String) {}
            override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {}
            override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {}
            override fun onServiceLost(service: NsdServiceInfo) {}
            override fun onServiceFound(service: NsdServiceInfo) {
                @Suppress("DEPRECATION")
                manager.resolveService(service, object : NsdManager.ResolveListener {
                    override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {}
                    override fun onServiceResolved(info: NsdServiceInfo) {
                        @Suppress("DEPRECATION")
                        val host = info.host?.hostAddress ?: return
                        Thread { fetchTvId(host) }.start()
                    }
                })
            }
        }
        discovery = listener
        try {
            manager.discoverServices(Protocol.SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, listener)
        } catch (e: Exception) {
            discovery = null
        }
    }

    /** שואלים את הטלוויזיה (ברשת הביתית) מה המזהה שלה - ואז השלט עובד גם מחוץ לבית. */
    private fun fetchTvId(host: String) {
        try {
            val c = URL("http://$host:$WEB_PORT/api/status").openConnection() as HttpURLConnection
            c.connectTimeout = 3000
            c.readTimeout = 3000
            val body = c.inputStream.bufferedReader().readText()
            val json = JSONObject(body)
            val tv = (json.optJSONObject("body") ?: json).optString("tv")
            if (tv.isNotBlank()) main.post {
                if (prefs.getString("tv", null) == null) {
                    prefs.edit().putString("tv", tv).apply()
                    openRemote()
                }
            }
        } catch (e: Exception) { }
    }

    private fun stopDiscovery() {
        discovery?.let { try { nsd?.stopServiceDiscovery(it) } catch (e: Exception) { } }
        discovery = null
        multicastLock?.release()
        multicastLock = null
    }

    companion object {
        private const val REMOTE_BASE = "https://myphone3.github.io/My-phone-/"
        private const val WEB_PORT = 8080
        private const val REQ_PERMISSIONS = 1
        private const val REQ_CAPTURE = 2
        private const val REQ_FILES = 3
        private const val REQ_MIC = 4
    }
}
