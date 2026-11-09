package com.myphone.tvremote.mirror

import android.app.Activity
import android.app.AlertDialog
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.widget.Toast
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * עדכון של אפליקציית השלט בטלפון: בודקת פעם בכמה שעות אם יש גרסה חדשה,
 * ושואלת "להתקין?". אנדרואיד מחייב אישור אחד של המשתמש לכל התקנה - אי אפשר בלי.
 */
object AppUpdater {
    private const val BASE = "https://myphone3.github.io/My-phone-/"
    private const val EVERY_MS = 4 * 60 * 60 * 1000L
    private val main = Handler(Looper.getMainLooper())
    @Volatile private var busy = false
    private var pendingInstall = false

    private fun current(context: Context): Long = try {
        context.packageManager.getPackageInfo(context.packageName, 0).longVersionCode
    } catch (e: Exception) { 0L }

    /** נקרא כשהאפליקציה נפתחת */
    fun maybeCheck(activity: Activity) {
        val prefs = activity.getSharedPreferences("updater", Context.MODE_PRIVATE)
        // חזרנו מהמסך של "התרת התקנה" - ממשיכים בהתקנה
        if (pendingInstall && activity.packageManager.canRequestPackageInstalls()) {
            pendingInstall = false
            download(activity, prefs.getLong("latest", 0))
            return
        }
        if (busy || System.currentTimeMillis() - prefs.getLong("checked", 0) < EVERY_MS) return
        busy = true
        Thread {
            try {
                val latest = JSONObject(fetchText(BASE + "version.json?t=" + System.currentTimeMillis())).optLong("version", 0)
                prefs.edit().putLong("checked", System.currentTimeMillis()).putLong("latest", latest).apply()
                if (latest > current(activity) && latest != prefs.getLong("skipped", -1)) main.post { offer(activity, latest) }
            } catch (e: Exception) {
            } finally {
                busy = false
            }
        }.start()
    }

    private fun offer(activity: Activity, latest: Long) {
        if (activity.isFinishing) return
        AlertDialog.Builder(activity)
            .setTitle("יש גרסה חדשה של שלט מהפון")
            .setMessage("להתקין עכשיו? זה לוקח כמה שניות.")
            .setPositiveButton("התקן") { _, _ -> install(activity, latest) }
            .setNegativeButton("אחר כך") { _, _ ->
                activity.getSharedPreferences("updater", Context.MODE_PRIVATE).edit().putLong("skipped", latest).apply()
            }
            .show()
    }

    private fun install(activity: Activity, latest: Long) {
        if (!activity.packageManager.canRequestPackageInstalls()) {
            // פעם אחת בלבד: אנדרואיד מבקש להתיר לאפליקציה להתקין עדכונים
            pendingInstall = true
            AlertDialog.Builder(activity)
                .setTitle("פעם אחת בלבד")
                .setMessage("במסך הבא הדליקו \"התר מהמקור הזה\" וחזרו לכאן - והעדכון יתחיל.")
                .setPositiveButton("המשך") { _, _ ->
                    try {
                        activity.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${activity.packageName}")))
                    } catch (e: Exception) {
                        pendingInstall = false
                    }
                }
                .show()
            return
        }
        download(activity, latest)
    }

    private fun download(activity: Activity, latest: Long) {
        Toast.makeText(activity, "מוריד עדכון…", Toast.LENGTH_SHORT).show()
        val app = activity.applicationContext
        Thread {
            try {
                val file = File(app.cacheDir, "update.apk")
                val c = URL(BASE + "app.apk?v=$latest").openConnection() as HttpURLConnection
                c.connectTimeout = 15000
                c.readTimeout = 60000
                c.inputStream.use { input -> file.outputStream().use { input.copyTo(it) } }
                val info = app.packageManager.getPackageArchiveInfo(file.path, 0)
                if (info == null || info.packageName != app.packageName) throw IllegalStateException("bad apk")
                val installer = app.packageManager.packageInstaller
                val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
                if (Build.VERSION.SDK_INT >= 31) params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
                val id = installer.createSession(params)
                installer.openSession(id).use { session ->
                    session.openWrite("app.apk", 0, file.length()).use { out -> file.inputStream().use { it.copyTo(out) }; session.fsync(out) }
                    val intent = Intent(app, InstallReceiver::class.java)
                    val flags = PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
                    session.commit(PendingIntent.getBroadcast(app, 0, intent, flags).intentSender)
                }
            } catch (e: Exception) {
                main.post { Toast.makeText(app, "העדכון לא הצליח - ננסה שוב בפעם הבאה", Toast.LENGTH_LONG).show() }
            }
        }.start()
    }

    private fun fetchText(url: String): String {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 10000
        c.readTimeout = 10000
        return c.inputStream.bufferedReader().use { it.readText() }
    }
}

/** אנדרואיד מחזיר לכאן את מצב ההתקנה; אם צריך אישור - מציגים את חלון האישור של המערכת. */
class InstallReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.getIntExtra(PackageInstaller.EXTRA_STATUS, -999)) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                @Suppress("DEPRECATION")
                val confirm = intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT) ?: return
                context.startActivity(confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }
            PackageInstaller.STATUS_SUCCESS -> {}
            else -> Toast.makeText(context, "העדכון לא הותקן", Toast.LENGTH_LONG).show()
        }
    }
}
