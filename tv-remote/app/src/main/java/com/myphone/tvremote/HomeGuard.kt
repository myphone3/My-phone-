package com.myphone.tvremote

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.util.Log

/**
 * שומר שמסך הבית שלנו יהיה תמיד מסך הבית - גם בהדלקה מהשקע, וגם כשאנדרואיד "שוכח" את הבחירה.
 *
 * מעבר לבחירת מסך הבית (set-home-activity), מכבים (pm disable-user) את מסך הבית של היצרן,
 * כך שאין לטלוויזיה בכלל מסך בית אחר להראות. זה גם משחרר את הזיכרון שהוא תפס - יותר מקום ל-SmartTube.
 * מכבים רק מסך בית "נקי": לא הגדרות, לא ממשק המערכת, ולא חבילה שמחזיקה גם ערוצי טלוויזיה / HDMI או אפליקציות.
 * כפתור "מסך הבית המקורי" באפליקציה מדליק אותו בחזרה.
 */
object HomeGuard {
    private const val TAG = "HomeGuard"
    private lateinit var app: Context

    fun init(context: Context) {
        app = context.applicationContext
    }

    private val prefs get() = app.getSharedPreferences("home", Context.MODE_PRIVATE)

    /** נקרא בכל חיבור ל-ADB (בהדלקה ואחרי כל ניתוק). */
    fun apply() {
        if (!::app.isInitialized || !RemoteAccessibility.homeTakeover(app)) return
        val pkg = app.packageName
        AdbBridge.shell("cmd package set-home-activity $pkg/$pkg.HomeActivity")
        val original = RemoteAccessibility.originalHome(app)?.substringBefore('/') ?: return
        val alreadyHidden = prefs.getString("hidden_original", null) == original
        if (!alreadyHidden && !safeToHide(original)) {
            Log.i(TAG, "keeping $original enabled (not a plain launcher)")
            return
        }
        prefs.edit().putString("hidden_original", original).apply()
        AdbBridge.shell("pm disable-user --user 0 $original")
    }

    /** מחזירים את מסך הבית של היצרן (כפתור "מסך הבית המקורי"). */
    fun restore(original: String?) {
        val hidden = prefs.getString("hidden_original", null)
        if (hidden != null && SAFE.matches(hidden)) AdbBridge.shell("pm enable $hidden")
        prefs.edit().remove("hidden_original").apply()
        if (original != null && SAFE.matches(original)) AdbBridge.shell("cmd package set-home-activity $original")
    }

    private fun safeToHide(pkg: String): Boolean {
        if (!SAFE.matches(pkg) || pkg == app.packageName) return false
        if (pkg in NEVER_HIDE || pkg.startsWith("com.android.systemui")) return false
        val pm = app.packageManager
        return try {
            // חבילה שמספקת ערוצי טלוויזיה / כניסות HDMI - משאירים
            if (pm.queryIntentServices(Intent("android.media.tv.TvInputService").setPackage(pkg), 0).isNotEmpty()) return false
            // חבילה שיש בה גם אפליקציה שמופיעה ברשימה (למשל "טלוויזיה חיה") - משאירים
            for (category in listOf(Intent.CATEGORY_LEANBACK_LAUNCHER, Intent.CATEGORY_LAUNCHER)) {
                val launchers = pm.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(category).setPackage(pkg), PackageManager.MATCH_DISABLED_COMPONENTS)
                if (launchers.isNotEmpty()) return false
            }
            true
        } catch (e: Exception) {
            false
        }
    }

    private val NEVER_HIDE = setOf(
        "com.android.settings", "com.android.tv.settings", "android", "com.android.phone",
        "com.android.providers.tv", "com.android.tv", "com.google.android.tv",
    )
    private val SAFE = Regex("^[A-Za-z0-9_.$/]+$")
}
