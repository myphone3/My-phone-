package com.myphone.tvremote

import android.os.SystemClock
import android.view.InputDevice
import android.view.InputEvent
import android.view.KeyCharacterMap
import android.view.KeyEvent
import android.view.MotionEvent
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.lang.reflect.Method
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import kotlin.concurrent.thread

/**
 * "לוחץ מהיר": תוכנית קטנה שרצה בטלוויזיה כל הזמן (מופעלת פעם אחת דרך ADB, כמו ש-scrcpy עושה)
 * ולוחצת על כפתורים מיד, בלי להפעיל את הפקודה "input" מחדש בכל לחיצה.
 * "input keyevent" לוקח חצי שנייה ויותר בטלוויזיה חלשה (ועוד יותר כש-SmartTube מנגן) - כאן זה אלפיות שנייה.
 *
 * רץ בתהליך נפרד: CLASSPATH=<האפליקציה> app_process /system/bin com.myphone.tvremote.InputAgent <פורט> <סיסמה>
 * מאזין רק על 127.0.0.1, ורק מי שיודע את הסיסמה (האפליקציה שלנו) יכול לשלוח לו פקודות.
 */
object InputAgent {
    const val VERSION = 1

    private lateinit var manager: Any
    private lateinit var inject: Method

    @JvmStatic
    fun main(args: Array<String>) {
        val port = args.getOrNull(0)?.toIntOrNull() ?: 8097
        val token = args.getOrNull(1).orEmpty()
        try { android.os.Looper.prepareMainLooper() } catch (t: Throwable) { }
        manager = Class.forName("android.hardware.input.InputManager").getMethod("getInstance").invoke(null)!!
        inject = manager.javaClass.getMethod("injectInputEvent", InputEvent::class.java, Int::class.javaPrimitiveType)
        val server = try {
            ServerSocket(port, 8, InetAddress.getByName("127.0.0.1")).apply { reuseAddress = true }
        } catch (e: Exception) {
            System.err.println("port busy: $e")
            return
        }
        while (true) {
            val socket = try { server.accept() } catch (e: Exception) { continue }
            thread(name = "client") { serve(socket, token) }
        }
    }

    private fun serve(socket: Socket, token: String) {
        try {
            socket.tcpNoDelay = true
            val input = BufferedReader(InputStreamReader(socket.getInputStream()))
            val out = OutputStreamWriter(socket.getOutputStream())
            fun reply(text: String) { out.write(text + "\n"); out.flush() }
            if (input.readLine() != "auth $token") { reply("denied"); return }
            reply("ok $VERSION")
            while (true) {
                val line = input.readLine() ?: break
                val p = line.split(' ')
                val result = try {
                    when (p[0]) {
                        "key" -> { repeat(p.getOrNull(2)?.toIntOrNull()?.coerceIn(1, 20) ?: 1) { key(p[1].toInt()) }; "ok" }
                        "keys" -> { for (c in p.drop(1)) key(c.toInt()); "ok" }
                        "tap" -> { swipe(p[1].toFloat(), p[2].toFloat(), p[1].toFloat(), p[2].toFloat(), 40); "ok" }
                        "swipe" -> {
                            val ms = p.getOrNull(5)?.toLongOrNull()?.coerceIn(1, 3000) ?: 200
                            // החלקה ארוכה (לחיצה ארוכה) לא חוסמת את הלחיצות הבאות
                            thread { swipe(p[1].toFloat(), p[2].toFloat(), p[3].toFloat(), p[4].toFloat(), ms) }
                            "ok"
                        }
                        "ping" -> "ok"
                        "quit" -> { reply("ok"); System.exit(0); "ok" }
                        else -> "bad"
                    }
                } catch (e: Exception) {
                    "error $e"
                }
                reply(result)
            }
        } catch (e: Exception) {
        } finally {
            try { socket.close() } catch (e: Exception) { }
        }
    }

    private fun send(event: InputEvent) {
        inject.invoke(manager, event, 0) // 0 = לא מחכים לאפליקציה שתסיים לטפל בלחיצה
    }

    /** בדיוק כמו "input keyevent": לחיצה ושחרור מ"מקלדת וירטואלית". */
    private fun key(code: Int) {
        val now = SystemClock.uptimeMillis()
        send(KeyEvent(now, now, KeyEvent.ACTION_DOWN, code, 0, 0, KeyCharacterMap.VIRTUAL_KEYBOARD, 0, KeyEvent.FLAG_FROM_SYSTEM, InputDevice.SOURCE_KEYBOARD))
        send(KeyEvent(now, SystemClock.uptimeMillis(), KeyEvent.ACTION_UP, code, 0, 0, KeyCharacterMap.VIRTUAL_KEYBOARD, 0, KeyEvent.FLAG_FROM_SYSTEM, InputDevice.SOURCE_KEYBOARD))
    }

    private fun touch(action: Int, down: Long, x: Float, y: Float) {
        val event = MotionEvent.obtain(down, SystemClock.uptimeMillis(), action, x, y, 0)
        event.source = InputDevice.SOURCE_TOUCHSCREEN
        send(event)
        event.recycle()
    }

    private fun swipe(x1: Float, y1: Float, x2: Float, y2: Float, ms: Long) {
        val down = SystemClock.uptimeMillis()
        touch(MotionEvent.ACTION_DOWN, down, x1, y1)
        var t = SystemClock.uptimeMillis() - down
        while (t < ms) {
            val f = t.toFloat() / ms
            touch(MotionEvent.ACTION_MOVE, down, x1 + (x2 - x1) * f, y1 + (y2 - y1) * f)
            Thread.sleep(8)
            t = SystemClock.uptimeMillis() - down
        }
        touch(MotionEvent.ACTION_UP, down, x2, y2)
    }
}
