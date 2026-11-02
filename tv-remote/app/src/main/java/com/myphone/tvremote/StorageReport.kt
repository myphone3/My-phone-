package com.myphone.tvremote

import android.app.ActivityManager
import android.app.usage.StorageStatsManager
import android.content.Context
import android.content.pm.ApplicationInfo
import android.os.Environment
import android.os.Process
import android.os.StatFs
import android.os.storage.StorageManager
import org.json.JSONArray
import org.json.JSONObject

/**
 * דוח אחסון וזיכרון של הטלוויזיה: כמה מקום פנוי, כמה זיכרון, ומה תופס הכי הרבה.
 * מוצג בטלפון, ואפשר להעתיק אותו ולשלוח לבדיקה.
 */
object StorageReport {

    fun build(context: Context): JSONObject {
        // הרשאה לראות גדלים של אפליקציות (ניתנת דרך ADB, בלי לשאול)
        AdbBridge.shellSync("appops set ${context.packageName} GET_USAGE_STATS allow")

        val stat = StatFs(Environment.getDataDirectory().path)
        val am = context.getSystemService(ActivityManager::class.java)
        val mem = ActivityManager.MemoryInfo().also { am.getMemoryInfo(it) }

        val apps = JSONArray()
        val pm = context.packageManager
        val stats = context.getSystemService(StorageStatsManager::class.java)
        val rows = pm.getInstalledApplications(0).mapNotNull { info ->
            try {
                val s = stats.queryStatsForPackage(StorageManager.UUID_DEFAULT, info.packageName, Process.myUserHandle())
                Row(info, s.appBytes, s.dataBytes, s.cacheBytes)
            } catch (e: Exception) {
                Row(info, 0, 0, 0)
            }
        }.sortedByDescending { it.app + it.data }
        for (row in rows.take(70)) {
            apps.put(
                JSONObject()
                    .put("pkg", row.info.packageName)
                    .put("label", row.info.loadLabel(pm).toString())
                    .put("system", row.info.flags and ApplicationInfo.FLAG_SYSTEM != 0)
                    .put("enabled", row.info.enabled)
                    .put("app", row.app)
                    .put("data", row.data)
                    .put("cache", row.cache)
            )
        }

        return JSONObject()
            .put("storageTotal", stat.totalBytes)
            .put("storageFree", stat.availableBytes)
            .put("ramTotal", mem.totalMem)
            .put("ramFree", mem.availMem)
            .put("apps", apps)
            .put("appsCount", rows.size)
            .put("processes", processes())
    }

    private class Row(val info: ApplicationInfo, val app: Long, val data: Long, val cache: Long)

    /** התהליכים שתופסים הכי הרבה זיכרון עכשיו (מתוך dumpsys meminfo). */
    private fun processes(): JSONArray {
        val out = JSONArray()
        val text = AdbBridge.shellSync("dumpsys meminfo") ?: return out
        val section = text.substringAfter("Total PSS by process:", "").substringBefore("Total PSS by OOM")
        val line = Regex("""^\s*([\d,]+)K: (\S+)""")
        section.lines().mapNotNull { line.find(it) }.take(15).forEach {
            out.put(JSONObject().put("name", it.groupValues[2]).put("kb", it.groupValues[1].replace(",", "").toLong()))
        }
        return out
    }

    /** ניקוי קבצים זמניים (cache) של כל האפליקציות. מחזיר כמה מקום התפנה. */
    fun trimCaches(context: Context): Long {
        val before = StatFs(Environment.getDataDirectory().path).availableBytes
        AdbBridge.shellSync("pm trim-caches 999G")
        val after = StatFs(Environment.getDataDirectory().path).availableBytes
        return (after - before).coerceAtLeast(0)
    }
}
