package com.myphone.tvremote

import android.content.Context
import android.util.Log
import dadb.AdbKeyPair
import dadb.Dadb
import java.io.File
import java.net.URLEncoder
import java.util.concurrent.Callable
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

/**
 * מתחבר ל-ADB של הטלוויזיה עצמה (127.0.0.1) ושולח דרכו פקודות "input keyevent".
 * זו הדרך היחידה שבה אפליקציה רגילה יכולה ללחוץ על כפתורים בתוך אפליקציות אחרות.
 */
object AdbBridge {
    private const val TAG = "AdbBridge"
    private val PORTS = listOf(5555, 5556, 5037)
    private val SAFE_ARG = Regex("^[A-Za-z0-9_.$/]+$")
    private const val RESTORE_KEYBOARD_AFTER_SEC = 60L

    private val worker = Executors.newSingleThreadExecutor()
    private val timer = Executors.newSingleThreadScheduledExecutor()
    private val pendingKeys = ConcurrentLinkedQueue<Int>()
    private var keyPair: AdbKeyPair? = null
    private var dadb: Dadb? = null
    private var packageName = ""
    private var previousKeyboard: String? = null
    private var restoreTask: ScheduledFuture<*>? = null

    @Volatile var connected = false
        private set
    @Volatile var status = "מתחבר…"
        private set

    private val ourKeyboard get() = "$packageName/.RemoteIme"

    fun init(context: Context) {
        if (keyPair != null) return
        packageName = context.packageName
        val priv = File(context.filesDir, "adbkey")
        val pub = File(context.filesDir, "adbkey.pub")
        if (!priv.exists() || !pub.exists()) AdbKeyPair.generate(priv, pub)
        keyPair = AdbKeyPair.read(priv, pub)
        reconnect()
    }

    @Volatile private var lastAttempt = 0L

    /** אם החיבור ל-ADB נפל (למשל אחרי שהטלוויזיה נכנסה להמתנה), מנסה שוב - לכל היותר פעם ב-10 שניות. */
    fun ensureConnected() {
        if (connected || keyPair == null) return
        val now = System.currentTimeMillis()
        if (now - lastAttempt < 10_000) return
        lastAttempt = now
        worker.execute {
            try { connection() } catch (e: Exception) { Log.w(TAG, "reconnect failed", e) }
        }
    }

    fun reconnect() = worker.execute {
        disconnect()
        try {
            connection()
        } catch (e: Exception) {
            Log.w(TAG, "connect failed", e)
        }
    }

    /** מוסיף לחיצות לתור. לחיצות מהירות מאוחדות לפקודה אחת כדי שהטלוויזיה לא "תפגר". */
    fun sendKeys(code: Int, times: Int) {
        repeat(times) { pendingKeys.add(code) }
        worker.execute {
            val batch = mutableListOf<Int>()
            while (true) batch.add(pendingKeys.poll() ?: break)
            if (batch.isNotEmpty()) run("input keyevent " + batch.joinToString(" "))
        }
    }

    fun shell(command: String) = worker.execute { run(command) }

    /**
     * כותב טקסט (כולל עברית) לשדה שנבחר בטלוויזיה, דרך המקלדת של האפליקציה.
     * מחזיר null אם הצליח, או קוד שגיאה.
     */
    fun typeText(text: String): String? = onWorker {
        if (!useOurKeyboard()) return@onWorker "no_field"
        val ime = RemoteIme.instance ?: return@onWorker "no_field"
        if (!ime.replaceText(text)) "no_field" else null
    }

    /** כמו ללחוץ "חיפוש" במקלדת אחרי שהקלדנו. */
    fun submitText() = worker.execute {
        val done = RemoteIme.instance?.submit() == true
        if (!done) run("input keyevent 66")
        scheduleKeyboardRestore()
    }

    /** פותח חיפוש ביוטיוב (SmartTube אם מותקן) ישירות עם הטקסט, בכל שפה. */
    fun youtubeSearch(query: String, pkg: String?) = worker.execute {
        val url = "https://www.youtube.com/results?search_query=" + URLEncoder.encode(query, "UTF-8")
        val target = if (pkg != null && SAFE_ARG.matches(pkg)) " -p $pkg" else ""
        run("am start -a android.intent.action.VIEW -d '$url'$target")
    }

    private fun useOurKeyboard(): Boolean {
        restoreTask?.cancel(false)
        if (RemoteIme.instance == null) {
            val current = run("settings get secure default_input_method")?.trim()
            if (current != null && current != ourKeyboard && SAFE_ARG.matches(current)) previousKeyboard = current
            run("ime enable $ourKeyboard")
            run("ime set $ourKeyboard")
        }
        // מחכים שהמקלדת תתחבר לשדה שנבחר בטלוויזיה
        for (i in 0 until 25) {
            if (RemoteIme.instance != null && RemoteIme.hasTextField) break
            Thread.sleep(100)
        }
        scheduleKeyboardRestore()
        return RemoteIme.instance != null && RemoteIme.hasTextField
    }

    /** אחרי דקה בלי הקלדה מחזירים את המקלדת הרגילה של הטלוויזיה, כדי שהשלט הפיזי ימשיך לעבוד כרגיל. */
    private fun scheduleKeyboardRestore() {
        restoreTask?.cancel(false)
        restoreTask = timer.schedule({
            worker.execute { previousKeyboard?.let { run("ime set $it") } }
        }, RESTORE_KEYBOARD_AFTER_SEC, TimeUnit.SECONDS)
    }

    /** מריץ כמה פעולות ברצף על אותו ערוץ ADB (למשל: לצאת ממצב מגע, לסמן פריט, ללחוץ OK). */
    fun <T> sequence(block: ((String) -> String?) -> T): T = onWorker { block { command -> run(command) } }

    private fun <T> onWorker(block: () -> T): T = worker.submit(Callable { block() }).get(8, TimeUnit.SECONDS)

    private fun run(command: String): String? {
        for (attempt in 1..2) {
            try {
                return connection().shell(command).output
            } catch (e: Exception) {
                Log.w(TAG, "command failed ($attempt): $command", e)
                disconnect()
            }
        }
        return null
    }

    private fun connection(): Dadb {
        dadb?.let { return it }
        val keys = keyPair ?: throw IllegalStateException("not initialised")
        var lastError: Exception? = null
        for (port in PORTS) {
            val candidate = Dadb.create("127.0.0.1", port, keys, connectTimeout = 2000)
            try {
                status = "ממתין לאישור על מסך הטלוויזיה… (סמנו \"אפשר תמיד\")"
                candidate.shell("echo ok")
                dadb = candidate
                connected = true
                status = "מחובר ✓ אפשר לשלוט מהטלפון"
                keepAlive(candidate)
                return candidate
            } catch (e: Exception) {
                lastError = e
                try { candidate.close() } catch (_: Exception) {}
            }
        }
        connected = false
        status = "אין חיבור ל-ADB. צריך להדליק ניפוי באגים באפשרויות למפתחים, ואז ללחוץ \"התחבר מחדש\"."
        throw lastError ?: IllegalStateException("no adb port")
    }

    /** מבקש מהטלוויזיה לא לסגור את האפליקציה ברקע, ומאפשר לה לחזור לבד אם בכל זאת נסגרה. */
    private fun keepAlive(dadb: Dadb) {
        for (command in listOf(
            "cmd deviceidle whitelist +$packageName",
            "dumpsys deviceidle whitelist +$packageName",
            "appops set $packageName RUN_ANY_IN_BACKGROUND allow",
            "appops set $packageName RUN_IN_BACKGROUND allow",
            "appops set $packageName SYSTEM_ALERT_WINDOW allow",
            "am set-standby-bucket $packageName active",
            "am set-inactive $packageName false",
            "ime enable $ourKeyboard",
        )) {
            try { dadb.shell(command) } catch (e: Exception) { Log.w(TAG, "keepAlive: $command", e) }
        }
        enableAccessibility(dadb)
    }

    /**
     * מדליק את שירות הנגישות של השלט (בלי לגעת באחרים שכבר דולקים).
     * המערכת מפעילה אותו בעצמה בכל הדלקה של הטלוויזיה - ככה לא צריך לפתוח את האפליקציה.
     */
    private fun enableAccessibility(dadb: Dadb) {
        try {
            val ours = "$packageName/$packageName.RemoteAccessibility"
            val current = dadb.shell("settings get secure enabled_accessibility_services").output.trim()
            val list = current.split(':').filter { it.isNotBlank() && it != "null" }
            if (list.none { it == ours || it == "$packageName/.RemoteAccessibility" }) {
                val updated = (list + ours).joinToString(":")
                dadb.shell("settings put secure enabled_accessibility_services '$updated'")
            }
            dadb.shell("settings put secure accessibility_enabled 1")
        } catch (e: Exception) {
            Log.w(TAG, "accessibility", e)
        }
    }

    private fun disconnect() {
        try { dadb?.close() } catch (_: Exception) {}
        dadb = null
        connected = false
    }
}
