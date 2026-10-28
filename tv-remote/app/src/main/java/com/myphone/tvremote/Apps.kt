package com.myphone.tvremote

import android.content.Context
import android.content.Intent
import android.net.Uri
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

    fun iconPng(context: Context, pkg: String, size: Int = 128): ByteArray? {
        if (!PACKAGE.matches(pkg)) return null
        return try {
            toPng(context.packageManager.getApplicationIcon(pkg), size)
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

    private val SMARTTUBE_PACKAGES = listOf(
        "com.teamsmart.videomanager.tv", "org.smarttube.stable", "org.smarttube.beta",
        "com.liskovsoft.smarttubetv.beta", "com.liskovsoft.smarttubetv",
    )

    /** מוצא את SmartTube - לפי שם החבילה המוכר, או לפי השם שלו ברשימת האפליקציות. */
    fun smartTube(context: Context): String? {
        val pm = context.packageManager
        SMARTTUBE_PACKAGES.firstOrNull {
            try { pm.getPackageInfo(it, 0); true } catch (e: Exception) { false }
        }?.let { return it }
        return list(context).firstOrNull { it.second.contains("smarttube", ignoreCase = true) }?.first
    }

    /**
     * פקודת ADB שפותחת חיפוש בתוך SmartTube. בודקים מראש איזו דרך SmartTube מבין
     * (קישור חיפוש של יוטיוב, או פקודת חיפוש), כדי שזה ייפתח בו ולא ביוטיוב הרגיל.
     */
    fun smartTubeSearch(context: Context, query: String): String? {
        val pkg = smartTube(context) ?: return null
        val pm = context.packageManager
        val url = "https://www.youtube.com/results?search_query=" + java.net.URLEncoder.encode(query, "UTF-8")
        val safe = Regex("^[A-Za-z0-9_.$/]+$")
        pm.queryIntentActivities(Intent(Intent.ACTION_VIEW, Uri.parse(url)).setPackage(pkg), 0).firstOrNull()?.let {
            val component = "${it.activityInfo.packageName}/${it.activityInfo.name}"
            if (safe.matches(component)) return "am start -a android.intent.action.VIEW -d '$url' -n $component"
        }
        pm.queryIntentActivities(Intent(Intent.ACTION_SEARCH).setPackage(pkg), 0).firstOrNull()?.let {
            val component = "${it.activityInfo.packageName}/${it.activityInfo.name}"
            val escaped = query.replace("'", "'\\''")
            if (safe.matches(component)) return "am start -a android.intent.action.SEARCH --es query '$escaped' -n $component"
        }
        return "am start -a android.intent.action.VIEW -d '$url' -p $pkg"
    }
}
