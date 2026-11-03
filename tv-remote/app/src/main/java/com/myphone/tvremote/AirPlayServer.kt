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

    @Synchronized
    fun start(context: Context) {
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
        started = true
        multicastLock = appContext.getSystemService(WifiManager::class.java)
            ?.createMulticastLock("airplay")?.apply { setReferenceCounted(false); acquire() }
        Thread({ launch() }, "airplay-start").start()
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
        val dm = appContext.resources.displayMetrics
        // מבקשים מהאייפון תמונה בגודל המסך (לרוב 1920x1080), 30 פריימים בשנייה - חלק ובלי להעמיס על הטלוויזיה
        val w = maxOf(dm.widthPixels, dm.heightPixels).coerceIn(1280, 1920)
        val h = minOf(dm.widthPixels, dm.heightPixels).coerceIn(720, 1080)
        val key = File(appContext.filesDir, "airplay_key.pem").absolutePath
        val result = try {
            nativeStart(TvIdentity.name(appContext), mac(), key, w, h, 30)
        } catch (t: Throwable) {
            lastError = "start: $t"
            -100
        }
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

    fun attach(s: Surface?) = synchronized(lock) {
        surface = s
        releaseVideo()
        if (s != null) replay()
    }

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
            AdbBridge.shell("am start -n ${appContext.packageName}/${appContext.packageName}.MirrorActivity")
        }
    }

    private fun endSession() {
        val wasActive = isActive
        isActive = false
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

    private var decoder: MediaCodec? = null
    private var sps: ByteArray? = null
    private var pps: ByteArray? = null
    private var videoW = 1920
    private var videoH = 1080
    /** הפריימים מאז הפריים המלא האחרון - כדי שהתמונה תופיע מיד כשהמסך נפתח. */
    private val gop = ArrayList<Pair<ByteArray, Long>>()
    private var gopBytes = 0
    private val info = MediaCodec.BufferInfo()

    @JvmStatic
    fun onVideoSize(width: Int, height: Int, h265: Boolean) {
        Log.i(TAG, "video size $width x $height h265=$h265")
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
        synchronized(lock) {
            val idr = scanNals(data)
            if (idr) {
                gop.clear()
                gopBytes = 0
            }
            if (gopBytes < 12 shl 20 && gop.size < 400) {
                gop += data to ptsUs
                gopBytes += data.size
            }
            if (decoder == null) {
                if (surface != null && idr) startDecoder() else return
            }
            feed(data, ptsUs)
        }
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
        val s = surface ?: return
        val spsData = sps ?: return
        val ppsData = pps ?: return
        try {
            val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, videoW, videoH)
            format.setByteBuffer("csd-0", ByteBuffer.wrap(spsData))
            format.setByteBuffer("csd-1", ByteBuffer.wrap(ppsData))
            format.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 2 shl 20)
            if (Build.VERSION.SDK_INT >= 30) format.setInteger(MediaFormat.KEY_LOW_LATENCY, 1)
            format.setInteger(MediaFormat.KEY_PRIORITY, 0)
            val codec = MediaCodec.createDecoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
            codec.configure(format, s, null, 0)
            codec.start()
            decoder = codec
        } catch (e: Exception) {
            Log.w(TAG, "decoder", e)
            decoder = null
        }
    }

    /** המסך נפתח באמצע: מתחילים מהפריים המלא האחרון ומריצים קדימה עד עכשיו. */
    private fun replay() {
        if (gop.isEmpty()) return
        startDecoder()
        for ((d, p) in gop.toList()) feed(d, p)
    }

    private fun feed(data: ByteArray, pts: Long) {
        val codec = decoder ?: return
        try {
            val index = codec.dequeueInputBuffer(30_000)
            if (index >= 0) {
                val buffer = codec.getInputBuffer(index)
                if (buffer != null && data.size <= buffer.capacity()) {
                    buffer.clear()
                    buffer.put(data)
                    codec.queueInputBuffer(index, 0, data.size, pts, 0)
                } else {
                    codec.queueInputBuffer(index, 0, 0, pts, 0)
                }
            }
            // מציגים מיד כל פריים מוכן - השהיה מינימלית
            while (true) {
                val out = codec.dequeueOutputBuffer(info, 0)
                when {
                    out >= 0 -> codec.releaseOutputBuffer(out, true)
                    out == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> reportSize(codec.outputFormat)
                    out == MediaCodec.INFO_TRY_AGAIN_LATER -> break
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "feed", e)
            releaseVideo()
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
        Log.i(TAG, "video reset")
        endSession()
    }

    @JvmStatic
    fun onConnection(count: Int) {
        if (count == 0 && isActive) endSession()
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
        Log.i(TAG, "audio ct=$ct spf=$spf")
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
            Log.w(TAG, "audio decoder ct=$ct", e)
            null
        }
    }

    private fun hex(s: String) = ByteArray(s.length / 2) { s.substring(it * 2, it * 2 + 2).toInt(16).toByte() }

    private fun play(pcm: ByteArray) {
        val t = track ?: try {
            val min = AudioTrack.getMinBufferSize(44100, AudioFormat.CHANNEL_OUT_STEREO, AudioFormat.ENCODING_PCM_16BIT)
            AudioTrack.Builder()
                .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MOVIE).build())
                .setAudioFormat(AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(44100).setChannelMask(AudioFormat.CHANNEL_OUT_STEREO).build())
                .setBufferSizeInBytes(maxOf(min, 1920 * 8))
                .setTransferMode(AudioTrack.MODE_STREAM)
                .build()
                .also { it.setVolume(volume); it.play(); track = it }
        } catch (e: Exception) {
            return
        }
        t.write(pcm, 0, pcm.size, AudioTrack.WRITE_NON_BLOCKING)
    }

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

    @JvmStatic
    fun onLog(message: String) {
        Log.i(TAG, message)
    }
}
