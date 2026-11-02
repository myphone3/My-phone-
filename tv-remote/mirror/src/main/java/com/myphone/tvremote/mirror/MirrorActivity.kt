package com.myphone.tvremote.mirror

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.projection.MediaProjectionManager
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

/**
 * המסך של אפליקציית השיקוף בגלקסי.
 * נפתח מכפתור "שיקוף מסך" בשלט (ואז מתחיל מיד), או מהאייקון - ואז מוצא לבד את הטלוויזיה ברשת.
 */
class MirrorActivity : Activity() {

    private lateinit var status: TextView
    private lateinit var tvList: LinearLayout
    private lateinit var action: Button
    private var targetHost: String? = null
    private var targetPort = Protocol.PORT
    private var targetName = "הטלוויזיה"
    private var nsd: NsdManager? = null
    private var discovery: NsdManager.DiscoveryListener? = null
    private var multicastLock: WifiManager.MulticastLock? = null
    private val found = LinkedHashMap<String, Pair<String, Int>>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(buildScreen())
        handle(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handle(intent)
    }

    override fun onResume() {
        super.onResume()
        MirrorService.onChange = { runOnUiThread { refresh() } }
        refresh()
        if (targetHost == null && !MirrorService.isRunning) discover()
    }

    override fun onPause() {
        MirrorService.onChange = null
        stopDiscovery()
        super.onPause()
    }

    /** מהשלט מגיעה כתובת הטלוויזיה: tvmirror://start?host=...&port=...&name=... */
    private fun handle(intent: Intent?) {
        val uri = intent?.data ?: return
        targetHost = uri.getQueryParameter("host")
        targetPort = uri.getQueryParameter("port")?.toIntOrNull() ?: Protocol.PORT
        uri.getQueryParameter("name")?.let { targetName = it }
        if (targetHost != null && !MirrorService.isRunning) begin()
    }

    private fun refresh() {
        val running = MirrorService.isRunning
        status.text = MirrorService.status.ifBlank {
            if (targetHost != null) "מוכן לשקף אל $targetName" else "מחפש את הטלוויזיה ברשת…"
        }
        action.text = if (running) "עצור שיקוף" else "התחל שיקוף"
        action.isEnabled = running || targetHost != null
        action.alpha = if (action.isEnabled) 1f else 0.5f
    }

    private fun begin() {
        // הרשאות: הקלטת קול (כדי שגם הקול יגיע לטלוויזיה) והתראות
        val needed = mutableListOf<String>()
        if (checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            needed += android.Manifest.permission.RECORD_AUDIO
        }
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            needed += android.Manifest.permission.POST_NOTIFICATIONS
        }
        if (needed.isNotEmpty()) {
            requestPermissions(needed.toTypedArray(), REQ_PERMISSIONS)
            return
        }
        askCapture()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        if (requestCode == REQ_PERMISSIONS) askCapture()
    }

    /** אנדרואיד שואל "להתחיל לשתף את המסך?" - חובה בכל פעם, זו ההגנה של המערכת. */
    private fun askCapture() {
        val mpm = getSystemService(MediaProjectionManager::class.java)
        @Suppress("DEPRECATION")
        startActivityForResult(mpm.createScreenCaptureIntent(), REQ_CAPTURE)
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != REQ_CAPTURE) return
        if (resultCode != RESULT_OK || data == null) {
            MirrorService.status = "השיקוף בוטל"
            refresh()
            return
        }
        val host = targetHost ?: return
        MirrorService.status = "מתחבר לטלוויזיה…"
        startForegroundService(
            Intent(this, MirrorService::class.java)
                .putExtra(MirrorService.EXTRA_HOST, host)
                .putExtra(MirrorService.EXTRA_PORT, targetPort)
                .putExtra(MirrorService.EXTRA_RESULT, resultCode)
                .putExtra(MirrorService.EXTRA_DATA, data),
        )
        refresh()
        // חוזרים למסך הבית של הטלפון - מה שרואים בטלפון רואים בטלוויזיה
        action.postDelayed({ moveTaskToBack(true) }, 900)
    }

    // ===== חיפוש הטלוויזיה ברשת =====

    private fun discover() {
        if (discovery != null) return
        val manager = getSystemService(NsdManager::class.java) ?: return
        nsd = manager
        multicastLock = getSystemService(WifiManager::class.java)?.createMulticastLock("tvmirror")?.apply {
            setReferenceCounted(false)
            acquire()
        }
        val listener = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(serviceType: String) {}
            override fun onDiscoveryStopped(serviceType: String) {}
            override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {}
            override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {}
            override fun onServiceLost(service: NsdServiceInfo) {}
            override fun onServiceFound(service: NsdServiceInfo) {
                @Suppress("DEPRECATION")
                manager.resolveService(service, object : NsdManager.ResolveListener {
                    override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {}
                    override fun onServiceResolved(info: NsdServiceInfo) {
                        @Suppress("DEPRECATION")
                        val host = info.host?.hostAddress ?: return
                        runOnUiThread { addTv(info.serviceName, host, info.port) }
                    }
                })
            }
        }
        discovery = listener
        try {
            manager.discoverServices(Protocol.SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, listener)
        } catch (e: Exception) {
            discovery = null
        }
    }

    private fun stopDiscovery() {
        discovery?.let { try { nsd?.stopServiceDiscovery(it) } catch (e: Exception) { } }
        discovery = null
        multicastLock?.release()
        multicastLock = null
    }

    private fun addTv(name: String, host: String, port: Int) {
        if (found.containsKey(host)) return
        found[host] = name to port
        if (targetHost == null) {
            targetHost = host
            targetPort = port
            targetName = name
        }
        tvList.addView(Button(this).apply {
            text = "📺  $name"
            isAllCaps = false
            setOnClickListener {
                targetHost = host
                targetPort = port
                targetName = name
                refresh()
            }
        })
        refresh()
    }

    // ===== עיצוב =====

    private fun buildScreen(): View {
        val d = resources.displayMetrics.density
        fun dp(v: Int) = (v * d).toInt()
        val page = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(28), dp(64), dp(28), dp(28))
            background = GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                intArrayOf(Color.parseColor("#FFF4F7"), Color.parseColor("#F1ECFF")),
            )
        }
        page.addView(ImageView(this).apply { setImageResource(R.drawable.ic_launcher) }, LinearLayout.LayoutParams(dp(96), dp(96)))
        page.addView(TextView(this).apply {
            text = getString(R.string.app_name)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 26f)
            setTextColor(Color.parseColor("#2E1F47"))
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER
            setPadding(0, dp(16), 0, dp(6))
        })
        status = TextView(this).apply {
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
            setTextColor(Color.parseColor("#5B4387"))
            gravity = Gravity.CENTER
            setPadding(0, dp(4), 0, dp(20))
        }
        page.addView(status)
        tvList = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        page.addView(tvList, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        action = Button(this).apply {
            isAllCaps = false
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
            setTextColor(Color.WHITE)
            background = GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                intArrayOf(Color.parseColor("#FF8FA3"), Color.parseColor("#A78BFA")),
            ).apply { cornerRadius = dp(28).toFloat() }
            setOnClickListener {
                if (MirrorService.isRunning) MirrorService.stop(this@MirrorActivity) else begin()
            }
        }
        page.addView(action, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(58)).apply { topMargin = dp(16) })
        page.addView(TextView(this).apply {
            text = "הטלפון והטלוויזיה צריכים להיות על אותה רשת WiFi (או על אותה נקודה חמה).\nכדי לעצור: מהשלט, או מההתראה למעלה."
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            setTextColor(Color.parseColor("#8C7AA8"))
            gravity = Gravity.CENTER
            setPadding(0, dp(22), 0, 0)
        })
        return page
    }

    companion object {
        private const val REQ_PERMISSIONS = 1
        private const val REQ_CAPTURE = 2
    }
}
