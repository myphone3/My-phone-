package com.myphone.tvremote

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.drawable.Drawable
import java.io.ByteArrayOutputStream

object Apps {
    private val PACKAGE = Regex("^[A-Za-z0-9_.]+$")

    fun list(context: Context): List<Pair<String, String>> {
        val pm = context.packageManager
        val result = LinkedHashMap<String, String>()
        for (category in listOf(Intent.CATEGORY_LEANBACK_LAUNCHER, Intent.CATEGORY_LAUNCHER)) {
            val intent = Intent(Intent.ACTION_MAIN).addCategory(category)
            for (info in pm.queryIntentActivities(intent, 0)) {
                val pkg = info.activityInfo.packageName
                if (pkg == context.packageName || pkg in result) continue
                result[pkg] = info.loadLabel(pm).toString()
            }
        }
        return result.entries.map { it.key to it.value }.sortedBy { it.second.lowercase() }
    }

    /** פותח אפליקציה דרך ADB, כי אנדרואיד חוסם פתיחת מסכים מאפליקציה שרצה ברקע. */
    fun launch(context: Context, pkg: String): Boolean {
        if (!PACKAGE.matches(pkg)) return false
        val pm = context.packageManager
        val intent = pm.getLeanbackLaunchIntentForPackage(pkg) ?: pm.getLaunchIntentForPackage(pkg) ?: return false
        val component = intent.component?.flattenToShortString() ?: return false
        if (!Regex("^[A-Za-z0-9_.$/]+$").matches(component)) return false
        AdbBridge.shell("am start -n '$component'")
        return true
    }

    fun iconPng(context: Context, pkg: String): ByteArray? {
        if (!PACKAGE.matches(pkg)) return null
        return try {
            toPng(context.packageManager.getApplicationIcon(pkg), 128)
        } catch (e: Exception) {
            null
        }
    }

    private fun toPng(drawable: Drawable, size: Int): ByteArray {
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        drawable.setBounds(0, 0, size, size)
        drawable.draw(Canvas(bitmap))
        return ByteArrayOutputStream().also { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }.toByteArray()
    }

    /** האייקון של השלט עצמו, למסך הבית של הטלפון. */
    fun remoteIconPng(size: Int): ByteArray {
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        val s = size.toFloat()
        paint.color = Color.parseColor("#1E1B4B")
        canvas.drawRect(0f, 0f, s, s, paint)
        paint.color = Color.parseColor("#6366F1")
        canvas.drawCircle(s / 2, s / 2, s * 0.32f, paint)
        paint.color = Color.parseColor("#E0E7FF")
        canvas.drawCircle(s / 2, s / 2, s * 0.12f, paint)
        val r = s * 0.035f
        for ((dx, dy) in listOf(0f to -1f, 0f to 1f, -1f to 0f, 1f to 0f)) {
            val cx = s / 2 + dx * s * 0.235f
            val cy = s / 2 + dy * s * 0.235f
            canvas.drawRoundRect(RectF(cx - r, cy - r, cx + r, cy + r), r / 2, r / 2, paint)
        }
        return ByteArrayOutputStream().also { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }.toByteArray()
    }
}
