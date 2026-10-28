package com.myphone.tvremote

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.graphics.Rect
import android.content.Intent
import android.view.KeyEvent
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * שירות נגישות שהמערכת מפעילה בעצמה בכל הדלקה של הטלוויזיה ושומרת עליו חי.
 * ככה השלט עולה לבד בלי לפתוח את האפליקציה, ולא נסגר באמצע.
 * בנוסף הוא משמש את העכבר: יודע מה נמצא מתחת לסמן, ו"נוגע" במסך מהר.
 */
class RemoteAccessibility : AccessibilityService() {

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        RemoteService.start(this)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {}

    /**
     * כשמסך הבית שלנו מופעל: כפתור "בית" בשלט המקורי פותח אותו,
     * גם אם היצרן קיבע את הכפתור למסך הבית שלו.
     */
    override fun onKeyEvent(event: KeyEvent): Boolean {
        if (event.keyCode != KeyEvent.KEYCODE_HOME || !homeTakeover(this)) return false
        if (event.action == KeyEvent.ACTION_UP) {
            try {
                startActivity(Intent(this, HomeActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP))
            } catch (e: Exception) {
                return false
            }
        }
        return true
    }

    override fun onInterrupt() {}

    override fun onDestroy() {
        if (instance === this) instance = null
        super.onDestroy()
    }

    fun tap(x: Float, y: Float, durationMs: Long): Boolean = swipe(x, y, x, y, durationMs)

    fun swipe(x1: Float, y1: Float, x2: Float, y2: Float, durationMs: Long): Boolean {
        val path = Path().apply {
            moveTo(x1, y1)
            lineTo(x2, y2)
        }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, durationMs.coerceAtLeast(1)))
            .build()
        return try {
            dispatchGesture(gesture, null, null)
        } catch (e: Exception) {
            false
        }
    }

    /** מה יש מתחת לסמן: פריט שאפשר לבחור, פריט שאפשר ללחוץ, והאם זו אפליקציה שעדיף בה מגע אמיתי. */
    class Target(val focusable: AccessibilityNodeInfo?, val clickable: AccessibilityNodeInfo?, val touchFirst: Boolean)

    fun targetAt(x: Float, y: Float): Target? {
        val node = nodeAt(x.toInt(), y.toInt()) ?: return null
        val touchFirst = node.packageName?.toString() in TOUCH_FIRST_APPS
        return Target(ancestor(node) { it.isFocusable }, ancestor(node) { it.isClickable }, touchFirst)
    }

    /** מסמן פריט (כמו להגיע אליו עם החצים). מחזיר true אם הסימון הצליח. */
    fun focus(node: AccessibilityNodeInfo): Boolean {
        if (node.isFocused) return true
        node.performAction(AccessibilityNodeInfo.ACTION_FOCUS)
        node.refresh()
        return node.isFocused
    }

    /** האפליקציה שפתוחה עכשיו על המסך. */
    fun foregroundPackage(): String? = try {
        rootInActiveWindow?.packageName?.toString()
    } catch (e: Exception) {
        null
    }

    fun isTouchFirst(pkg: String?) = pkg in TOUCH_FIRST_APPS

    private fun ancestor(start: AccessibilityNodeInfo, test: (AccessibilityNodeInfo) -> Boolean): AccessibilityNodeInfo? {
        var node: AccessibilityNodeInfo? = start
        var depth = 0
        while (node != null && depth < 12) {
            if (test(node)) return node
            node = node.parent
            depth++
        }
        return null
    }

    /** הפריט הכי קטן (הכי "פנימי") שאפשר ללחוץ עליו או לבחור אותו, בנקודה הזו על המסך. */
    private fun nodeAt(x: Int, y: Int): AccessibilityNodeInfo? {
        val roots = try {
            windows.sortedByDescending { it.layer }.mapNotNull { it.root }
        } catch (e: Exception) {
            emptyList()
        }.ifEmpty { listOfNotNull(rootInActiveWindow) }
        for (root in roots) {
            // מדלגים רק על שכבת הסמן עצמה (לא על מסך הבית שלנו!)
            if (root.className?.toString()?.contains("CursorView") == true) continue
            val bounds = Rect()
            root.getBoundsInScreen(bounds)
            if (!bounds.contains(x, y)) continue
            val found = find(root, x, y, 0) ?: continue
            // חלון "ריק" שמכסה את המסך (בלי שום פריט בתוכו) - ממשיכים לחלון שמתחתיו
            if (found != root || found.isClickable || found.isFocusable) return found
        }
        // גיבוי: החלון הפעיל
        return rootInActiveWindow?.let { find(it, x, y, 0) }
    }

    private fun find(node: AccessibilityNodeInfo, x: Int, y: Int, depth: Int): AccessibilityNodeInfo? {
        if (depth > 40 || !node.isVisibleToUser) return null
        val bounds = Rect()
        node.getBoundsInScreen(bounds)
        if (!bounds.contains(x, y)) return null
        for (i in node.childCount - 1 downTo 0) {
            val child = node.getChild(i) ?: continue
            find(child, x, y, depth + 1)?.let { return it }
        }
        return node
    }

    companion object {
        fun homeTakeover(context: android.content.Context) =
            context.getSharedPreferences("home", MODE_PRIVATE).getBoolean("takeover", false)

        // באפליקציות האלה נגיעה אמיתית מדויקת יותר (אתרים, כפתורים קטנים)
        private val TOUCH_FIRST_APPS = setOf(
            "com.android.chrome", "org.chromium.webview_shell", "com.opera.browser",
            "org.mozilla.firefox", "com.amazon.cloud9", "com.brave.browser",
        )

        @Volatile var instance: RemoteAccessibility? = null
            private set
    }
}
