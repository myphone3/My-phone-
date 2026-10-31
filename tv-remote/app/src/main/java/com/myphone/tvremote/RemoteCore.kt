package com.myphone.tvremote

import android.content.Context
import android.net.wifi.WifiManager
import android.util.Log

/**
 * מפעיל את כל חלקי השלט פעם אחת. נקרא מכל מקום שיכול להעיר את האפליקציה
 * (הפעלת הטלוויזיה, שירות הנגישות, הבדיקה התקופתית, פתיחת האפליקציה), כך שלא משנה מי התעורר ראשון.
 */
object RemoteCore {
    private var started = false
    private var server: WebServer? = null
    private var wifiLock: WifiManager.WifiLock? = null

    @Synchronized
    fun start(context: Context) {
        val app = context.applicationContext
        if (started) {
            ensureServer(app)
            return
        }
        started = true
        AdbBridge.init(app)
        CursorOverlay.init(app)
        CloudRelay.start(app)
        try { KeepAliveJob.schedule(app) } catch (e: Exception) { Log.w("RemoteCore", "job", e) }
        // מונע מה-WiFi "להירדם" כשהטלוויזיה לא בשימוש, כדי שהשלט יישאר מחובר
        try {
            @Suppress("DEPRECATION")
            wifiLock = app.getSystemService(WifiManager::class.java)
                ?.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "tvremote")
                ?.apply { setReferenceCounted(false); acquire() }
        } catch (e: Exception) {
            Log.w("RemoteCore", "wifi lock", e)
        }
        ensureServer(app)
        keepAlivePixel(app)
    }

    private var pixel: android.view.View? = null

    /**
     * נקודה שקופה בגודל פיקסל אחד, תמיד על המסך. אנדרואיד מחשיב אפליקציה שמציגה משהו על המסך
     * כ"חשובה", ולא סוגר אותה כשנגמר הזיכרון (למשל בזמן סרטון ב-SmartTube).
     */
    fun keepAlivePixel(app: Context) {
        if (pixel != null || !android.provider.Settings.canDrawOverlays(app)) return
        android.os.Handler(android.os.Looper.getMainLooper()).post {
            if (pixel != null) return@post
            try {
                val wm = app.getSystemService(android.view.WindowManager::class.java)
                val params = android.view.WindowManager.LayoutParams(
                    1, 1,
                    android.view.WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                    android.view.WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                        android.view.WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                        android.view.WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                    android.graphics.PixelFormat.TRANSLUCENT,
                ).apply { gravity = android.view.Gravity.TOP or android.view.Gravity.LEFT }
                val view = android.view.View(app).apply { setBackgroundColor(0x01000000) }
                wm.addView(view, params)
                pixel = view
            } catch (e: Exception) {
                Log.w("RemoteCore", "pixel", e)
            }
        }
    }

    private fun ensureServer(app: Context) {
        if (server?.isAlive == true) return
        try {
            server?.stop()
            server = WebServer(app, RemoteService.PORT).also { it.start(5000, false) }
        } catch (e: Exception) {
            Log.e("RemoteCore", "server failed", e)
        }
    }
}
