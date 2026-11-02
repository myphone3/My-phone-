package com.myphone.tvremote

import android.app.ActivityManager
import android.app.usage.StorageStatsManager
import android.app.usage.UsageStatsManager
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
        val lastUsed = lastUsed(context)
        // 100 הגדולות + כל האפליקציות שהותקנו (גם אם קטנות), כדי שהסריקה תעבור על כולן
        val chosen = (rows.take(100) + rows.filter { it.info.flags and ApplicationInfo.FLAG_SYSTEM == 0 }).distinctBy { it.info.packageName }
        for (row in chosen) {
            apps.put(
                JSONObject()
                    .put("pkg", row.info.packageName)
                    .put("label", row.info.loadLabel(pm).toString())
                    .put("system", row.info.flags and ApplicationInfo.FLAG_SYSTEM != 0)
                    .put("enabled", row.info.enabled)
                    .put("app", row.app)
                    .put("data", row.data)
                    .put("cache", row.cache)
                    .put("lastUsed", lastUsed[row.info.packageName] ?: 0L)
                    .put("installed", try { pm.getPackageInfo(row.info.packageName, 0).firstInstallTime } catch (e: Exception) { 0L })
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
            .put("downloads", downloads())
            .put("sharedUsed", duKb("/sdcard") * 1024)
    }

    private const val DOWNLOADS = "/sdcard/Download"

    private fun duKb(path: String): Long =
        AdbBridge.shellSync("du -sk $path 2>/dev/null")?.trim()?.split(Regex("\\s+"))?.firstOrNull()?.toLongOrNull() ?: 0

    /** תיקיית ההורדות (כרום, Downloader וכו'): כמה מקום היא תופסת ואילו קבצים יש בה. */
    private fun downloads(): JSONObject {
        val files = JSONArray()
        val listing = AdbBridge.shellSync("ls -lA $DOWNLOADS 2>/dev/null").orEmpty()
        val row = Regex("""^-\S*\s+\d+\s+\S+\s+\S+\s+(\d+)\s+(\S+)\s+(\S+)\s+(.+)$""")
        listing.lines().mapNotNull { row.find(it.trim()) }
            .sortedByDescending { it.groupValues[1].toLong() }
            .take(60)
            .forEach {
                files.put(JSONObject().put("name", it.groupValues[4]).put("size", it.groupValues[1].toLong()).put("date", it.groupValues[2]))
            }
        return JSONObject().put("bytes", duKb(DOWNLOADS) * 1024).put("files", files)
    }

    private val SAFE_NAME = Regex("^[^/\\u0000]+$")

    /** מוחק קובץ אחד מתיקיית ההורדות (רק אחרי שהמשתמש אישר בטלפון). */
    fun deleteDownload(name: String): Boolean {
        if (!SAFE_NAME.matches(name) || name == "." || name == "..") return false
        val quoted = "'" + name.replace("'", "'\\''") + "'"
        AdbBridge.shellSync("rm -f $DOWNLOADS/$quoted")
        return AdbBridge.shellSync("ls $DOWNLOADS/$quoted 2>/dev/null").isNullOrBlank()
    }

    /** מסיר אפליקציה שהמשתמש התקין (לא אפליקציות מערכת, ולא את השלט עצמו). */
    fun uninstall(context: Context, pkg: String): Boolean {
        if (!Regex("^[A-Za-z0-9_.]+$").matches(pkg) || pkg == context.packageName) return false
        val info = try { context.packageManager.getApplicationInfo(pkg, 0) } catch (e: Exception) { return false }
        if (info.flags and ApplicationInfo.FLAG_SYSTEM != 0) return false
        return AdbBridge.shellSync("pm uninstall $pkg")?.contains("Success") == true
    }

    /** מתי השתמשו בכל אפליקציה בפעם האחרונה (בשנה האחרונה). */
    private fun lastUsed(context: Context): Map<String, Long> = try {
        val usm = context.getSystemService(UsageStatsManager::class.java)
        val now = System.currentTimeMillis()
        usm.queryAndAggregateUsageStats(now - 365L * 24 * 3600 * 1000, now)
            .mapValues { it.value.lastTimeUsed }
            .filterValues { it > 0 }
    } catch (e: Exception) {
        emptyMap()
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
