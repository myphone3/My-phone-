package com.myphone.tvremote

import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.media.MediaCodec
import android.media.MediaFormat
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Surface
import java.io.BufferedInputStream
import java.io.DataInputStream
import java.net.ServerSocket
import java.net.Socket

/**
 * מקבל שיקוף מסך מאפליקציית "שיקוף לטלוויזיה" בגלקסי: וידאו (H.264) וקול, ישר דרך ה-WiFi,
 * ומציג על מסך מלא. ה-WiFi לא נופל (בניגוד ל-Miracast), כך שהשלט ממשיך לעבוד בזמן השיקוף.
 */
object MirrorServer {
    /** יומן קצר לדוח התקלות */
    private val logLines = ArrayDeque<String>()
    fun log(): String = synchronized(logLines) { logLines.joinToString("\n") }
    fun note(msg: String) {
        Log.i(TAG, msg)
        val t = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.US).format(java.util.Date())
        synchronized(logLines) { logLines.addLast("$t $msg"); while (logLines.size > 80) logLines.removeFirst() }
    }

    private const val TAG = "MirrorServer"
    const val PORT = 8090
    private const val MAGIC = "TVM1"
    private const val VIDEO_CONFIG = 1
    private const val VIDEO_FRAME = 2
    private const val AUDIO_PCM = 3
    private const val VIDEO_SIZE = 4
    private const val VIDEO_KEYFRAME = 5

    private val main = Handler(Looper.getMainLooper())
    private lateinit var appContext: Context
    private var started = false
    @Volatile private var session: Session? = null

    /** המסך שמציג את השיקוף נרשם כאן. */
    @Volatile var screen: Screen? = null

    interface Screen {
        fun onVideoSize(width: Int, height: Int)
        fun onEnded()
    }

    @Synchronized
    fun start(context: Context) {
        if (started) return
        started = true
        appContext = context.applicationContext
        Thread({ acceptLoop() }, "mirror-accept").start()
        advertise()
    }

    /** מכריזים על הטלוויזיה ברשת, כדי שאפליקציית השיקוף בגלקסי תמצא אותה לבד. */
    private fun advertise() {
        try {
            val info = NsdServiceInfo().apply {
                serviceName = TvIdentity.name(appContext)
                serviceType = "_tvmirror._tcp."
                port = PORT
            }
            appContext.getSystemService(NsdManager::class.java)?.registerService(
                info, NsdManager.PROTOCOL_DNS_SD,
                object : NsdManager.RegistrationListener {
                    override fun onServiceRegistered(serviceInfo: NsdServiceInfo) {}
                    override fun onRegistrationFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {}
                    override fun onServiceUnregistered(serviceInfo: NsdServiceInfo) {}
                    override fun onUnregistrationFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {}
                },
            )
        } catch (e: Exception) {
            Log.w(TAG, "nsd", e)
        }
    }

    private fun acceptLoop() {
        while (true) {
            try {
                ServerSocket(PORT).use { server ->
                    while (true) {
                        val socket = server.accept()
                        // טלפון חדש מחליף את הקודם
                        session?.close()
                        val s = Session(socket)
                        session = s
                        Thread({ s.run() }, "mirror-session").start()
                    }
                }
            } catch (e: Exception) {
                note("server error: $e")
                Thread.sleep(2000)
            }
        }
    }

    /** המסך נפתח/נסגר: מחברים או מנתקים את התצוגה. */
    fun attach(surface: Surface?) {
        session?.setSurface(surface)
    }

    /** המשתמש סגר את השיקוף בטלוויזיה (חזור/בית). */
    fun stop() {
        session?.close()
        session = null
    }

    val isActive get() = session != null

    /** גודל התמונה האחרון - המסך שנפתח באיחור קורא אותו מכאן */
    @Volatile var lastSize: Pair<Int, Int>? = null

    private class Session(private val socket: Socket) {
        private var decoder: MediaCodec? = null
        private var surface: Surface? = null
        private var width = 0
        private var height = 0
        private var config: ByteArray? = null
        private var waitingForKeyframe = true
        private var audio: AudioTrack? = null
        @Volatile private var closed = false
        private val lock = Object()

        fun run() {
            try {
                socket.tcpNoDelay = true
                socket.receiveBufferSize = 1 shl 20
                val input = DataInputStream(BufferedInputStream(socket.getInputStream(), 1 shl 16))
                val magic = ByteArray(4)
                input.readFully(magic)
                if (String(magic) != MAGIC) { note("bad magic from ${socket.inetAddress}"); return }
                note("phone connected ${socket.inetAddress?.hostAddress}")
                openScreen()
                while (!closed) {
                    val type = input.readUnsignedByte()
                    val size = input.readInt()
                    val pts = input.readLong()
                    if (size < 0 || size > 8 shl 20) break
                    val payload = ByteArray(size)
                    input.readFully(payload)
                    when (type) {
                        VIDEO_SIZE -> {
                            width = ((payload[0].toInt() and 0xff) shl 8) or (payload[1].toInt() and 0xff)
                            height = ((payload[2].toInt() and 0xff) shl 8) or (payload[3].toInt() and 0xff)
                            note("video size ${width}x$height")
                            synchronized(lock) { restartDecoder() }
                            lastSize = width to height
                            main.post { screen?.onVideoSize(width, height) }
                        }
                        VIDEO_CONFIG -> {
                            note("video config ${payload.size}B surface=${surface != null} size=${width}x$height")
                            config = payload
                            synchronized(lock) { restartDecoder() }
                        }
                        VIDEO_KEYFRAME, VIDEO_FRAME -> synchronized(lock) {
                            frames++
                            if (frames <= 2 || (type == VIDEO_KEYFRAME && frames < 200)) note("frame #$frames key=${type == VIDEO_KEYFRAME} ${payload.size}B decoder=${decoder != null} waiting=$waitingForKeyframe")
                            if (type == VIDEO_KEYFRAME) {
                                if (decoder == null) restartDecoder() // למשל אחרי תקלה במפענח
                                waitingForKeyframe = false
                            }
                            if (!waitingForKeyframe) feed(payload, pts, 0)
                        }
                        AUDIO_PCM -> playAudio(payload)
                    }
                }
            } catch (e: Exception) {
                note("session ended: $e")
            } finally {
                close()
            }
        }

        private fun openScreen() {
            try {
                appContext.startActivity(
                    Intent(appContext, MirrorActivity::class.java)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
                )
            } catch (e: Exception) {
                AdbBridge.shell("am start -n ${appContext.packageName}/${appContext.packageName}.MirrorActivity")
            }
        }

        fun setSurface(s: Surface?) = synchronized(lock) {
            note("surface ${if (s != null) "ready" else "gone"}")
            surface = s
            restartDecoder()
        }

        /** מתחילים מפענח חדש (כשיש מסך, גודל והגדרות), ומחכים לפריים מלא הבא. */
        private fun restartDecoder() {
            try { decoder?.stop(); decoder?.release() } catch (e: Exception) { }
            decoder = null
            waitingForKeyframe = true
            val s = surface ?: return
            val c = config ?: return
            if (width <= 0 || height <= 0) return
            // קודם עם "השהיה נמוכה"; אם המפענח של הטלוויזיה לא מכיר את זה - בלי
            for (lowLatency in listOf(true, false)) {
                var codec: MediaCodec? = null
                try {
                    val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, width, height)
                    format.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 2 shl 20)
                    if (lowLatency) {
                        if (Build.VERSION.SDK_INT >= 30) format.setInteger(MediaFormat.KEY_LOW_LATENCY, 1)
                        format.setInteger(MediaFormat.KEY_PRIORITY, 0)
                    }
                    codec = MediaCodec.createDecoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
                    codec.configure(format, s, null, 0)
                    codec.start()
                    decoder = codec
                    note("decoder started ${width}x$height lowLatency=$lowLatency ${codec.name}")
                    feed(c, 0, MediaCodec.BUFFER_FLAG_CODEC_CONFIG)
                    return
                } catch (e: Exception) {
                    note("decoder failed lowLatency=$lowLatency ${width}x$height: $e")
                    try { codec?.release() } catch (x: Exception) { }
                    decoder = null
                }
            }
        }

        private val info = MediaCodec.BufferInfo()
        private var rendered = 0L
        private var frames = 0L

        private fun feed(data: ByteArray, pts: Long, flags: Int) {
            val codec = decoder ?: return
            try {
                val index = codec.dequeueInputBuffer(20_000)
                if (index >= 0) {
                    val buffer = codec.getInputBuffer(index) ?: return
                    buffer.clear()
                    if (data.size > buffer.capacity()) return
                    buffer.put(data)
                    codec.queueInputBuffer(index, 0, data.size, pts, flags)
                }
                // מציגים מיד כל פריים מוכן - בלי לחכות, בשביל השהיה מינימלית
                while (true) {
                    val out = codec.dequeueOutputBuffer(info, 0)
                    if (out >= 0) {
                        codec.releaseOutputBuffer(out, true)
                        rendered++
                        if (rendered == 1L || rendered % 600 == 0L) note("rendered frame #$rendered")
                    } else if (out == MediaCodec.INFO_TRY_AGAIN_LATER) break
                }
            } catch (e: Exception) {
                note("feed error: $e")
                try { codec.release() } catch (x: Exception) { }
                decoder = null
                waitingForKeyframe = true
            }
        }

        private fun playAudio(pcm: ByteArray) {
            val track = audio ?: try {
                val min = AudioTrack.getMinBufferSize(48000, AudioFormat.CHANNEL_OUT_STEREO, AudioFormat.ENCODING_PCM_16BIT)
                AudioTrack.Builder()
                    .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MOVIE).build())
                    .setAudioFormat(AudioFormat.Builder().setEncoding(AudioFormat.ENCODING_PCM_16BIT).setSampleRate(48000).setChannelMask(AudioFormat.CHANNEL_OUT_STEREO).build())
                    .setBufferSizeInBytes(maxOf(min, 3840 * 6))
                    .setTransferMode(AudioTrack.MODE_STREAM)
                    .build()
                    .also { it.play(); audio = it }
            } catch (e: Exception) {
                return
            }
            track.write(pcm, 0, pcm.size, AudioTrack.WRITE_NON_BLOCKING)
        }

        fun close() {
            if (closed) return
            closed = true
            try { socket.close() } catch (e: Exception) { }
            synchronized(lock) {
                try { decoder?.stop(); decoder?.release() } catch (e: Exception) { }
                decoder = null
            }
            try { audio?.stop(); audio?.release() } catch (e: Exception) { }
            if (session === this) { session = null; lastSize = null }
            main.post { screen?.onEnded() }
        }
    }
}
