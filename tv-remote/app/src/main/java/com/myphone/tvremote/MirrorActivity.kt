package com.myphone.tvremote

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.view.SurfaceHolder
import android.view.SurfaceView
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.TextView

/** מסך מלא שמציג את השיקוף מהטלפון. "חזור" או "בית" בשלט סוגרים אותו. */
class MirrorActivity : Activity(), MirrorServer.Screen {

    private lateinit var surfaceView: SurfaceView
    private lateinit var root: FrameLayout
    private lateinit var hint: TextView
    private var videoW = 0
    private var videoH = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        root = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
        surfaceView = SurfaceView(this)
        root.addView(surfaceView, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT, Gravity.CENTER))
        hint = TextView(this).apply {
            text = "מתחבר לטלפון…"
            setTextColor(Color.WHITE)
            textSize = 22f
            gravity = Gravity.CENTER
        }
        root.addView(hint, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        setContentView(root)
        surfaceView.holder.addCallback(object : SurfaceHolder.Callback {
            override fun surfaceCreated(holder: SurfaceHolder) {
                MirrorServer.attach(holder.surface)
                AirPlayServer.attach(holder.surface)
            }
            override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {}
            override fun surfaceDestroyed(holder: SurfaceHolder) {
                MirrorServer.attach(null)
                AirPlayServer.attach(null)
            }
        })
    }

    override fun onResume() {
        super.onResume()
        MirrorServer.screen = this
        AirPlayServer.screen = this
        if (!MirrorServer.isActive && !AirPlayServer.isActive) finish()
        AirPlayServer.shownSize?.let { (w, h) -> onVideoSize(w, h) }
        if (MirrorServer.isActive) MirrorServer.lastSize?.let { (w, h) -> onVideoSize(w, h) }
    }

    override fun onPause() {
        if (MirrorServer.screen === this) MirrorServer.screen = null
        if (AirPlayServer.screen === this) AirPlayServer.screen = null
        super.onPause()
    }

    /** התמונה נכנסת למסך בלי להימתח (פסים שחורים בצדדים כשהטלפון עומד). */
    override fun onVideoSize(width: Int, height: Int) {
        videoW = width
        videoH = height
        hint.visibility = View.GONE
        root.post {
            val sw = root.width.toFloat()
            val sh = root.height.toFloat()
            if (sw <= 0 || sh <= 0 || width <= 0 || height <= 0) return@post
            val scale = minOf(sw / width, sh / height)
            surfaceView.layoutParams = FrameLayout.LayoutParams((width * scale).toInt(), (height * scale).toInt(), Gravity.CENTER)
        }
    }

    override fun onEnded() {
        finish()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        MirrorServer.stop()
        AirPlayServer.stop()
        finish()
    }

    override fun onDestroy() {
        if (isFinishing && MirrorServer.isActive) MirrorServer.stop()
        if (isFinishing && AirPlayServer.isActive) AirPlayServer.stop()
        super.onDestroy()
    }
}
