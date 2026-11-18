package com.myphone.tvremote

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Rect
import android.os.Bundle
import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import android.view.Gravity
import android.view.KeyEvent
import android.view.PixelCopy
import android.view.SurfaceHolder
import android.view.SurfaceView
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.TextView
import kotlin.math.abs

/**
 * מסך מלא שמציג את השיקוף מהטלפון. "חזור" או "בית" בשלט סוגרים אותו.
 *
 * הגדלה אוטומטית: מסך של אייפון צר וארוך יותר ממסך טלוויזיה, ולכן סרטון (למשל מטלגרם) מופיע קטן
 * עם פסים שחורים מסביב. פעם בשנייה בודקים תמונה קטנה מהשיקוף: אם יש פסים שחורים מסביב לסרטון -
 * מגדילים בדיוק את הסרטון למסך מלא. כשהפסים נעלמים - חוזרים לתמונה המלאה.
 * OK בשלט מחליף בין "הגדלה אוטומטית" ל"תמיד כל המסך של הטלפון".
 */
class MirrorActivity : Activity(), MirrorServer.Screen {

    private lateinit var surfaceView: SurfaceView
    private lateinit var root: FrameLayout
    private lateinit var hint: TextView
    private lateinit var badge: TextView
    private val main = Handler(Looper.getMainLooper())
    private var videoW = 0
    private var videoH = 0
    private var hasSurface = false

    /** החלק של התמונה שמוצג כרגע על כל המסך (ביחידות של 0..1 מהתמונה). null = כל התמונה */
    private var crop: FloatArray? = null
    private var candidate: FloatArray? = null
    private var candidateCount = 0
    private var autoZoom = true

    private val copyThread = HandlerThread("mirror-zoom").apply { start() }
    private val copyHandler = Handler(copyThread.looper)
    private var sample: Bitmap? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        autoZoom = getSharedPreferences("mirror", MODE_PRIVATE).getBoolean("auto_zoom", true)
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
        badge = TextView(this).apply {
            setTextColor(Color.WHITE)
            textSize = 18f
            setPadding(36, 18, 36, 18)
            background = android.graphics.drawable.GradientDrawable().apply {
                cornerRadius = 60f
                setColor(Color.argb(170, 20, 10, 40))
            }
            visibility = View.GONE
        }
        root.addView(badge, FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.TOP or Gravity.CENTER_HORIZONTAL).apply { topMargin = 48 })
        setContentView(root)
        surfaceView.holder.addCallback(object : SurfaceHolder.Callback {
            override fun surfaceCreated(holder: SurfaceHolder) {
                hasSurface = true
                MirrorServer.attach(holder.surface)
                AirPlayServer.attach(holder.surface)
            }
            override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {}
            override fun surfaceDestroyed(holder: SurfaceHolder) {
                hasSurface = false
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
        main.removeCallbacks(checkBars)
        main.postDelayed(checkBars, 1500)
    }

    override fun onPause() {
        main.removeCallbacks(checkBars)
        if (MirrorServer.screen === this) MirrorServer.screen = null
        if (AirPlayServer.screen === this) AirPlayServer.screen = null
        super.onPause()
    }

    override fun onVideoSize(width: Int, height: Int) {
        if (width != videoW || height != videoH) {
            // סיבוב / אפליקציה אחרת - מתחילים בלי הגדלה, והבדיקה הבאה תחליט מחדש
            crop = null
            candidate = null
            candidateCount = 0
            blackChecks = 0
        }
        videoW = width
        videoH = height
        hint.visibility = View.GONE
        // המשטח בגודל הווידאו עצמו; המסך מגדיל אותו (חוסך זיכרון ועבודה)
        if (width > 0 && height > 0) surfaceView.holder.setFixedSize(width, height)
        root.post {
            if (autoZoom && crop == null) crop = wideCrop()
            layoutVideo()
        }
    }

    /** ממקם את התמונה: כולה בתוך המסך, או - כשיש הגדלה - רק החלק של הסרטון, על כל המסך. */
    private fun layoutVideo() {
        val sw = root.width.toFloat()
        val sh = root.height.toFloat()
        val w = videoW.toFloat()
        val h = videoH.toFloat()
        if (sw <= 0 || sh <= 0 || w <= 0 || h <= 0) return
        val c = crop ?: floatArrayOf(0f, 0f, 1f, 1f)
        val cw = (c[2] - c[0]) * w
        val ch = (c[3] - c[1]) * h
        val scale = minOf(sw / cw, sh / ch)
        val vw = w * scale
        val vh = h * scale
        val cx = (c[0] + c[2]) / 2 * vw
        val cy = (c[1] + c[3]) / 2 * vh
        val params = FrameLayout.LayoutParams(vw.toInt(), vh.toInt(), Gravity.TOP or Gravity.LEFT).apply {
            leftMargin = (sw / 2 - cx).toInt()
            topMargin = (sh / 2 - cy).toInt()
        }
        surfaceView.layoutParams = params
    }

    // ===== זיהוי פסים שחורים =====

    private val checkBars = object : Runnable {
        override fun run() {
            main.postDelayed(this, 1000)
            if (!autoZoom || !hasSurface || videoW <= 0 || videoH <= 0) return
            val bw = if (videoW >= videoH) 96 else 54
            val bh = (bw * videoH.toFloat() / videoW).toInt().coerceAtLeast(16)
            val bmp = sample?.takeIf { it.width == bw && it.height == bh && !it.isRecycled }
                ?: Bitmap.createBitmap(bw, bh, Bitmap.Config.ARGB_8888).also { sample?.recycle(); sample = it }
            try {
                PixelCopy.request(surfaceView, bmp, { result ->
                    if (result == PixelCopy.SUCCESS) {
                        val found = contentRect(bmp)
                        main.post { onContent(found) }
                    } else {
                        // הטלוויזיה לא נותנת לקרוא את התמונה - עובדים לפי הצורה של התמונה בלבד
                        main.post {
                            if (++copyFailures == 1) logZoom("pixel copy failed ($result) - using wide-phone crop")
                            onContent(null)
                        }
                    }
                }, copyHandler)
            } catch (e: Exception) {
            }
        }
    }

    /**
     * איפה יש תמונה (לא שחור) בתוך הפריים: [שמאל, למעלה, ימין, למטה, צפיפות].
     * null = הפריים כולו שחור (למשל סצנה חשוכה) - לא משנים כלום.
     *
     * לוקחים את הרצועה הרציפה הגדולה ביותר של שורות "מלאות" ואז של עמודות "מלאות". כך השעון והסוללה
     * של האייפון למעלה, הכיתוב והכפתורים של טלגרם מתחת לסרטון - שמופרדים ממנו בשחור - לא נחשבים חלק מהסרטון.
     */
    private fun contentRect(b: Bitmap): FloatArray? {
        val w = b.width
        val h = b.height
        val px = IntArray(w * h)
        b.getPixels(px, 0, w, 0, 0, w, h)
        val bright = BooleanArray(px.size) { val p = px[it]; maxOf((p shr 16) and 0xff, (p shr 8) and 0xff, p and 0xff) > 24 }
        val rowFill = IntArray(h)
        for (y in 0 until h) for (x in 0 until w) if (bright[y * w + x]) rowFill[y]++
        val (top, bottom) = longestRun(h) { rowFill[it] >= w / 4 } ?: return null
        val colFill = IntArray(w)
        for (y in top..bottom) for (x in 0 until w) if (bright[y * w + x]) colFill[x]++
        val rows = bottom - top + 1
        val (left, right) = longestRun(w) { colFill[it] >= maxOf(1, rows / 4) } ?: return null
        var lit = 0
        for (y in top..bottom) for (x in left..right) if (bright[y * w + x]) lit++
        val density = lit.toFloat() / (rows * (right - left + 1))
        return floatArrayOf(left.toFloat() / w, top.toFloat() / h, (right + 1).toFloat() / w, (bottom + 1).toFloat() / h, density)
    }

    /** הרצף הארוך ביותר של מקומות "מלאים" (סובלים חור קטן של 1-2 שורות חשוכות באמצע סרטון). */
    private fun longestRun(n: Int, full: (Int) -> Boolean): Pair<Int, Int>? {
        val gap = maxOf(1, n / 40)
        var best: Pair<Int, Int>? = null
        var start = -1
        var last = -1
        for (i in 0 until n) {
            if (!full(i)) continue
            if (start < 0 || i - last > gap + 1) start = i
            last = i
            if (best == null || last - start > best.second - best.first) best = start to last
        }
        return best
    }

    private fun onContent(found: FloatArray?) {
        if (isFinishing) return
        if (found == null) {
            // הכול שחור: או סצנה חשוכה, או שהטלוויזיה לא נותנת לקרוא את התמונה. כשאין שום פריים בהיר -
            // לפחות חותכים את השוליים של אייפון שוכב, כדי שסרטון ימלא את המסך.
            if (++blackChecks == 4) logZoom("frames look black - using wide-phone crop")
            if (blackChecks >= 4 && crop == null && wideCrop() != null) { crop = wideCrop(); layoutVideo() }
            return
        }
        blackChecks = 0
        val fw = found[2] - found[0]
        val fh = found[3] - found[1]
        val aspect = (fw * videoW) / (fh * videoH).coerceAtLeast(1f)
        // מגדילים רק כשזה נראה כמו סרטון: מלבן "שוכב" (כמו 16:9), מלא בתמונה, עם פסים שחורים מסביב.
        // מסך רגיל של הטלפון (גם במצב כהה, שבו הרקע שחור) לא מוגדל.
        val videoLike = found[4] > 0.5f && aspect in 1.2f..2.6f && fh > 0.15f && fw > 0.3f && fw * fh < 0.94f
        val target: FloatArray? = if (!videoLike) wideCrop() else {
            val m = 0.005f
            floatArrayOf((found[0] - m).coerceAtLeast(0f), (found[1] - m).coerceAtLeast(0f), (found[2] + m).coerceAtMost(1f), (found[3] + m).coerceAtMost(1f))
        }
        if (same(target, crop)) { candidate = null; candidateCount = 0; return }
        if (same(target, candidate)) candidateCount++ else { candidate = target; candidateCount = 1 }
        // מגדילים אחרי 2 בדיקות זהות; חוזרים לתמונה המלאה רק אחרי 3 (כדי שלחיצה על הסרטון בטלפון לא תקפיץ)
        val needed = if (target == null) 3 else 2
        if (candidateCount >= needed) {
            logZoom(if (target == null) "zoom off" else "zoom to " + target.joinToString(",") { "%.2f".format(it) })
            crop = target
            candidate = null
            candidateCount = 0
            layoutVideo()
        }
    }

    private var blackChecks = 0
    private var copyFailures = 0

    /**
     * אייפון שוכב משדר תמונה צרה וארוכה (בערך 2.16:1), והאפליקציות משאירות בצדדים שוליים ריקים (בגלל ה"אי").
     * חותכים ל-16:9 של הטלוויזיה - סרטון שוכב (טלגרם, יוטיוב) ממלא את כל המסך, ושום דבר חשוב לא נחתך.
     */
    private fun wideCrop(): FloatArray? {
        if (videoW <= 0 || videoH <= 0) return null
        val aspect = videoW.toFloat() / videoH
        val screen = if (root.height > 0) root.width.toFloat() / root.height else 16f / 9f
        if (aspect < screen * 1.06f) return null
        val keep = screen / aspect
        val side = (1f - keep) / 2f
        return floatArrayOf(side, 0f, 1f - side, 1f)
    }

    private fun logZoom(message: String) {
        AirPlayServer.onLog("zoom: $message (video ${videoW}x$videoH mode=${if (autoZoom) "auto" else "off"})")
    }

    private fun same(a: FloatArray?, b: FloatArray?): Boolean {
        if (a == null || b == null) return a == null && b == null
        for (i in 0..3) if (abs(a[i] - b[i]) > 0.04f) return false
        return true
    }

    // ===== שלט =====

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (keyCode == KeyEvent.KEYCODE_DPAD_CENTER || keyCode == KeyEvent.KEYCODE_ENTER) {
            if (event.repeatCount == 0) toggleZoom()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    fun toggleZoom() {
        autoZoom = !autoZoom
        getSharedPreferences("mirror", MODE_PRIVATE).edit().putBoolean("auto_zoom", autoZoom).apply()
        if (!autoZoom) {
            crop = null
            layoutVideo()
        }
        candidate = null
        candidateCount = 0
        badge.text = if (autoZoom) "הגדלה אוטומטית של סרטונים: פועל" else "הגדלה אוטומטית: כבוי · כל המסך של הטלפון"
        badge.visibility = View.VISIBLE
        main.removeCallbacks(hideBadge)
        main.postDelayed(hideBadge, 2500)
    }

    private val hideBadge = Runnable { badge.visibility = View.GONE }

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
        main.removeCallbacksAndMessages(null)
        copyThread.quitSafely()
        if (current === this) current = null
        super.onDestroy()
    }

    override fun onStart() {
        super.onStart()
        current = this
    }

    companion object {
        /** המסך הפתוח כרגע - כדי שכפתור "זום" בטלפון יוכל להחליף מצב */
        @Volatile var current: MirrorActivity? = null
            private set
    }
}
