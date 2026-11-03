package com.myphone.tvremote.mirror

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioPlaybackCaptureConfiguration
import android.media.AudioRecord
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.util.DisplayMetrics
import android.util.Log
import android.view.Display
import android.view.Surface
import android.view.WindowManager
import java.io.BufferedOutputStream
import java.io.DataOutputStream
import java.net.InetSocketAddress
import java.net.Socket
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * השירות ששולח את המסך: מצלם את המסך, מקודד לווידאו (H.264, כמו מצלמת הווידאו של הטלפון),
 * ושולח ישר לטלוויזיה דרך ה-WiFi. גם הקול נשלח.
 */
class MirrorService : Service() {

    private val tag = "MirrorService"
    private var projection: MediaProjection? = null
    private var display: VirtualDisplay? = null
    private var encoder: MediaCodec? = null
    private var socket: Socket? = null
    private var out: DataOutputStream? = null
    private var audio: AudioRecord? = null
    private val writeLock = Any()
    @Volatile private var running = false
    @Volatile private var generation = 0
    private var width = 0
    private var height = 0
    private var dpi = 320
    private lateinit var worker: Handler
    private var savedVolume = -1

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopSelf()
            return START_NOT_STICKY
        }
        if (running) return START_NOT_STICKY
        val host = intent?.getStringExtra(EXTRA_HOST) ?: return START_NOT_STICKY.also { stopSelf() }
        val port = intent.getIntExtra(EXTRA_PORT, Protocol.PORT)
        val resultCode = intent.getIntExtra(EXTRA_RESULT, 0)
        val data: Intent? = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(EXTRA_DATA, Intent::class.java)
        else @Suppress("DEPRECATION") intent.getParcelableExtra(EXTRA_DATA)

        // באנדרואיד 14 חייבים להציג התראה לפני שמתחילים לצלם את המסך
        startForeground(1, notification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
        running = true
        status = "מתחבר לטלוויזיה…"
        val thread = HandlerThread("mirror").apply { start() }
        worker = Handler(thread.looper)
        worker.post { start(host, port, resultCode, data) }
        return START_NOT_STICKY
    }

    private fun start(host: String, port: Int, resultCode: Int, data: Intent?) {
        try {
            val s = Socket()
            s.tcpNoDelay = true
            s.sendBufferSize = 1 shl 20
            s.connect(InetSocketAddress(host, port), 5000)
            socket = s
            out = DataOutputStream(BufferedOutputStream(s.getOutputStream(), 1 shl 16)).also {
                it.write(Protocol.MAGIC.toByteArray())
                it.flush()
            }
        } catch (e: Exception) {
            Log.w(tag, "connect failed", e)
            fail("לא הצלחתי להתחבר לטלוויזיה. ודאו שהטלפון והטלוויזיה על אותה רשת WiFi.")
            return
        }

        val mpm = getSystemService(MediaProjectionManager::class.java)
        val mp = try { mpm.getMediaProjection(resultCode, data!!) } catch (e: Exception) { null }
        if (mp == null) {
            fail("לא קיבלתי אישור לשתף את המסך")
            return
        }
        projection = mp
        mp.registerCallback(object : MediaProjection.Callback() {
            override fun onStop() { stopSelf() }
        }, worker)

        measure()
        startEncoder()
        display = mp.createVirtualDisplay(
            "tvmirror", width, height, dpi, DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            inputSurface, null, worker,
        )
        watchRotation()
        startAudio(mp)
        status = "משקף לטלוויזיה ✓"
        onChange?.invoke()
    }

    /**
     * גודל התמונה לשליחה: נכנס במסגרת 1920x1080 כמו שהוא (טלפון עומד = עד 1080 גובה).
     * זה בדיוק הגודל שבו הטלוויזיה מציגה אותו, ומפענחים של טלוויזיות לא תמיד מסכימים לתמונה "עומדת" של 1920 גובה.
     */
    private fun measure() {
        val wm = getSystemService(WindowManager::class.java)
        val bounds = wm.maximumWindowMetrics.bounds
        val w = bounds.width().toFloat()
        val h = bounds.height().toFloat()
        val scale = minOf(1f, 1920f / w, 1080f / h)
        width = maxOf(16, ((w * scale) / 16f).toInt() * 16)
        height = maxOf(16, ((h * scale) / 16f).toInt() * 16)
        dpi = (resources.displayMetrics.densityDpi * scale).roundToInt().coerceAtLeast(120)
    }

    private var inputSurface: Surface? = null

    private fun startEncoder() {
        val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, width, height).apply {
            setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
            setInteger(MediaFormat.KEY_BIT_RATE, 8_000_000)
            setInteger(MediaFormat.KEY_FRAME_RATE, 30)
            setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
            // גם כשהמסך לא זז שולחים פריים מדי פעם, כדי שהטלוויזיה לא "תיתקע"
            setLong(MediaFormat.KEY_REPEAT_PREVIOUS_FRAME_AFTER, 100_000)
            setInteger(MediaFormat.KEY_PRIORITY, 0)
            if (Build.VERSION.SDK_INT >= 30) setInteger(MediaFormat.KEY_LATENCY, 1)
        }
        val codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
        codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        inputSurface = codec.createInputSurface()
        codec.start()
        encoder = codec
        send(Protocol.VIDEO_SIZE, 0, byteArrayOf((width shr 8).toByte(), width.toByte(), (height shr 8).toByte(), height.toByte()))
        val myGeneration = ++generation
        Thread({ drain(codec, myGeneration) }, "encoder").start()
    }

    /** מוציא מהמקודד את הפריימים המוכנים ושולח אותם. */
    private fun drain(codec: MediaCodec, myGeneration: Int) {
        val info = MediaCodec.BufferInfo()
        while (running && myGeneration == generation) {
            val index = try { codec.dequeueOutputBuffer(info, 10_000) } catch (e: Exception) { break }
            if (index < 0) continue
            val buffer = codec.getOutputBuffer(index)
            if (buffer != null && info.size > 0) {
                val bytes = ByteArray(info.size)
                buffer.position(info.offset)
                buffer.get(bytes)
                val type = when {
                    info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0 -> Protocol.VIDEO_CONFIG
                    info.flags and MediaCodec.BUFFER_FLAG_KEY_FRAME != 0 -> Protocol.VIDEO_KEYFRAME
                    else -> Protocol.VIDEO_FRAME
                }
                if (!send(type, info.presentationTimeUs, bytes)) break
            }
            try { codec.releaseOutputBuffer(index, false) } catch (e: Exception) { break }
        }
    }

    /** כשמסובבים את הטלפון - מתחילים מחדש בגודל החדש, כדי שהתמונה בטלוויזיה תתהפך איתו. */
    private fun watchRotation() {
        val dm = getSystemService(DisplayManager::class.java)
        dm.registerDisplayListener(object : DisplayManager.DisplayListener {
            override fun onDisplayAdded(displayId: Int) {}
            override fun onDisplayRemoved(displayId: Int) {}
            override fun onDisplayChanged(displayId: Int) {
                if (displayId != Display.DEFAULT_DISPLAY || !running) return
                val oldW = width
                val oldH = height
                measure()
                if (width == oldW && height == oldH) return
                val old = encoder
                generation++
                try { old?.stop(); old?.release() } catch (e: Exception) { }
                inputSurface = null
                startEncoder()
                display?.resize(width, height, dpi)
                display?.surface = inputSurface
            }
        }, worker)
    }

    /** הקול: מה שמתנגן בטלפון (סרטונים, משחקים) נשלח גם הוא. */
    private fun startAudio(mp: MediaProjection) {
        if (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) return
        try {
            val config = AudioPlaybackCaptureConfiguration.Builder(mp)
                .addMatchingUsage(AudioAttributes.USAGE_MEDIA)
                .addMatchingUsage(AudioAttributes.USAGE_GAME)
                .addMatchingUsage(AudioAttributes.USAGE_UNKNOWN)
                .build()
            val format = AudioFormat.Builder()
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(Protocol.AUDIO_RATE)
                .setChannelMask(AudioFormat.CHANNEL_IN_STEREO)
                .build()
            val min = AudioRecord.getMinBufferSize(Protocol.AUDIO_RATE, AudioFormat.CHANNEL_IN_STEREO, AudioFormat.ENCODING_PCM_16BIT)
            val record = AudioRecord.Builder()
                .setAudioFormat(format)
                .setBufferSizeInBytes(max(min, 3840 * 4))
                .setAudioPlaybackCaptureConfig(config)
                .build()
            record.startRecording()
            audio = record
            mutePhone()
            Thread({
                val chunk = ByteArray(3840) // 20 מילישניות
                while (running) {
                    val n = record.read(chunk, 0, chunk.size)
                    if (n > 0 && !send(Protocol.AUDIO_PCM, 0, chunk.copyOf(n))) break
                }
            }, "audio").start()
        } catch (e: Exception) {
            Log.w(tag, "audio capture not available", e)
        }
    }

    /**
     * משתיקים את הרמקול של הטלפון בזמן השיקוף - הקול יוצא רק מהטלוויזיה.
     * (הקול שנשלח לטלוויזיה נלקח לפני עוצמת הטלפון, אז הוא לא נפגע.) בסוף מחזירים את העוצמה.
     */
    private fun mutePhone() {
        try {
            val am = getSystemService(AudioManager::class.java)
            savedVolume = am.getStreamVolume(AudioManager.STREAM_MUSIC)
            am.setStreamVolume(AudioManager.STREAM_MUSIC, 0, 0)
        } catch (e: Exception) {
            Log.w(tag, "mute", e)
        }
    }

    private fun restorePhoneVolume() {
        if (savedVolume < 0) return
        try {
            getSystemService(AudioManager::class.java).setStreamVolume(AudioManager.STREAM_MUSIC, savedVolume, 0)
        } catch (e: Exception) { }
        savedVolume = -1
    }

    private fun send(type: Int, pts: Long, payload: ByteArray): Boolean {
        val stream = out ?: return false
        return try {
            synchronized(writeLock) {
                stream.writeByte(type)
                stream.writeInt(payload.size)
                stream.writeLong(pts)
                stream.write(payload)
                stream.flush()
            }
            true
        } catch (e: Exception) {
            if (running) worker.post { fail("החיבור לטלוויזיה נקטע") }
            false
        }
    }

    private fun fail(message: String) {
        status = message
        onChange?.invoke()
        stopSelf()
    }

    override fun onDestroy() {
        running = false
        generation++
        try { audio?.stop(); audio?.release() } catch (e: Exception) { }
        restorePhoneVolume()
        try { display?.release() } catch (e: Exception) { }
        try { encoder?.stop(); encoder?.release() } catch (e: Exception) { }
        try { projection?.stop() } catch (e: Exception) { }
        try { socket?.close() } catch (e: Exception) { }
        if (status.startsWith("משקף")) status = "השיקוף הופסק"
        onChange?.invoke()
        super.onDestroy()
    }

    private fun notification(): Notification {
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel("mirror", "שיקוף מסך", NotificationManager.IMPORTANCE_LOW))
        val stop = PendingIntent.getService(
            this, 0, Intent(this, MirrorService::class.java).setAction(ACTION_STOP), PendingIntent.FLAG_IMMUTABLE,
        )
        val open = PendingIntent.getActivity(this, 0, Intent(this, MirrorActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        return Notification.Builder(this, "mirror")
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle("משקף לטלוויזיה")
            .setContentText("לחצו כדי לעצור")
            .setContentIntent(open)
            .addAction(Notification.Action.Builder(null, "עצור שיקוף", stop).build())
            .setOngoing(true)
            .build()
    }

    companion object {
        const val EXTRA_HOST = "host"
        const val EXTRA_PORT = "port"
        const val EXTRA_RESULT = "result"
        const val EXTRA_DATA = "data"
        const val ACTION_STOP = "stop"

        @Volatile var status = ""
        @Volatile var onChange: (() -> Unit)? = null
        val isRunning get() = status.startsWith("משקף") || status.startsWith("מתחבר")

        fun stop(context: Context) {
            context.startService(Intent(context, MirrorService::class.java).setAction(ACTION_STOP))
        }
    }
}
