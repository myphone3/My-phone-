package com.myphone.tvremote

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Drawable
import java.io.ByteArrayOutputStream

object Apps {
    private val PACKAGE = Regex("^[A-Za-z0-9_.]+$")

    fun list(context: Context): List<Pair<String, String>> {
        val pm = context.packageManager
        val result = LinkedHashMap<String, String>()
        for (category in listOf(Intent.CATEGORY_LEANBACK_LAUNCHER, Intent.CATEGORY_LAUNCHER)) {
            val intent = Intent(Intent.ACTION_MAIN).addCategory(category)
            for (info in pm.queryIntentActivities(intent, 0)) {
                val pkg = info.activityInfo.packageName
                if (pkg == context.packageName || pkg in result) continue
                result[pkg] = info.loadLabel(pm).toString()
            }
        }
        return result.entries.map { it.key to it.value }.sortedBy { it.second.lowercase() }
    }

    /** פותח אפליקציה דרך ADB, כי אנדרואיד חוסם פתיחת מסכים מאפליקציה שרצה ברקע. */
    fun launch(context: Context, pkg: String): Boolean {
        if (!PACKAGE.matches(pkg)) return false
        val pm = context.packageManager
        val intent = pm.getLeanbackLaunchIntentForPackage(pkg) ?: pm.getLaunchIntentForPackage(pkg) ?: return false
        val component = intent.component?.flattenToShortString() ?: return false
        if (!Regex("^[A-Za-z0-9_.$/]+$").matches(component)) return false
        AdbBridge.shell("am start -n '$component'")
        return true
    }

    fun iconPng(context: Context, pkg: String): ByteArray? {
        if (!PACKAGE.matches(pkg)) return null
        return try {
            toPng(context.packageManager.getApplicationIcon(pkg), 128)
        } catch (e: Exception) {
            null
        }
    }

    private fun toPng(drawable: Drawable, size: Int): ByteArray {
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        drawable.setBounds(0, 0, size, size)
        drawable.draw(Canvas(bitmap))
        return ByteArrayOutputStream().also { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }.toByteArray()
    }

    private val YOUTUBE_APPS = listOf(
        "com.teamsmart.videomanager.tv", "com.liskovsoft.smarttubetv.beta", "com.liskovsoft.smarttubetv",
        "com.google.android.youtube.tv", "com.google.android.youtube",
    )

    /** איזו אפליקציית יוטיוב מותקנת (SmartTube קודם). */
    fun youtubeApp(context: Context): String? = YOUTUBE_APPS.firstOrNull {
        try {
            context.packageManager.getPackageInfo(it, 0)
            true
        } catch (e: Exception) {
            false
        }
    }
}
