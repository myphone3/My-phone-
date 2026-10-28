package com.myphone.tvremote

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import android.util.Log
import java.net.Inet4Address
import java.net.NetworkInterface

/** שירות שרץ ברקע כל הזמן ומחזיק את השרת פתוח, גם כשהאפליקציה סגורה. */
class RemoteService : Service() {
    override fun onCreate() {
        super.onCreate()
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(CHANNEL, "שלט מהפון", NotificationManager.IMPORTANCE_MIN))
        val notification = Notification.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle("שלט מהפון פעיל")
            .setContentText(address())
            .build()
        startForeground(1, notification)
        running = true

        RemoteCore.start(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        RemoteCore.start(this)
        return START_STICKY
    }

    override fun onDestroy() {
        running = false
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val PORT = 8080
        private const val CHANNEL = "remote"

        @Volatile var running = false
            private set

        /** מפעיל את השלט. גם אם אנדרואיד לא מרשה שירות רקע ברגע זה, החלקים עצמם עולים בכל זאת. */
        fun start(context: Context) {
            RemoteCore.start(context)
            if (running) return
            try {
                context.startForegroundService(Intent(context, RemoteService::class.java))
            } catch (e: Exception) {
                Log.w("RemoteService", "foreground start not allowed right now", e)
            }
        }

        fun address(): String {
            val ip = try {
                NetworkInterface.getNetworkInterfaces().toList()
                    .filter { it.isUp && !it.isLoopback }
                    .flatMap { it.inetAddresses.toList() }
                    .firstOrNull { it is Inet4Address && it.isSiteLocalAddress }
                    ?.hostAddress
            } catch (e: Exception) {
                null
            }
            return if (ip == null) "אין חיבור לרשת" else "http://$ip:$PORT"
        }
    }
}
