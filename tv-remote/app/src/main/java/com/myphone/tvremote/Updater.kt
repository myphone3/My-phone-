package com.myphone.tvremote

import android.content.Context
import android.os.Handler
import android.os.HandlerThread
import android.util.Log
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

/**
 * עדכון אוטומטי של האפליקציה בטלוויזיה: בודק מדי כמה שעות אם יש גרסה חדשה,
 * מוריד אותה ומתקין בשקט דרך ADB. לא מתעדכן באמצע שימוש בשלט או באמצע שיקוף.
 */
object Updater {
    private const val TAG = "Updater"
    private const val BASE = "https://myphone3.github.io/My-phone-/"
    private const val EVERY_MS = 3 * 60 * 60 * 1000L
    private const val QUIET_MS = 15 * 60 * 1000L

    @Volatile var state = ""
        private set
    private var handler: Handler? = null
    private val http = OkHttpClient.Builder().connectTimeout(15, TimeUnit.SECONDS).readTimeout(60, TimeUnit.SECONDS).build()

    fun start(context: Context) {
        if (handler != null) return
        val app = context.applicationContext
        val h = Handler(HandlerThread("updater").apply { start() }.looper)
        handler = h
        val loop = object : Runnable {
            override fun run() {
                checkNow(app, force = false)
                h.postDelayed(this, EVERY_MS)
            }
        }
        h.postDelayed(loop, 3 * 60 * 1000L)
    }

    fun currentVersion(context: Context): Long = try {
        context.packageManager.getPackageInfo(context.packageName, 0).longVersionCode
    } catch (e: Exception) { 0L }

    fun checkNow(context: Context, force: Boolean) {
        val app = context.applicationContext
        val h = handler ?: Handler(HandlerThread("updater-now").apply { start() }.looper)
        h.post {
            try { check(app, force) } catch (t: Throwable) { state = "error: $t"; Log.w(TAG, "check", t) }
        }
    }

    private fun check(context: Context, force: Boolean) {
        val current = currentVersion(context)
        val latest = http.newCall(Request.Builder().url(BASE + "version.json?t=" + System.currentTimeMillis()).build()).execute().use { r ->
            if (!r.isSuccessful) { state = "check failed ${r.code}"; return }
            JSONObject(r.body!!.string()).optLong("version", 0)
        }
        if (latest <= current) { state = "up to date ($current)"; return }
        val prefs = context.getSharedPreferences("updater", Context.MODE_PRIVATE)
        // אם ההתקנה של אותה גרסה כבר נכשלה פעמיים - לא מנסים שוב לבד
        if (!force && prefs.getLong("failed_version", -1) == latest && prefs.getInt("failures", 0) >= 2) {
            state = "update $latest failed before"; return
        }
        val busy = System.currentTimeMillis() - Commands.lastUse < QUIET_MS || MirrorServer.isActive || AirPlayServer.isActive
        if (busy && !force) { state = "update $latest waiting (in use)"; return }
        if (!AdbBridge.connected) { state = "update $latest waiting (no adb)"; return }

        state = "downloading $latest"
        val file = File(context.cacheDir, "update.apk")
        http.newCall(Request.Builder().url(BASE + "tv.apk?v=$latest").build()).execute().use { r ->
            if (!r.isSuccessful) { state = "download failed ${r.code}"; return }
            file.outputStream().use { out -> r.body!!.byteStream().copyTo(out) }
        }
        // בודקים שזה באמת העדכון שלנו לפני שמתקינים
        val info = context.packageManager.getPackageArchiveInfo(file.path, 0)
        if (info == null || info.packageName != context.packageName || info.longVersionCode <= current) {
            state = "downloaded file invalid"
            file.delete()
            return
        }
        state = "installing ${info.longVersionCode}"
        Log.i(TAG, "installing ${info.longVersionCode} over $current")
        // ההתקנה סוגרת את האפליקציה ומפעילה את הגרסה החדשה; אם הגענו לשורה הבאה - היא נכשלה
        val error = AdbBridge.installApk(file)
        if (currentVersion(context) > current) { state = "updated"; return }
        val failures = if (prefs.getLong("failed_version", -1) == latest) prefs.getInt("failures", 0) + 1 else 1
        prefs.edit().putLong("failed_version", latest).putInt("failures", failures).apply()
        state = "install failed: ${error ?: "unknown"}"
        file.delete()
    }
}
