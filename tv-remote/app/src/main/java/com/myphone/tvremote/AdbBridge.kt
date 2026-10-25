package com.myphone.tvremote

import android.content.Context
import android.util.Log
import dadb.AdbKeyPair
import dadb.Dadb
import java.io.File
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.Executors

/**
 * מתחבר ל-ADB של הטלוויזיה עצמה (127.0.0.1) ושולח דרכו פקודות "input keyevent".
 * זו הדרך היחידה שבה אפליקציה רגילה יכולה ללחוץ על כפתורים בתוך אפליקציות אחרות.
 */
object AdbBridge {
    private const val TAG = "AdbBridge"
    private val PORTS = listOf(5555, 5556, 5037)

    private val worker = Executors.newSingleThreadExecutor()
    private val pendingKeys = ConcurrentLinkedQueue<Int>()
    private var keyPair: AdbKeyPair? = null
    private var dadb: Dadb? = null

    @Volatile var connected = false
        private set
    @Volatile var status = "מתחבר…"
        private set

    fun init(context: Context) {
        if (keyPair != null) return
        val priv = File(context.filesDir, "adbkey")
        val pub = File(context.filesDir, "adbkey.pub")
        if (!priv.exists() || !pub.exists()) AdbKeyPair.generate(priv, pub)
        keyPair = AdbKeyPair.read(priv, pub)
        reconnect()
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

    fun typeText(text: String) = worker.execute {
        // input text לא מקבל רווחים כמו שהם, אז מחליפים אותם ב-%s
        val escaped = text.replace(" ", "%s").replace("'", "'\\''")
        run("input text '$escaped'")
    }

    fun shell(command: String) = worker.execute { run(command) }

    private fun run(command: String) {
        for (attempt in 1..2) {
            try {
                connection().shell(command)
                return
            } catch (e: Exception) {
                Log.w(TAG, "command failed ($attempt): $command", e)
                disconnect()
            }
        }
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

    private fun disconnect() {
        try { dadb?.close() } catch (_: Exception) {}
        dadb = null
        connected = false
    }
}
