package com.myphone.tvremote

import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.net.ConnectivityManager
import android.net.Network
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Surface
import java.io.File
import java.nio.ByteBuffer
import java.security.SecureRandom
import kotlin.math.pow

/**
 * מקלט AirPlay: הטלוויזיה מופיעה באייפון ב"שיקוף מסך" (מרכז הבקרה), כמו Apple TV.
 * הפרוטוקול עצמו (הצפנה, צימוד, mDNS) רץ בקוד C של UxPlay (libairplay.so);
 * כאן מציגים את הווידאו (H.264) ומשמיעים את הקול (AAC) דרך המפענחים של הטלוויזיה.
 * הכל עובר ב-WiFi הרגיל - שום דבר לא מנתק את הרשת, והשלט ממשיך לעבוד.
 */
object AirPlayServer {
    private const val TAG = "AirPlay"
    private val main = Handler(Looper.getMainLooper())
    private lateinit var appContext: Context
    private var loaded = false
    private var started = false
    private var multicastLock: WifiManager.MulticastLock? = null
    @Volatile var port = 0
        private set
    @Volatile var lastError = ""
        private set

    @JvmStatic private external fun nativeStart(name: String, mac: String, keyFile: String, width: Int, height: Int, fps: Int): Int
    @JvmStatic private external fun nativeStop()
    @JvmStatic private external fun nativeDisconnect()

    // ===== הפעלה =====

    @Volatile private var scheduled = false

    /** מתחילים רק כמה שניות אחרי שהטלוויזיה עלתה, ולא על ה-thread הראשי - כדי שמסך הבית יעלה מהר. */
    fun start(context: Context) {
        if (scheduled) return
        scheduled = true
        val app = context.applicationContext
        Thread({
            try { Thread.sleep(8000) } catch (e: InterruptedException) { }
            try { startNow(app) } catch (t: Throwable) { lastError = "start: $t"; Log.e(TAG, "start", t) }
        }, "airplay-delayed").start()
    }

    @Synchronized
    private fun startNow(context: Context) {
        if (started) return
        appContext = context.applicationContext
        if (!loaded) {
            try {
                System.loadLibrary("airplay")
                loaded = true
            } catch (t: Throwable) {
                lastError = "load: $t"
                Log.e(TAG, "loadLibrary", t)
                return
            }
        }
        // הגנה: אם בפעמיים הקודמות האפליקציה קרסה באמצע הפעלת AirPlay - לא מפעילים, כדי שהטלוויזיה תמשיך לעבוד
        val prefs = appContext.getSharedPreferences("airplay_guard", Context.MODE_PRIVATE)
        val version = try { appContext.packageManager.getPackageInfo(appContext.packageName, 0).longVersionCode } catch (e: Exception) { 0L }
        if (prefs.getLong("version", -1) != version) prefs.edit().clear().putLong("version", version).commit()
        if (prefs.getBoolean("inflight", false)) {
            prefs.edit().putInt("crashes", prefs.getInt("crashes", 0) + 1).putBoolean("inflight", false).commit()
        }
        if (prefs.getInt("crashes", 0) >= 2) {
            lastError = "disabled after crash"
            return
        }
        started = true
        try {
            multicastLock = appContext.getSystemService(WifiManager::class.java)
                ?.createMulticastLock("airplay")?.apply { setReferenceCounted(false); acquire() }
        } catch (e: Exception) {
            Log.w(TAG, "multicast lock", e)
        }
        launch()
        watchNetwork()
    }

    /** הפעלה מחדש: כשהטלוויזיה עוברת רשת, או כשמשנים לה את השם. */
    fun restart() {
        if (!started) return
        Thread({ launch() }, "airplay-restart").start()
    }

    @Synchronized
    private fun launch() {
        endSession()
        // מבקשים מהאייפון תמונה בגודל המסך האמיתי. displayMetrics הוא גודל התפריטים (לרוב 1280x720 גם במסך
        // Full HD או 4K) - ולכן קודם השיקוף היה מטושטש. לוקחים את הגודל הפיזי של המסך, עד 1920x1080.
        val (w, h) = screenSize()
        val fps = chooseFps(w, h)
        val key = File(appContext.filesDir, "airplay_key.pem").absolutePath
        val guard = appContext.getSharedPreferences("airplay_guard", Context.MODE_PRIVATE)
        guard.edit().putBoolean("inflight", true).commit()
        val result = try {
            nativeStart(TvIdentity.name(appContext), mac(), key, w, h, fps)
        } catch (t: Throwable) {
            lastError = "start: $t"
            -100
        }
        guard.edit().putBoolean("inflight", false).putInt("crashes", 0).commit()
        onLog("start result=$result size=${w}x$h fps=$fps")
        if (result > 0) {
            port = result
            lastError = ""
            Log.i(TAG, "ready on $result")
        } else {
            port = 0
            if (lastError.isEmpty() || result != -100) lastError = "start failed $result"
            // ננסה שוב עוד מעט (למשל ה-WiFi עוד לא עלה)
            main.postDelayed({ restart() }, 15_000)
        }
    }

    private fun screenSize(): Pair<Int, Int> {
        var pw = 0
        var ph = 0
        try {
            val display = appContext.getSystemService(android.hardware.display.DisplayManager::class.java)
                ?.getDisplay(android.view.Display.DEFAULT_DISPLAY)
            val modes = display?.supportedModes.orEmpty().toList() + listOfNotNull(display?.mode)
            for (m in modes) {
                val a = maxOf(m.physicalWidth, m.physicalHeight)
                val b = minOf(m.physicalWidth, m.physicalHeight)
                if (a > pw) { pw = a; ph = b }
            }
        } catch (e: Exception) { }
        if (pw <= 0) {
            val dm = appContext.resources.displayMetrics
            pw = maxOf(dm.widthPixels, dm.heightPixels)
            ph = minOf(dm.widthPixels, dm.heightPixels)
        }
        onLog("display ${pw}x$ph")
        // מסך HD (1366x768 וכד') מקבל 1280x720; כל מסך גדול יותר מקבל 1920x1080
        return if (pw >= 1600) 1920 to 1080 else 1280 to 720
    }

    /** 60 פריימים בשנייה (תנועה חלקה כמו ב-Apple TV) אם המפענח של הטלוויזיה עומד בזה, אחרת 30. */
    private fun chooseFps(w: Int, h: Int): Int {
        if (appContext.getSharedPreferences("airplay_guard", Context.MODE_PRIVATE).getInt("fps", 60) == 30) return 30
        return try {
            val list = android.media.MediaCodecList(android.media.MediaCodecList.REGULAR_CODECS)
            val ok = list.codecInfos.any { info ->
                !info.isEncoder && info.supportedTypes.any { it.equals(MediaFormat.MIMETYPE_VIDEO_AVC, true) } &&
                    (Build.VERSION.SDK_INT < 29 || info.isHardwareAccelerated) &&
                    try {
                        info.getCapabilitiesForType(MediaFormat.MIMETYPE_VIDEO_AVC).videoCapabilities
                            .areSizeAndRateSupported(w, h, 60.0)
                    } catch (e: Exception) { false }
            }
            if (ok) 60 else 30
        } catch (e: Exception) {
            30
        }
    }

    /** כתובת "חומרה" קבועה לטלוויזיה - האייפון זוכר לפיה את המכשיר. */
    private fun mac(): String {
        val prefs = appContext.getSharedPreferences("tv", Context.MODE_PRIVATE)
        prefs.getString("airplay_mac", null)?.let { return it }
        val b = ByteArray(6).also { SecureRandom().nextBytes(it) }
        b[0] = ((b[0].toInt() and 0xFC) or 0x02).toByte() // כתובת מקומית, לא של יצרן אמיתי
        val mac = b.joinToString(":") { "%02x".format(it.toInt() and 0xff) }
        prefs.edit().putString("airplay_mac", mac).apply()
        return mac
    }

    private var networkWatched = false
    private var lastNetwork: Network? = null

    private fun watchNetwork() {
        if (networkWatched) return
        networkWatched = true
        try {
            val cm = appContext.getSystemService(ConnectivityManager::class.java) ?: return
            cm.registerDefaultNetworkCallback(object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    val changed = lastNetwork != null && lastNetwork != network
                    lastNetwork = network
                    if (changed || port == 0) {
                        main.removeCallbacksAndMessages(RESTART_TOKEN)
                        main.postAtTime({ restart() }, RESTART_TOKEN, android.os.SystemClock.uptimeMillis() + 3000)
                    }
                }
            })
        } catch (e: Exception) {
            Log.w(TAG, "network callback", e)
        }
    }

    private val RESTART_TOKEN = Any()

    // ===== מסך =====

    @Volatile var screen: MirrorServer.Screen? = null
    @Volatile var isActive = false
        private set
    private val lock = Object()
    private var surface: Surface? = null

    fun attach(s: Surface?) {
        synchronized(lock) {
            onLog("surface ${if (s != null) "ready" else "gone"} gop=${gop.size} sps=${sps != null}")
            surface = s
            releaseVideo()
            // ההרצה מחדש של הפריימים נעשית ב-thread של הווידאו, לא כאן (כאן זה ה-thread של המסך)
            replayPending = s != null
        }
        if (s != null && isActive) ensureDecodeThread()
    }

    @Volatile private var replayPending = false

    /** המשתמש סגר את השיקוף בטלוויזיה (חזור) או בשלט. */
    fun stop() {
        if (!isActive) return
        suppressUntil = android.os.SystemClock.uptimeMillis() + 2500
        try { if (loaded) nativeDisconnect() } catch (t: Throwable) { }
        endSession()
    }

    /** אחרי שעצרו בטלוויזיה - לא פותחים שוב בגלל פריים אחרון שעוד היה בדרך */
    @Volatile private var suppressUntil = 0L

    private fun openScreen() {
        if (isActive) return
        if (android.os.SystemClock.uptimeMillis() < suppressUntil) return
        isActive = true
        try {
            appContext.startActivity(
                Intent(appContext, MirrorActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
            )
        } catch (e: Exception) {
            Log.w(TAG, "open screen", e)
        }
    }

    private fun endSession() {
        frames = 0
        val wasActive = isActive
        isActive = false
        queue.clear()
        synchronized(lock) {
            releaseVideo()
            gop.clear()
            gopBytes = 0
            sps = null
            shownSize = null
        }
        synchronized(audioLock) { releaseAudio() }
        if (wasActive) main.post { screen?.onEnded() }
    }

    // ===== וידאו =====
    //
    // הווידאו מגיע מהאייפון על ה-thread של הרשת. אסור לעכב אותו: אם מחכים שם למפענח, האייפון מרגיש
    // שהרשת "איטית", מוריד איכות ומדלג על פריימים - וזה מה שנראה כמו תמונה תקועה ומטושטשת.
    // לכן הרשת רק מכניסה פריימים לתור, ו-thread נפרד מפענח ומציג כל הזמן (גם כשלא מגיע פריים חדש).

    private var decoder: MediaCodec? = null
    private var sps: ByteArray? = null
    private var pps: ByteArray? = null
    private var videoW = 1920
    private var videoH = 1080
    /** הפריימים מאז הפריים המלא האחרון - כדי שהתמונה תופיע מיד כשהמסך נפתח. */
    private val gop = ArrayList<Pair<ByteArray, Long>>()
    private var gopBytes = 0
    private val info = MediaCodec.BufferInfo()
    private var frames = 0L
    private var rendered = 0L
    private val queue = java.util.concurrent.LinkedBlockingQueue<Pair<ByteArray, Long>>()
    @Volatile private var decodeThread: Thread? = null
    /** כמה פעמים בשיחה הזו המפענח לא עמד בקצב (ואז בפעם הבאה מבקשים מהאייפון 30 פריימים במקום 60) */
    private var lagEvents = 0

    @JvmStatic
    fun onVideoSize(width: Int, height: Int, h265: Boolean) {
        onLog("video size $width x $height h265=$h265")
        if (width > 0 && height > 0) {
            videoW = width
            videoH = height
        }
        openScreen()
    }

    @JvmStatic
    fun onVideo(data: ByteArray, ptsUs: Long) {
        if (!isActive) openScreen()
        if (!isActive) return
        if (frames == 0L) { rendered = 0; lagEvents = 0 }
        frames++
        if (frames <= 3 || frames % 600 == 0L) onLog("video frame #$frames ${data.size}B decoder=${decoder != null} surface=${surface != null} queue=${queue.size}")
        queue.offer(data to ptsUs)
        ensureDecodeThread()
    }

    private fun ensureDecodeThread() {
        if (decodeThread?.isAlive == true) return
        synchronized(this) {
            if (decodeThread?.isAlive == true) return
            decodeThread = Thread({ decodeLoop() }, "airplay-video").apply {
                priority = Thread.MAX_PRIORITY
                start()
            }
        }
    }

    private fun decodeLoop() {
        try { android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_URGENT_DISPLAY) } catch (e: Exception) { }
        var idle = 0
        while (true) {
            val item = queue.poll(8, java.util.concurrent.TimeUnit.MILLISECONDS)
            if (replayPending) synchronized(lock) {
                replayPending = false
                if (surface != null && decoder == null) replay()
            }
            if (item == null) {
                synchronized(lock) { drain() }
                // אין שיקוף כבר כמה שניות - ה-thread נסגר (ייפתח מחדש עם הפריים הבא)
                if (!isActive && ++idle > 500) break
                continue
            }
            idle = 0
            // המפענח לא עומד בקצב (יותר מחצי שנייה בתור): קופצים לפריים המלא האחרון שבתור, כדי לחזור ל"עכשיו"
            var next = item
            if (queue.size > 30) {
                val pending = ArrayList<Pair<ByteArray, Long>>(queue.size + 1)
                pending += item
                queue.drainTo(pending)
                val lastIdr = pending.indexOfLast { isIdr(it.first) }
                if (lastIdr > 0) {
                    lagEvents++
                    onLog("decoder behind by ${pending.size} frames, skipping to latest key frame")
                    if (lagEvents == 3) lowerFpsNextTime()
                    next = pending[lastIdr]
                    for (i in lastIdr + 1 until pending.size) queue.offer(pending[i])
                } else {
                    next = pending[0]
                    for (i in 1 until pending.size) queue.offer(pending[i])
                }
            }
            synchronized(lock) {
                val (data, pts) = next
                val idr = scanNals(data)
                if (idr) {
                    gop.clear()
                    gopBytes = 0
                }
                if (gopBytes < 12 shl 20 && gop.size < 400) {
                    gop += data to pts
                    gopBytes += data.size
                }
                if (decoder == null) {
                    if (surface != null && idr) startDecoder()
                }
                if (decoder != null) feed(data, pts)
            }
        }
    }

    private fun isIdr(data: ByteArray): Boolean {
        var i = 0
        val n = data.size
        while (i + 4 < n) {
            if (data[i].toInt() == 0 && data[i + 1].toInt() == 0 && data[i + 2].toInt() == 0 && data[i + 3].toInt() == 1) {
                val type = data[i + 4].toInt() and 0x1f
                if (type == 5 || type == 7) return true
                i += 4
            } else i++
        }
        return false
    }

    /** מחפש בתוך הפריים את ה-SPS/PPS (הגדרות הווידאו). מחזיר true אם זה פריים מלא (מתחילים ממנו). */
    private fun scanNals(data: ByteArray): Boolean {
        var idr = false
        var i = 0
        val n = data.size
        val starts = ArrayList<Int>()
        while (i + 3 < n) {
            if (data[i].toInt() == 0 && data[i + 1].toInt() == 0 && data[i + 2].toInt() == 0 && data[i + 3].toInt() == 1) {
                starts += i
                i += 4
            } else i++
        }
        for (k in starts.indices) {
            val s = starts[k] + 4
            if (s >= n) continue
            val end = if (k + 1 < starts.size) starts[k + 1] else n
            when (data[s].toInt() and 0x1f) {
                5 -> idr = true
                7 -> {
                    val newSps = data.copyOfRange(starts[k], end)
                    if (sps != null && !sps.contentEquals(newSps)) {
                        // ההגדרות השתנו (סיבוב מסך / אפליקציה אחרת) - מפענח חדש
                        releaseVideo()
                    }
                    sps = newSps
                    idr = true
                }
                8 -> pps = data.copyOfRange(starts[k], end)
            }
        }
        return idr
    }

    private fun startDecoder() {
        val s = surface ?: return onLog("startDecoder: no surface")
        val spsData = sps ?: return onLog("startDecoder: no sps")
        val ppsData = pps ?: return onLog("startDecoder: no pps")
        // קודם עם "השהיה נמוכה"; אם המפענח של הטלוויזיה לא מכיר את זה - בלי
        for (lowLatency in listOf(true, false)) {
            var codec: MediaCodec? = null
            try {
                val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, videoW, videoH)
                format.setByteBuffer("csd-0", ByteBuffer.wrap(spsData))
                format.setByteBuffer("csd-1", ByteBuffer.wrap(ppsData))
                format.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 2 shl 20)
                if (lowLatency) {
                    if (Build.VERSION.SDK_INT >= 30) format.setInteger(MediaFormat.KEY_LOW_LATENCY, 1)
                    format.setInteger(MediaFormat.KEY_PRIORITY, 0)
                    format.setInteger(MediaFormat.KEY_OPERATING_RATE, Short.MAX_VALUE.toInt())
                }
                codec = MediaCodec.createDecoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
                codec.configure(format, s, null, 0)
                codec.setVideoScalingMode(MediaCodec.VIDEO_SCALING_MODE_SCALE_TO_FIT)
                codec.start()
                decoder = codec
                onLog("decoder started ${videoW}x$videoH lowLatency=$lowLatency ${codec.name}")
                return
            } catch (e: Exception) {
                onLog("video decoder failed lowLatency=$lowLatency: $e")
                try { codec?.release() } catch (x: Exception) { }
                decoder = null
            }
        }
    }

    /** המסך נפתח באמצע: מתחילים מהפריים המלא האחרון ומריצים קדימה עד עכשיו. */
    private fun replay() {
        if (gop.isEmpty()) return
        startDecoder()
        for ((d, p) in gop.toList()) feed(d, p)
    }

    /** מכניס פריים למפענח. מחכה לו (עד חצי שנייה) במקום לזרוק את הפריים - פריים שנזרק מלכלך את התמונה עד הפריים המלא הבא. */
    private fun feed(data: ByteArray, pts: Long) {
        val codec = decoder ?: return
        try {
            var index = -1
            val deadline = android.os.SystemClock.uptimeMillis() + 500
            while (index < 0 && android.os.SystemClock.uptimeMillis() < deadline) {
                index = codec.dequeueInputBuffer(5_000)
                if (index < 0) drain()
            }
            if (index >= 0) {
                val buffer = codec.getInputBuffer(index)
                if (buffer != null && data.size <= buffer.capacity()) {
                    buffer.clear()
                    buffer.put(data)
                    codec.queueInputBuffer(index, 0, data.size, pts, 0)
                } else {
                    codec.queueInputBuffer(index, 0, 0, pts, 0)
                }
            } else {
                onLog("decoder stuck - restarting it")
                releaseVideo()
                return
            }
            drain()
        } catch (e: Exception) {
            Log.w(TAG, "feed", e)
            releaseVideo()
        }
    }

    /** מציג מיד כל פריים מוכן - השהיה מינימלית. */
    private fun drain() {
        val codec = decoder ?: return
        try {
            while (true) {
                val out = codec.dequeueOutputBuffer(info, 0)
                when {
                    out >= 0 -> {
                        codec.releaseOutputBuffer(out, true)
                        rendered++
                        if (rendered == 1L || rendered % 600 == 0L) onLog("rendered frame #$rendered")
                    }
                    out == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> reportSize(codec.outputFormat)
                    out == MediaCodec.INFO_TRY_AGAIN_LATER -> break
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "drain", e)
            releaseVideo()
        }
    }

    /** הטלוויזיה לא עמדה ב-60 פריימים בשנייה - מעכשיו מבקשים 30 (חלק יותר בטלוויזיה חלשה). */
    private fun lowerFpsNextTime() {
        val prefs = appContext.getSharedPreferences("airplay_guard", Context.MODE_PRIVATE)
        if (prefs.getInt("fps", 60) != 30) {
            onLog("switching to 30fps for next sessions")
            prefs.edit().putInt("fps", 30).apply()
        }
    }

    /** הגודל האמיתי של התמונה (בלי שוליים) - כדי שהמסך יציג אותה בלי להימתח. */
    @Volatile var shownSize: Pair<Int, Int>? = null
        private set

    private fun reportSize(f: MediaFormat) {
        try {
            var w = f.getInteger(MediaFormat.KEY_WIDTH)
            var h = f.getInteger(MediaFormat.KEY_HEIGHT)
            if (f.containsKey("crop-right") && f.containsKey("crop-left")) w = f.getInteger("crop-right") - f.getInteger("crop-left") + 1
            if (f.containsKey("crop-bottom") && f.containsKey("crop-top")) h = f.getInteger("crop-bottom") - f.getInteger("crop-top") + 1
            onLog("shown size ${w}x$h")
            shownSize = w to h
            main.post { screen?.onVideoSize(w, h) }
        } catch (e: Exception) { }
    }

    private fun releaseVideo() {
        try { decoder?.stop() } catch (e: Exception) { }
        try { decoder?.release() } catch (e: Exception) { }
        decoder = null
    }

    @JvmStatic
    fun onVideoReset() {
        onLog("video reset")
        endSession()
    }

    @JvmStatic
    fun onConnection(count: Int) {
        // לא סוגרים לפי מספר החיבורים - האייפון פותח וסוגר חיבורי עזר; הסגירה האמיתית מגיעה ב-onVideoReset
        onLog("connections=$count")
    }

    // ===== קול =====

    private val audioLock = Object()
    private var audioDecoder: MediaCodec? = null
    private var audioType = 0
    private var track: AudioTrack? = null
    private var volume = 1f
    private val audioInfo = MediaCodec.BufferInfo()

    @JvmStatic
    fun onAudioFormat(ct: Int, spf: Int) {
        onLog("audio ct=$ct spf=$spf")
        synchronized(audioLock) {
            releaseAudio()
            audioType = ct
        }
    }

    @JvmStatic
    fun onAudio(data: ByteArray, ct: Int) {
        synchronized(audioLock) {
            if (audioDecoder == null || ct != audioType) {
                releaseAudio()
                audioType = ct
                audioDecoder = createAudioDecoder(ct) ?: return
            }
            val codec = audioDecoder ?: return
            try {
                val index = codec.dequeueInputBuffer(10_000)
                if (index >= 0) {
                    val buffer = codec.getInputBuffer(index) ?: return
                    buffer.clear()
                    if (data.size > buffer.capacity()) {
                        codec.queueInputBuffer(index, 0, 0, 0, 0)
                        return
                    }
                    buffer.put(data)
                    codec.queueInputBuffer(index, 0, data.size, 0, 0)
                }
                while (true) {
                    val out = codec.dequeueOutputBuffer(audioInfo, 0)
                    if (out >= 0) {
                        val pcm = codec.getOutputBuffer(out)
                        if (pcm != null && audioInfo.size > 0) {
                            val bytes = ByteArray(audioInfo.size)
                            pcm.position(audioInfo.offset)
                            pcm.get(bytes)
                            play(bytes)
                        }
                        codec.releaseOutputBuffer(out, false)
                    } else if (out == MediaCodec.INFO_TRY_AGAIN_LATER) break
                }
            } catch (e: Exception) {
                Log.w(TAG, "audio", e)
                releaseAudio()
            }
        }
    }

    private fun createAudioDecoder(ct: Int): MediaCodec? {
        return try {
            val format: MediaFormat
            when (ct) {
                8 -> { // AAC-ELD - הקול של שיקוף מסך
                    format = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, 44100, 2)
                    format.setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectELD)
                    format.setByteBuffer("csd-0", ByteBuffer.wrap(byteArrayOf(0xF8.toByte(), 0xE8.toByte(), 0x50, 0x00)))
                }
                4 -> { // AAC-LC
                    format = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, 44100, 2)
                    format.setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
                    format.setByteBuffer("csd-0", ByteBuffer.wrap(byteArrayOf(0x12, 0x10)))
                }
                2 -> { // ALAC (מוזיקה בלבד, בלי שיקוף) - לא בכל טלוויזיה יש מפענח
                    format = MediaFormat.createAudioFormat("audio/alac", 44100, 2)
                    format.setByteBuffer("csd-0", ByteBuffer.wrap(hex("000001600010280a0e0200ff00000000000000000000ac44")))
                }
                else -> return null
            }
            val mime = format.getString(MediaFormat.KEY_MIME)!!
            MediaCodec.createDecoderByType(mime).apply {
                configure(format, null, null, 0)
                start()
            }
        } catch (e: Exception) {
            onLog("audio decoder failed ct=$ct: $e")
            null
        }
    }

    private fun hex(s: String) = ByteArray(s.length / 2) { s.substring(it * 2, it * 2 + 2).toInt(16).toByte() }

    /** כמה פריימים של קול נכתבו לרמקול (סופרים כ-Int, כמו playbackHeadPosition, כדי שהחיסור יעבוד גם אחרי "גלישה") */
    private var writtenFrames = 0
    private var droppedChunks = 0

    /**
     * משמיע קול. שומרים שבתור לרמקול לא יהיה יותר מ-0.12 שנייה: אם הצטבר יותר (רשת שגמגמה, שעון של האייפון
     * קצת מהיר) - מדלגים על חתיכה קטנה של 10ms, וכך הקול לא "נגרר" אחרי התמונה.
     */
    private fun play(pcm: ByteArray) {
        val t = track ?: try {
            val min = AudioTrack.getMinBufferSize(44100, AudioFormat.CHANNEL_OUT_STEREO, AudioFormat.ENCODING_PCM_16BIT)
            AudioTrack.Builder()
                .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MOVIE).build())
                .setAudioFormat(AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(44100).setChannelMask(AudioFormat.CHANNEL_OUT_STEREO).build())
                .setBufferSizeInBytes(maxOf(min, 44100 / 5 * 4)) // 0.2 שנייה - קצת יותר מהתקרה, כדי שכתיבה לא תיחתך
                .setTransferMode(AudioTrack.MODE_STREAM)
                .setPerformanceMode(AudioTrack.PERFORMANCE_MODE_LOW_LATENCY)
                .build()
                .also {
                    it.setVolume(volume)
                    it.play()
                    track = it
                    writtenFrames = 0
                    droppedChunks = 0
                    onLog("audio track buffer=${it.bufferSizeInFrames} frames min=${min / 4}")
                }
        } catch (e: Exception) {
            return
        }
        val pending = writtenFrames - t.playbackHeadPosition
        if (pending > MAX_PENDING_FRAMES) {
            droppedChunks++
            if (droppedChunks == 1 || droppedChunks % 200 == 0) onLog("audio catching up (dropped $droppedChunks chunks, pending=$pending)")
            return
        }
        val n = t.write(pcm, 0, pcm.size, AudioTrack.WRITE_NON_BLOCKING)
        if (n > 0) writtenFrames += n / 4
    }

    private const val MAX_PENDING_FRAMES = 44100 * 12 / 100

    private fun releaseAudio() {
        try { audioDecoder?.stop() } catch (e: Exception) { }
        try { audioDecoder?.release() } catch (e: Exception) { }
        audioDecoder = null
        try { track?.stop() } catch (e: Exception) { }
        try { track?.release() } catch (e: Exception) { }
        track = null
    }

    /** כפתורי הווליום באייפון משנים את עוצמת הקול בטלוויזיה (רק של השיקוף). */
    @JvmStatic
    fun onVolume(db: Float) {
        volume = when {
            db <= -144f -> 0f
            db >= 0f -> 1f
            else -> 10f.pow(db.coerceAtLeast(-30f) / 20f)
        }
        synchronized(audioLock) { try { track?.setVolume(volume) } catch (e: Exception) { } }
    }

    /** יומן קצר של AirPlay - אפשר להעתיק אותו מהשלט כשמשהו לא עובד */
    private val logLines = ArrayDeque<String>()

    fun log(): String = synchronized(logLines) { logLines.joinToString("\n") }

    @JvmStatic
    fun onLog(message: String) {
        Log.i(TAG, message)
        val time = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.US).format(java.util.Date())
        synchronized(logLines) {
            logLines.addLast("$time ${message.trim().take(300)}")
            while (logLines.size > 120) logLines.removeFirst()
        }
    }
}
