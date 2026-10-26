package com.myphone.tvremote

import android.content.Context
import java.security.SecureRandom

/** מזהה סודי וקבוע של הטלוויזיה. מי שיש לו אותו (דרך קוד ה-QR) יכול לשלוט בה. */
object TvIdentity {
    private const val CHARS = "abcdefghijkmnpqrstuvwxyz23456789"
    @Volatile private var cached: String? = null

    fun id(context: Context): String {
        cached?.let { return it }
        val prefs = context.getSharedPreferences("tv", Context.MODE_PRIVATE)
        val id = prefs.getString("id", null) ?: buildString {
            val random = SecureRandom()
            repeat(14) { append(CHARS[random.nextInt(CHARS.length)]) }
        }.also { prefs.edit().putString("id", it).apply() }
        cached = id
        return id
    }
}
