package com.myphone.tvremote

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Handler
import android.os.Looper
import android.util.Log

/**
 * כשמדליקים את הטלוויזיה בשלט היא לרוב לא "עולה מחדש" אלא מתעוררת מהמתנה - ואז מראה את מה שהיה פתוח
 * (או את מסך הבית של היצרן). כאן: בכל פעם שהמסך נדלק, פותחים ישר את מסך הבית שלנו, בלי ללחוץ על כלום.
 * בודקים שוב אחרי כמה שניות, כי חלק מהטלוויזיות פותחות את האפליקציה הקודמת קצת אחרי שהמסך נדלק.
 */
object PowerWatch {
    private const val TAG = "PowerWatch"
    private val main = Handler(Looper.getMainLooper())
    private var registered = false
    /** מה היה פתוח כשהטלוויזיה כבתה - אם זה חוזר לבד אחרי ההדלקה, מחליפים למסך הבית שלנו */
    private var beforeOff: String? = null

    fun start(context: Context) {
        if (registered) return
        registered = true
        val app = context.applicationContext
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_SCREEN_ON)
            addAction(Intent.ACTION_SCREEN_OFF)
        }
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(c: Context, intent: Intent) {
                when (intent.action) {
                    Intent.ACTION_SCREEN_OFF -> {
                        beforeOff = RemoteAccessibility.instance?.foregroundPackage()
                        main.removeCallbacksAndMessages(null)
                    }
                    Intent.ACTION_SCREEN_ON -> onScreenOn(app)
                }
            }
        }
        try {
            if (android.os.Build.VERSION.SDK_INT >= 33) app.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
            else app.registerReceiver(receiver, filter)
        } catch (e: Exception) {
            Log.w(TAG, "register", e)
            registered = false
        }
    }

    private fun onScreenOn(app: Context) {
        if (!RemoteAccessibility.homeTakeover(app)) return
        openHome(app)
        val previous = beforeOff
        for (delay in listOf(1500L, 4000L)) {
            main.postDelayed({
                val now = RemoteAccessibility.instance?.foregroundPackage()
                val original = RemoteAccessibility.originalHome(app)?.substringBefore('/')
                // מחליפים רק אם המסך חזר לבד למה שהיה לפני הכיבוי או למסך של היצרן - לא אם בחרתם כבר אפליקציה
                val unwanted = now != null && now != app.packageName && (now == previous || now == original)
                if (unwanted && !AirPlayServer.isActive && !MirrorServer.isActive) openHome(app)
            }, delay)
        }
    }

    private fun openHome(app: Context) {
        if (AirPlayServer.isActive || MirrorServer.isActive) return
        try {
            (RemoteAccessibility.instance ?: app).startActivity(
                Intent(app, HomeActivity::class.java)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            )
        } catch (e: Exception) {
            AdbBridge.shell("am start -n ${app.packageName}/${app.packageName}.HomeActivity")
        }
    }
}
