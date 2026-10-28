package com.myphone.tvremote

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PixelFormat
import android.graphics.Shader
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.util.DisplayMetrics
import android.util.Log
import android.view.Choreographer
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityNodeInfo
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * סמן עכבר שמצויר מעל כל המסך בטלוויזיה. הטלפון שולח תזוזות, הסמן נע אליהן בצורה חלקה,
 * ולחיצה נשלחת כ"נגיעה" במקום שבו הסמן נמצא.
 */
@SuppressLint("StaticFieldLeak")
object CursorOverlay {
    private const val TAG = "CursorOverlay"
    private const val HIDE_AFTER_MS = 3000L

    private val main = Handler(Looper.getMainLooper())
    private lateinit var appContext: Context
    private var view: CursorView? = null
    private var screenW = 1920f
    private var screenH = 1080f

    // היעד (לאן הטלפון הזיז) והמיקום המוצג (שמתקרב ליעד בכל פריים)
    @Volatile private var targetX = 960f
    @Volatile private var targetY = 540f
    private var shownX = 960f
    private var shownY = 540f
    private var lastActivity = 0L
    private var clickPulse = 0f

    fun init(context: Context) {
        appContext = context.applicationContext
    }

    fun move(dx: Float, dy: Float) = main.post {
        if (!ensureView()) return@post
        val scale = screenW / 780f
        targetX = (targetX + dx * scale).coerceIn(0f, screenW - 1)
        targetY = (targetY + dy * scale).coerceIn(0f, screenH - 1)
        wake()
    }

    /** מה קרה בלחיצה האחרונה - מוצג בטלפון כדי שנדע מה עבד. */
    @Volatile var lastClick = ""
        private set

    /**
     * לחיצה. אפליקציות טלוויזיה (המסך הראשי, נטפליקס, אפל TV) מתעלמות מנגיעות במסך,
     * אז: יוצאים מ"מצב מגע", מסמנים את הפריט שמתחת לסמן, ולוחצים OK - בדיוק כמו בשלט.
     * באתרים (כרום) - נגיעה אמיתית במסך.
     */
    fun click(): String {
        main.post {
            if (!ensureView()) return@post
            snap()
            clickPulse = 1f
            wake()
        }
        val x = targetX
        val y = targetY
        lastClick = try {
            AdbBridge.sequence { run ->
                val a11y = RemoteAccessibility.instance
                val target = a11y?.targetAt(x, y)
                val tap = {
                    if (a11y == null || !a11y.tap(x, y, 40)) run("input tap ${x.toInt()} ${y.toInt()}")
                }
                val what = target?.let { describe(it.focusable ?: it.clickable) }.orEmpty()
                when {
                    a11y == null -> { tap(); "no_a11y" }
                    target == null -> { tap(); "touch_no_node" }
                    target.touchFirst -> { tap(); "touch|$what" }
                    target.focusable != null -> {
                        // יוצאים מ"מצב מגע" (מקש שיפט שלא עושה כלום אחר), מסמנים את הפריט, ולוחצים OK
                        run("input keyevent 59")
                        when {
                            a11y.focus(target.focusable) -> { run("input keyevent 23"); "focus_ok|$what" }
                            target.clickable?.performAction(AccessibilityNodeInfo.ACTION_CLICK) == true -> "click_action|$what"
                            else -> { run("input keyevent 23"); "ok_only|$what" }
                        }
                    }
                    target.clickable?.performAction(AccessibilityNodeInfo.ACTION_CLICK) == true -> "click_action|$what"
                    else -> { tap(); "touch|$what" }
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "click", e)
            "error|${e.javaClass.simpleName}"
        }
        return lastClick
    }

    /** תיאור קצר של הפריט שמתחת לסמן (לאבחון): איזו אפליקציה, איזה סוג רכיב, ומה כתוב עליו. */
    private fun describe(node: AccessibilityNodeInfo?): String {
        if (node == null) return ""
        val pkg = node.packageName?.toString()?.substringAfterLast('.').orEmpty()
        val cls = node.className?.toString()?.substringAfterLast('.').orEmpty()
        val label = (node.text ?: node.contentDescription)?.toString()?.take(24).orEmpty()
        return listOf(pkg, cls, label).filter { it.isNotBlank() }.joinToString(" · ")
    }

    fun longPress() = main.post {
        if (!ensureView()) return@post
        snap()
        clickPulse = 1f
        wake()
        val a11y = RemoteAccessibility.instance
        val target = a11y?.targetAt(targetX, targetY)
        val node = target?.clickable ?: target?.focusable
        if (target != null && !target.touchFirst && node != null &&
            node.performAction(AccessibilityNodeInfo.ACTION_LONG_CLICK)
        ) return@post
        if (a11y == null || !a11y.tap(targetX, targetY, 700)) {
            val x = targetX.toInt()
            val y = targetY.toInt()
            AdbBridge.shell("input swipe $x $y $x $y 700")
        }
    }

    /**
     * גלילה בשתי אצבעות. באפליקציות טלוויזיה = חצים (שעובדים בכל שורה של סרטים),
     * באתרים = החלקה אמיתית על המסך.
     */
    fun scroll(dx: Float, dy: Float) = main.post {
        if (!ensureView()) return@post
        wake()
        val a11y = RemoteAccessibility.instance
        val pkg = a11y?.foregroundPackage()
        if (a11y != null && !a11y.isTouchFirst(pkg)) {
            val horizontal = abs(dx) > abs(dy)
            val amount = if (horizontal) dx else dy
            val steps = (abs(amount) / 110f).roundToInt().coerceIn(1, 6)
            val key = when {
                horizontal && dx > 0 -> 22
                horizontal -> 21
                dy > 0 -> 20
                else -> 19
            }
            AdbBridge.sendKeys(key, steps)
            return@post
        }
        val fromX = targetX.coerceIn(screenW * 0.2f, screenW * 0.8f)
        val fromY = targetY.coerceIn(screenH * 0.2f, screenH * 0.8f)
        val toX = (fromX - dx * screenW / 1000f).coerceIn(5f, screenW - 5)
        val toY = (fromY - dy * screenH / 1000f).coerceIn(5f, screenH - 5)
        if (a11y == null || !a11y.swipe(fromX, fromY, toX, toY, 160)) {
            AdbBridge.shell("input swipe ${fromX.toInt()} ${fromY.toInt()} ${toX.toInt()} ${toY.toInt()} 160")
        }
    }

    fun hide() = main.post { view?.visibility = View.GONE }

    private fun snap() {
        shownX = targetX
        shownY = targetY
    }

    private val hideTask = Runnable { view?.visibility = View.GONE }

    private fun wake() {
        lastActivity = SystemClock.uptimeMillis()
        main.removeCallbacks(hideTask)
        main.postDelayed(hideTask, HIDE_AFTER_MS)
        view?.let {
            if (it.visibility != View.VISIBLE) {
                snap()
                it.visibility = View.VISIBLE
            }
            it.startAnimating()
        }
    }

    private fun ensureView(): Boolean {
        if (view != null) return true
        if (!Settings.canDrawOverlays(appContext)) {
            // ההרשאה ניתנת דרך ADB כשמתחברים; אם עוד לא - מבקשים שוב
            AdbBridge.shell("appops set ${appContext.packageName} SYSTEM_ALERT_WINDOW allow")
            return false
        }
        return try {
            val wm = appContext.getSystemService(WindowManager::class.java)
            val metrics = DisplayMetrics()
            @Suppress("DEPRECATION")
            wm.defaultDisplay.getRealMetrics(metrics)
            screenW = metrics.widthPixels.toFloat()
            screenH = metrics.heightPixels.toFloat()
            targetX = screenW / 2
            targetY = screenH / 2
            snap()
            val params = WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS or
                    WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                PixelFormat.TRANSLUCENT,
            ).apply { gravity = Gravity.TOP or Gravity.START }
            val v = CursorView(appContext)
            wm.addView(v, params)
            view = v
            true
        } catch (e: Exception) {
            Log.w(TAG, "overlay failed", e)
            false
        }
    }

    private class CursorView(context: Context) : View(context) {
        private val density = resources.displayMetrics.density
        private val size = 30 * density
        private val arrow = Path().apply {
            moveTo(0f, 0f)
            lineTo(0f, size)
            lineTo(size * 0.28f, size * 0.74f)
            lineTo(size * 0.47f, size * 1.12f)
            lineTo(size * 0.62f, size * 1.05f)
            lineTo(size * 0.44f, size * 0.68f)
            lineTo(size * 0.78f, size * 0.68f)
            close()
        }
        private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = LinearGradient(0f, 0f, size * 0.8f, size, Color.parseColor("#FF8FA3"), Color.parseColor("#A78BFA"), Shader.TileMode.CLAMP)
        }
        private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = 2.2f * density
            strokeJoin = Paint.Join.ROUND
            color = Color.WHITE
        }
        private val shadow = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(70, 40, 20, 70) }
        private val glow = Paint(Paint.ANTI_ALIAS_FLAG)
        private val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = 3f * density
        }
        private var animating = false

        private val frame = object : Choreographer.FrameCallback {
            override fun doFrame(frameTimeNanos: Long) {
                shownX += (targetX - shownX) * 0.62f
                shownY += (targetY - shownY) * 0.62f
                clickPulse = (clickPulse - 0.06f).coerceAtLeast(0f)
                invalidate()
                val idle = SystemClock.uptimeMillis() - lastActivity
                if (idle > HIDE_AFTER_MS) {
                    visibility = View.GONE
                    animating = false
                    return
                }
                val settled = abs(targetX - shownX) < 0.5f && abs(targetY - shownY) < 0.5f && clickPulse == 0f
                if (settled && idle > 300) {
                    animating = false
                    return
                }
                Choreographer.getInstance().postFrameCallback(this)
            }
        }

        fun startAnimating() {
            if (animating) return
            animating = true
            Choreographer.getInstance().postFrameCallback(frame)
        }

        override fun onDraw(canvas: Canvas) {
            val x = shownX
            val y = shownY
            // הילה רכה מסביב לסמן
            glow.shader = android.graphics.RadialGradient(
                x, y, size * 1.4f,
                Color.argb(90, 167, 139, 250), Color.TRANSPARENT, Shader.TileMode.CLAMP,
            )
            canvas.drawCircle(x, y, size * 1.4f, glow)
            if (clickPulse > 0f) {
                ring.color = Color.argb((clickPulse * 220).toInt(), 255, 143, 163)
                canvas.drawCircle(x, y, size * (1.6f - clickPulse * 0.9f), ring)
            }
            canvas.save()
            canvas.translate(x + 2 * density, y + 3 * density)
            canvas.drawPath(arrow, shadow)
            canvas.restore()
            canvas.save()
            canvas.translate(x, y)
            canvas.drawPath(arrow, fill)
            canvas.drawPath(arrow, stroke)
            canvas.restore()
        }
    }
}
