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
