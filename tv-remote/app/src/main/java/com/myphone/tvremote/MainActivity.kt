package com.myphone.tvremote

import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.widget.Button
import android.widget.TextView
import android.widget.Toast

/** המסך שרואים בטלוויזיה: הכתובת לטלפון, מצב החיבור, וקיצורים להגדרות המוסתרות. */
class MainActivity : Activity() {
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var address: TextView
    private lateinit var status: TextView

    private val refresh = object : Runnable {
        override fun run() {
            address.text = RemoteService.address()
            status.text = AdbBridge.status
            status.setTextColor(if (AdbBridge.connected) 0xFF86EFAC.toInt() else 0xFFFDE68A.toInt())
            handler.postDelayed(this, 1500)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        address = findViewById(R.id.address)
        status = findViewById(R.id.status)

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
        findViewById<Button>(R.id.btn_dev).requestFocus()
    }

    override fun onResume() {
        super.onResume()
        handler.post(refresh)
    }

    override fun onPause() {
        handler.removeCallbacks(refresh)
        super.onPause()
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
