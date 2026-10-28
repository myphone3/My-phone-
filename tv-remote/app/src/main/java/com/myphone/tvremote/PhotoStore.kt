package com.myphone.tvremote

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Handler
import android.os.Looper
import android.util.Base64
import java.io.ByteArrayOutputStream
import java.io.File

/**
 * תמונות הרקע של מסך הבית. הטלפון מעלה אותן בחתיכות קטנות (גם דרך האינטרנט),
 * והן נשמרות בתוך האפליקציה בטלוויזיה.
 */
object PhotoStore {
    private val ID = Regex("^[a-z0-9]{6,24}$")
    private const val MAX_PARTS = 80
    private const val MAX_PHOTOS = 40
    private val main = Handler(Looper.getMainLooper())

    /** מסך הבית נרשם כאן כדי להתעדכן מיד כשמוסיפים או מוחקים תמונה. */
    @Volatile var listener: (() -> Unit)? = null

    private fun dir(context: Context) = File(context.filesDir, "photos").apply { mkdirs() }

    fun list(context: Context): List<File> =
        dir(context).listFiles { f -> f.name.endsWith(".jpg") }?.sortedBy { it.lastModified() } ?: emptyList()

    fun intervalSec(context: Context) =
        context.getSharedPreferences("home", Context.MODE_PRIVATE).getInt("photo_interval", 20)

    fun setInterval(context: Context, sec: Int) {
        context.getSharedPreferences("home", Context.MODE_PRIVATE).edit().putInt("photo_interval", sec.coerceIn(5, 3600)).apply()
        notifyChanged()
    }

    /** מקבל חתיכה אחת של תמונה. כשהחתיכה האחרונה מגיעה - התמונה נשמרת. */
    fun addPart(context: Context, id: String, part: Int, total: Int, data: String): String? {
        if (!ID.matches(id) || total !in 1..MAX_PARTS || part !in 0 until total) return "bad request"
        if (part == 0 && list(context).size >= MAX_PHOTOS) return "too_many"
        val tmp = File(dir(context), "$id.part")
        val bytes = try { Base64.decode(data, Base64.DEFAULT) } catch (e: Exception) { return "bad data" }
        if (part == 0) tmp.delete()
        tmp.appendBytes(bytes)
        if (part == total - 1) {
            val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(tmp.path, opts)
            if (opts.outWidth <= 0) {
                tmp.delete()
                return "not an image"
            }
            tmp.renameTo(File(dir(context), "$id.jpg"))
            notifyChanged()
        }
        return null
    }

    fun delete(context: Context, id: String): Boolean {
        if (!ID.matches(id)) return false
        val ok = File(dir(context), "$id.jpg").delete()
        thumbs.remove(id)
        notifyChanged()
        return ok
    }

    private val thumbs = HashMap<String, String>()

    /** תמונה קטנה (כ-160 פיקסלים) לתצוגה ברשימה בטלפון. */
    fun thumb(file: File): String = thumbs.getOrPut(file.nameWithoutExtension) {
        val bitmap = decode(file, 160, 160) ?: return ""
        val out = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.JPEG, 70, out)
        bitmap.recycle()
        Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
    }

    /** טוען תמונה בגודל שמתאים למסך, בלי לבזבז זיכרון (לטלוויזיה יש רק 1GB). */
    fun decode(file: File, minWidth: Int, minHeight: Int): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.path, bounds)
        if (bounds.outWidth <= 0) return null
        var sample = 1
        while (bounds.outWidth / (sample * 2) >= minWidth && bounds.outHeight / (sample * 2) >= minHeight) sample *= 2
        val opts = BitmapFactory.Options().apply {
            inSampleSize = sample
            inPreferredConfig = Bitmap.Config.RGB_565
        }
        return try { BitmapFactory.decodeFile(file.path, opts) } catch (e: OutOfMemoryError) { null }
    }

    private fun notifyChanged() {
        main.post { listener?.invoke() }
    }
}
