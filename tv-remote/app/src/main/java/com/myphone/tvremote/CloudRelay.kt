package com.myphone.tvremote

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.util.Log
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/**
 * חיבור קבוע לענן (Supabase Realtime). ככה הטלפון יכול לשלוט בטלוויזיה גם כשהם
 * לא על אותה רשת: למשל הטלוויזיה על הנקודה החמה של אחד, והטלפון של השני על רשת אחרת.
 */
object CloudRelay {
    private const val TAG = "CloudRelay"
    private const val JOIN_REF = "1"

    private val client = OkHttpClient.Builder()
        .pingInterval(20, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()
    private val timer = Executors.newSingleThreadScheduledExecutor()
    private val handlers = Executors.newFixedThreadPool(2)
    private val ref = AtomicInteger(1)

    private lateinit var appContext: Context
    private lateinit var topic: String
    private var socket: WebSocket? = null
    private var heartbeat: ScheduledFuture<*>? = null
    private var pendingRetry: ScheduledFuture<*>? = null
    private var backoffSec = 2L
    private var started = false
    @Volatile private var lastMessageAt = 0L

    @Volatile var online = false
        private set

    @Synchronized
    fun start(context: Context) {
        if (started) return
        started = true
        appContext = context.applicationContext
        topic = "realtime:tv-" + TvIdentity.id(appContext)
        connect()
        watchNetwork()
        timer.scheduleAtFixedRate({ watchdog() }, 10, 10, TimeUnit.SECONDS)
    }

    /**
     * בדיקה כל 20 שניות: אם אין חיבור ואין ניסיון בדרך - מתחברים.
     * אם החיבור "קפא" (השרת לא ענה דקה וקצת, אפילו לא לדופק) - מנתקים ומתחברים מחדש.
     */
    @Synchronized
    private fun watchdog() {
        val current = socket
        if (current == null) {
            if (pendingRetry?.isDone != false) connect()
            return
        }
        if (lastMessageAt > 0 && System.currentTimeMillis() - lastMessageAt > 35_000) {
            Log.w(TAG, "connection looks frozen, reconnecting")
            current.cancel()
        }
    }

    /**
     * כשהרשת חוזרת (למשל אחרי שיקוף מסך שמכבה את ה-WiFi) מתחברים מיד,
     * בלי לחכות לניסיון הבא.
     */
    private fun watchNetwork() {
        val connectivity = appContext.getSystemService(ConnectivityManager::class.java) ?: return
        connectivity.registerDefaultNetworkCallback(object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) = reconnectNow()
            override fun onLost(network: Network) {
                online = false
            }
        })
    }

    @Synchronized
    private fun reconnectNow() {
        backoffSec = 2
        if (online) return
        pendingRetry?.cancel(false)
        socket?.cancel()
        socket = null
        timer.schedule({ connectIfIdle() }, 1, TimeUnit.SECONDS)
    }

    @Synchronized
    private fun connectIfIdle() {
        if (socket == null) connect()
    }

    @Synchronized
    private fun connect() {
        lastMessageAt = 0
        val url = "wss://${Config.SUPABASE_HOST}/realtime/v1/websocket?apikey=${Config.SUPABASE_KEY}&vsn=1.0.0"
        socket = client.newWebSocket(Request.Builder().url(url).build(), listener)
    }

    private val listener = object : WebSocketListener() {
        override fun onOpen(webSocket: WebSocket, response: Response) {
            backoffSec = 2
            lastMessageAt = System.currentTimeMillis()
            val config = JSONObject()
                .put("broadcast", JSONObject().put("self", false).put("ack", false))
                .put("presence", JSONObject().put("key", ""))
                .put("postgres_changes", org.json.JSONArray())
                .put("private", false)
            send(
                webSocket, topic, "phx_join",
                JSONObject().put("config", config).put("access_token", Config.SUPABASE_KEY),
                JOIN_REF,
            )
            heartbeat?.cancel(false)
            heartbeat = timer.scheduleAtFixedRate({
                send(webSocket, "phoenix", "heartbeat", JSONObject(), ref.incrementAndGet().toString())
            }, 12, 12, TimeUnit.SECONDS)
        }

        override fun onMessage(webSocket: WebSocket, text: String) {
            lastMessageAt = System.currentTimeMillis()
            try {
                val message = JSONObject(text)
                val payload = message.optJSONObject("payload") ?: return
                when (message.optString("event")) {
                    "phx_reply" -> if (message.optString("ref") == JOIN_REF) {
                        online = payload.optString("status") == "ok"
                        Log.i(TAG, "joined: $text")
                    }
                    "broadcast" -> if (payload.optString("event") == "cmd") {
                        payload.optJSONObject("payload")?.let { handle(webSocket, it) }
                    }
                    "phx_error", "phx_close" -> webSocket.close(1000, null)
                }
            } catch (e: Exception) {
                Log.w(TAG, "bad message: $text", e)
            }
        }

        override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
            webSocket.close(1000, null)
        }

        override fun onClosed(webSocket: WebSocket, code: Int, reason: String) = retry(webSocket)

        override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
            Log.w(TAG, "connection failed", t)
            retry(webSocket)
        }
    }

    /** מנסה להתחבר שוב (למשל כשהטלוויזיה עברה רשת או שהאינטרנט נפל לרגע). */
    @Synchronized
    private fun retry(webSocket: WebSocket) {
        if (webSocket !== socket) return
        online = false
        heartbeat?.cancel(false)
        socket = null
        val delay = backoffSec
        backoffSec = (backoffSec * 2).coerceAtMost(8)
        pendingRetry = timer.schedule({ connectIfIdle() }, delay, TimeUnit.SECONDS)
    }

    private fun handle(webSocket: WebSocket, request: JSONObject) = handlers.execute {
        val id = request.optString("id")
        val args = request.optJSONObject("args")
        val params = HashMap<String, String>()
        args?.keys()?.forEach { params[it] = args.optString(it) }
        val result = try {
            Commands.handle(appContext, request.optString("cmd"), params)
        } catch (e: Exception) {
            Commands.Result(false, JSONObject().put("error", e.toString()))
        }
        // תזוזות עכבר נשלחות הרבה פעמים בשנייה - לא צריך לענות עליהן
        if (request.optBoolean("noreply")) return@execute
        val reply = JSONObject()
            .put("type", "broadcast")
            .put("event", "reply")
            .put("payload", JSONObject().put("id", id).put("ok", result.ok).put("body", result.body))
        send(webSocket, topic, "broadcast", reply, ref.incrementAndGet().toString())
    }

    private fun send(webSocket: WebSocket, topic: String, event: String, payload: JSONObject, ref: String) {
        val message = JSONObject()
            .put("topic", topic)
            .put("event", event)
            .put("payload", payload)
            .put("ref", ref)
        if (topic != "phoenix") message.put("join_ref", JOIN_REF)
        webSocket.send(message.toString())
    }
}
