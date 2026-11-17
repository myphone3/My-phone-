package com.myphone.tvremote

import android.content.Context
import android.util.Log
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.InetSocketAddress
import java.net.Socket
import java.security.SecureRandom

/**
 * הצד של האפליקציה מול ה"לוחץ המהיר" (InputAgent). שומר חיבור אחד פתוח אליו,
 * ואם הוא לא רץ (למשל אחרי הדלקה) - מפעיל אותו דרך ADB. כל עוד הוא לא מוכן, הלחיצות עוברות בדרך הישנה.
 */
object FastInput {
    private const val TAG = "FastInput"
    private const val PORT = 8097

    private var socket: Socket? = null
    private var reader: BufferedReader? = null
    private var writer: OutputStreamWriter? = null
    private var token = ""
    private var apk = ""
    private var appPackage = ""
    @Volatile private var lastLaunch = 0L
    @Volatile var ready = false
        private set

    fun init(context: Context) {
        if (token.isNotEmpty()) return
        val prefs = context.getSharedPreferences("adb", Context.MODE_PRIVATE)
        token = prefs.getString("agent_token", null) ?: ByteArray(16).also { SecureRandom().nextBytes(it) }
            .joinToString("") { "%02x".format(it.toInt() and 0xff) }
            .also { prefs.edit().putString("agent_token", it).apply() }
        apk = context.applicationInfo.sourceDir
        appPackage = context.packageName
    }

    /** שולח פקודה (למשל "key 22 3"). מחזיר false אם הלוחץ המהיר לא זמין - ואז משתמשים ב-input הרגיל. */
    @Synchronized
    fun send(command: String): Boolean {
        if (token.isEmpty()) return false
        for (attempt in 1..2) {
            try {
                val w = writer ?: open() ?: return false
                w.write(command + "\n")
                w.flush()
                if (reader?.readLine()?.startsWith("ok") == true) return true
                close()
            } catch (e: Exception) {
                close()
            }
        }
        return false
    }

    /** ממיר פקודת "input ..." של ADB לפקודה של הלוחץ המהיר, אם אפשר. */
    fun tryShell(command: String): Boolean {
        val p = command.trim().split(Regex("\\s+"))
        if (p.size < 3 || p[0] != "input") return false
        val nums = p.drop(2)
        if (nums.any { it.toFloatOrNull() == null }) return false
        return when (p[1]) {
            "keyevent" -> send("keys " + nums.joinToString(" "))
            "tap" -> nums.size == 2 && send("tap ${nums[0]} ${nums[1]}")
            "swipe" -> nums.size in 4..5 && send("swipe " + nums.joinToString(" "))
            else -> false
        }
    }

    private fun open(): OutputStreamWriter? {
        try {
            val s = Socket()
            s.connect(InetSocketAddress("127.0.0.1", PORT), 300)
            s.tcpNoDelay = true
            s.soTimeout = 1500
            val r = BufferedReader(InputStreamReader(s.getInputStream()))
            val w = OutputStreamWriter(s.getOutputStream())
            w.write("auth $token\n")
            w.flush()
            val hello = r.readLine().orEmpty()
            if (hello != "ok ${InputAgent.VERSION}") {
                // גרסה ישנה (מלפני עדכון) או סיסמה אחרת - סוגרים אותו ומפעילים את החדש
                if (hello.startsWith("ok")) { try { w.write("quit\n"); w.flush() } catch (e: Exception) { } }
                try { s.close() } catch (e: Exception) { }
                ready = false
                launch(force = true)
                return null
            }
            socket = s; reader = r; writer = w
            ready = true
            return w
        } catch (e: Exception) {
            ready = false
            launch(force = false)
            return null
        }
    }

    private fun close() {
        try { socket?.close() } catch (e: Exception) { }
        socket = null; reader = null; writer = null
        ready = false
    }

    /** מפעיל את הלוחץ המהיר דרך ADB (ברקע, כך שהוא ממשיך לרוץ גם כשהחיבור נסגר). לכל היותר פעם ב-15 שניות. */
    fun launch(force: Boolean) {
        if (apk.isEmpty() || !AdbBridge.connected) return
        val now = System.currentTimeMillis()
        if (!force && now - lastLaunch < 15_000) return
        lastLaunch = now
        if (!SAFE.matches(apk)) return
        val main = "$appPackage.InputAgent"
        Log.i(TAG, "launching input agent")
        // השם נבנה ממשתנה, כדי ש-pkill לא יהרוג את הפקודה הזו עצמה (שגם בה מופיע השם)
        AdbBridge.shell(
            "pkill -f 'tvremote_[i]nput' >/dev/null 2>&1; N=tvremote_; " +
                "CLASSPATH=$apk nohup app_process /system/bin --nice-name=\${N}input $main $PORT $token >/dev/null 2>&1 &",
        )
    }

    private val SAFE = Regex("^[A-Za-z0-9_.=/+-]+$")
}
