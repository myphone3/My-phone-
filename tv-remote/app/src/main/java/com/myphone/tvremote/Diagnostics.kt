package com.myphone.tvremote

import android.app.ActivityManager
import android.app.ApplicationExitInfo
import android.content.Context
import android.os.Build
import android.os.Debug
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * דוח תקלות קצר שאפשר להעתיק מהשלט: למה האפליקציה נסגרה בפעמים האחרונות
 * (חוסר זיכרון / קריסה / תקיעה), כמה זיכרון יש, ומה קרה ב-AirPlay.
 */
object Diagnostics {
    private val started = System.currentTimeMillis()

    fun report(context: Context): String = buildString {
        val fmt = SimpleDateFormat("dd/MM HH:mm:ss", Locale.US)
        val am = context.getSystemService(ActivityManager::class.java)
        val mem = ActivityManager.MemoryInfo().also { am.getMemoryInfo(it) }
        appendLine("version=${try { context.packageManager.getPackageInfo(context.packageName, 0).versionName } catch (e: Exception) { "?" }} sdk=${Build.VERSION.SDK_INT}")
        appendLine("running since ${fmt.format(Date(started))}")
        appendLine("ram avail=${mem.availMem / 1048576}MB total=${mem.totalMem / 1048576}MB low=${mem.lowMemory}")
        val pi = Debug.MemoryInfo().also { Debug.getMemoryInfo(it) }
        appendLine("our process pss=${pi.totalPss / 1024}MB")
        appendLine("adb=${AdbBridge.connected} cloud=${CloudRelay.online} a11y=${RemoteAccessibility.instance != null}")
        appendLine("airplay port=${AirPlayServer.port} error=${AirPlayServer.lastError.ifBlank { "-" }}")
        if (Build.VERSION.SDK_INT >= 30) {
            appendLine("--- last exits ---")
            try {
                for (e in am.getHistoricalProcessExitReasons(context.packageName, 0, 12)) {
                    appendLine("${fmt.format(Date(e.timestamp))} ${e.processName} ${reason(e.reason)} imp=${e.importance} pss=${e.pss / 1024}MB ${e.description ?: ""}".trim())
                }
            } catch (t: Throwable) {
                appendLine("exit reasons unavailable: $t")
            }
        }
        appendLine("--- airplay log ---")
        append(AirPlayServer.log().ifBlank { "(empty)" })
    }

    private fun reason(r: Int) = when (r) {
        ApplicationExitInfo.REASON_LOW_MEMORY -> "LOW_MEMORY"
        ApplicationExitInfo.REASON_CRASH -> "CRASH"
        ApplicationExitInfo.REASON_CRASH_NATIVE -> "CRASH_NATIVE"
        ApplicationExitInfo.REASON_ANR -> "ANR"
        ApplicationExitInfo.REASON_SIGNALED -> "SIGNALED(killed)"
        ApplicationExitInfo.REASON_USER_REQUESTED -> "USER_STOP"
        ApplicationExitInfo.REASON_PACKAGE_UPDATED -> "UPDATED"
        ApplicationExitInfo.REASON_EXIT_SELF -> "EXIT_SELF"
        ApplicationExitInfo.REASON_DEPENDENCY_DIED -> "DEPENDENCY_DIED"
        ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE -> "EXCESSIVE_RESOURCE"
        ApplicationExitInfo.REASON_PERMISSION_CHANGE -> "PERMISSION_CHANGE"
        ApplicationExitInfo.REASON_INITIALIZATION_FAILURE -> "INIT_FAILURE"
        ApplicationExitInfo.REASON_OTHER -> "OTHER"
        else -> "reason$r"
    }
}
