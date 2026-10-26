package com.myphone.tvremote

import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter

/** המסך שרואים בטלוויזיה: הכתובת לטלפון, מצב החיבור, וקיצורים להגדרות המוסתרות. */
class MainActivity : Activity() {
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var address: TextView
    private lateinit var status: TextView
    private lateinit var cloud: TextView

    private val refresh = object : Runnable {
        override fun run() {
            address.text = RemoteService.address()
            status.text = (if (AdbBridge.connected) "🟢 " else "🟡 ") + AdbBridge.status
            cloud.text = if (CloudRelay.online) "🟢 מחובר לאינטרנט: אפשר לשלוט מכל רשת" else "🟡 מתחבר לאינטרנט…"
            handler.postDelayed(this, 1500)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        address = findViewById(R.id.address)
        status = findViewById(R.id.status)
        cloud = findViewById(R.id.cloud)
        findViewById<ImageView>(R.id.qr).setImageBitmap(qrCode(Config.remoteUrl(TvIdentity.id(this)), 520))

        RemoteService.start(this)

        findViewById<Button>(R.id.btn_dev).setOnClickListener {
            open(
                Intent(Settings.ACTION_APPLICATION_DEVELOPMENT_SETTINGS),
                component("com.android.tv.settings", "com.android.tv.settings.system.development.DevelopmentActivity"),
                component("com.android.settings", "com.android.settings.Settings\$DevelopmentSettingsDashboardActivity"),
            )
        }
        findViewById<Button>(R.id.btn_about).setOnClickListener {
            open(
                component("com.android.tv.settings", "com.android.tv.settings.about.AboutActivity"),
                Intent(Settings.ACTION_DEVICE_INFO_SETTINGS),
                component("com.android.settings", "com.android.settings.Settings\$MyDeviceInfoActivity"),
            )
        }
        findViewById<Button>(R.id.btn_settings).setOnClickListener {
            open(
                component("com.android.tv.settings", "com.android.tv.settings.MainSettings"),
                component("com.android.settings", "com.android.settings.Settings"),
                Intent(Settings.ACTION_SETTINGS),
            )
        }
        findViewById<Button>(R.id.btn_retry).setOnClickListener {
            AdbBridge.reconnect()
            Toast.makeText(this, "מנסה להתחבר…", Toast.LENGTH_SHORT).show()
        }
        findViewById<Button>(R.id.btn_retry).requestFocus()
    }

    override fun onResume() {
        super.onResume()
        handler.post(refresh)
    }

    override fun onPause() {
        handler.removeCallbacks(refresh)
        super.onPause()
    }

    private fun qrCode(text: String, size: Int): Bitmap {
        val matrix = QRCodeWriter().encode(text, BarcodeFormat.QR_CODE, size, size, mapOf(EncodeHintType.MARGIN to 1))
        val pixels = IntArray(size * size) { i ->
            if (matrix[i % size, i / size]) Color.parseColor("#2E1F47") else Color.WHITE
        }
        return Bitmap.createBitmap(pixels, size, size, Bitmap.Config.ARGB_8888)
    }

    private fun component(pkg: String, cls: String) = Intent().setComponent(ComponentName(pkg, cls))

    /** מנסה כמה דרכים לפתוח מסך הגדרות, כי כל יצרן מחביא אותן אחרת. */
    private fun open(vararg intents: Intent) {
        for (intent in intents) {
            try {
                startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                return
            } catch (_: Exception) {
            }
        }
        Toast.makeText(this, "המסך הזה לא נמצא בטלוויזיה הזו", Toast.LENGTH_LONG).show()
    }
}
