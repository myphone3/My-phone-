package com.myphone.tvremote

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.view.accessibility.AccessibilityEvent

/**
 * שירות נגישות שהמערכת מפעילה בעצמה בכל הדלקה של הטלוויזיה ושומרת עליו חי.
 * ככה השלט עולה לבד בלי לפתוח את האפליקציה, ולא נסגר באמצע.
 * בנוסף הוא "נוגע" במסך בשביל העכבר - הרבה יותר מהר מפקודת ADB.
 */
class RemoteAccessibility : AccessibilityService() {

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        RemoteService.start(this)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {}

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

    companion object {
        @Volatile var instance: RemoteAccessibility? = null
            private set
    }
}
