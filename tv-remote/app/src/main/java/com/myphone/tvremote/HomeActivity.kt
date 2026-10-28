package com.myphone.tvremote

import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.content.pm.ResolveInfo
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.text.TextUtils
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.GridLayout
import android.widget.HorizontalScrollView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/** מסך הבית של "שלט מהפון": שעון, מזג אוויר, מועדפים וכל האפליקציות - בעיצוב של השלט. */
class HomeActivity : Activity() {

    private val main = Handler(Looper.getMainLooper())
    private val loader = Executors.newFixedThreadPool(2)
    private lateinit var clock: TextView
    private lateinit var date: TextView
    private lateinit var greeting: TextView
    private lateinit var weather: TextView
    private lateinit var favRow: LinearLayout
    private lateinit var favTitle: TextView
    private lateinit var grid: GridLayout
    private var showHidden = false

    private val prefs by lazy { getSharedPreferences("home", Context.MODE_PRIVATE) }

    private class App(val pkg: String, val label: String, val info: ResolveInfo)

    private val tick = object : Runnable {
        override fun run() {
            updateClock()
            main.postDelayed(this, 10_000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        RemoteService.start(this)
        setContentView(buildScreen())
    }

    override fun onResume() {
        super.onResume()
        main.post(tick)
        loadApps()
        loadWeather()
    }

    override fun onPause() {
        main.removeCallbacks(tick)
        super.onPause()
    }

    // מסך בית לא נסגר בלחיצה על "חזור"
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {}

    // ===== בניית המסך =====

    private fun buildScreen(): View {
        val scroll = ScrollView(this).apply {
            background = getDrawable(R.drawable.bg_screen)
            isFillViewport = true
            isVerticalScrollBarEnabled = false
        }
        val page = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setPadding(dp(44), dp(30), dp(44), dp(36))
        }
        scroll.addView(page)

        // שורה עליונה: שעון וברכה מימין, מזג אוויר וכפתורים משמאל
        val top = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val clockBox = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        greeting = text("", 22f, "#9A6FB8", bold = true)
        clock = text("", 64f, "#2E1F47", bold = true).apply { setLineSpacing(0f, 0.9f) }
        date = text("", 20f, "#8C7AA8")
        clockBox.addView(greeting)
        clockBox.addView(clock)
        clockBox.addView(date)
        top.addView(clockBox, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))

        weather = text("", 20f, "#4A3470").apply {
            background = rounded("#CCFFFFFF", 999f)
            setPadding(dp(20), dp(10), dp(20), dp(10))
            visibility = View.GONE
        }
        top.addView(weather)
        top.addView(pillButton("📱  שלט מהפון") { startActivity(Intent(this, MainActivity::class.java)) })
        top.addView(pillButton("⚙  הגדרות") { openSettings() })
        page.addView(top)

        favTitle = sectionTitle("המועדפים שלכם")
        page.addView(favTitle)
        val favScroll = HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = false
            clipToPadding = false
            clipChildren = false
            setPadding(dp(6), dp(10), dp(6), dp(14))
        }
        favRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            clipChildren = false
        }
        favScroll.addView(favRow)
        page.addView(favScroll)

        page.addView(sectionTitle("כל האפליקציות"))
        grid = GridLayout(this).apply {
            columnCount = 7
            clipChildren = false
            setPadding(0, dp(8), 0, 0)
        }
        page.addView(grid)

        page.addView(text("לחיצה ארוכה על OK: הוספה למועדפים או הסתרה", 15f, "#B3A3CC").apply {
            gravity = Gravity.CENTER
            setPadding(0, dp(22), 0, 0)
        })
        return scroll
    }

    private fun updateClock() {
        val now = Date()
        clock.text = SimpleDateFormat("HH:mm", Locale.getDefault()).format(now)
        date.text = SimpleDateFormat("EEEE, d 'ב'MMMM", Locale("iw")).format(now)
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        greeting.text = when (hour) {
            in 5..11 -> "בוקר טוב ☀️"
            in 12..16 -> "צהריים טובים 🌤"
            in 17..21 -> "ערב טוב 🌙"
            else -> "לילה טוב ✨"
        }
    }

    // ===== אפליקציות =====

    private fun loadApps() {
        loader.execute {
            val apps = queryApps()
            main.post { render(apps) }
        }
    }

    private fun queryApps(): List<App> {
        val result = LinkedHashMap<String, App>()
        for (category in listOf(Intent.CATEGORY_LEANBACK_LAUNCHER, Intent.CATEGORY_LAUNCHER)) {
            val intent = Intent(Intent.ACTION_MAIN).addCategory(category)
            for (info in packageManager.queryIntentActivities(intent, 0)) {
                val pkg = info.activityInfo.packageName
                if (pkg in result) continue
                result[pkg] = App(pkg, info.loadLabel(packageManager).toString(), info)
            }
        }
        return result.values.sortedBy { it.label.lowercase(Locale.ROOT) }
    }

    private fun favorites(apps: List<App>): List<String> {
        val saved = prefs.getString("favs", null)
        if (saved != null) return saved.split('|').filter { it.isNotBlank() }
        val installed = apps.map { it.pkg }.toSet()
        return DEFAULT_FAVS.filter { it in installed }
    }

    private fun hidden(apps: List<App>): Set<String> {
        val saved = prefs.getString("hidden", null)
        if (saved != null) return saved.split('|').filter { it.isNotBlank() }.toSet()
        return apps.filter { JUNK.containsMatchIn(it.label) || JUNK.containsMatchIn(it.pkg.substringAfterLast('.')) }
            .map { it.pkg }.toSet()
    }

    private fun render(apps: List<App>) {
        val favs = favorites(apps)
        val hidden = hidden(apps)
        val byPkg = apps.associateBy { it.pkg }

        favRow.removeAllViews()
        val favApps = favs.mapNotNull { byPkg[it] }
        favTitle.visibility = if (favApps.isEmpty()) View.GONE else View.VISIBLE
        for (app in favApps) favRow.addView(favoriteCard(app, apps))

        grid.removeAllViews()
        val visible = apps.filter { it.pkg != packageName && (showHidden || it.pkg !in hidden) }
        for (app in visible) grid.addView(appTile(app, apps, dimmed = app.pkg in hidden))
        grid.addView(actionTile(if (showHidden) "🙈\nהסתר מוסתרות" else "👀\nהצג מוסתרות") {
            showHidden = !showHidden
            render(apps)
        })

        if (currentFocus == null) (favRow.getChildAt(0) ?: grid.getChildAt(0))?.requestFocus()
    }

    private fun favoriteCard(app: App, all: List<App>): View {
        val card = FrameLayout(this).apply {
            background = rounded("#FFFFFF", 22f)
            elevation = dp(4).toFloat()
            isFocusable = true
            clipToOutline = true
            outlineProvider = android.view.ViewOutlineProvider.BACKGROUND
        }
        val image = ImageView(this).apply { scaleType = ImageView.ScaleType.CENTER_CROP }
        card.addView(image, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        loader.execute {
            val banner = loadBanner(app)
            main.post {
                if (banner != null) image.setImageDrawable(banner)
                else {
                    // אין באנר: אייקון במרכז על רקע פסטלי, עם השם
                    image.scaleType = ImageView.ScaleType.FIT_CENTER
                    image.setPadding(dp(30), dp(18), dp(30), dp(34))
                    image.background = gradient()
                    image.setImageDrawable(app.info.loadIcon(packageManager))
                    card.addView(text(app.label, 15f, "#4A3470", bold = true).apply {
                        gravity = Gravity.CENTER
                        maxLines = 1
                        ellipsize = TextUtils.TruncateAt.END
                    }, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM).apply {
                        bottomMargin = dp(8)
                    })
                }
            }
        }
        setupTile(card, app, all, scale = 1.1f)
        card.layoutParams = LinearLayout.LayoutParams(dp(212), dp(120)).apply { marginEnd = dp(20) }
        return card
    }

    private fun appTile(app: App, all: List<App>, dimmed: Boolean): View {
        val tile = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            isFocusable = true
            background = rounded("#99FFFFFF", 22f)
            setPadding(dp(8), dp(12), dp(8), dp(10))
            alpha = if (dimmed) 0.45f else 1f
        }
        val icon = ImageView(this)
        tile.addView(icon, LinearLayout.LayoutParams(dp(54), dp(54)))
        loader.execute {
            val drawable = try { app.info.loadIcon(packageManager) } catch (e: Exception) { null }
            main.post { icon.setImageDrawable(drawable) }
        }
        tile.addView(text(app.label, 14f, "#2E1F47").apply {
            gravity = Gravity.CENTER
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.END
            setPadding(0, dp(8), 0, 0)
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        setupTile(tile, app, all, scale = 1.12f)
        tile.layoutParams = GridLayout.LayoutParams().apply {
            width = dp(104)
            height = dp(108)
            setMargins(dp(6), dp(6), dp(6), dp(6))
        }
        return tile
    }

    private fun actionTile(label: String, onClick: () -> Unit): View {
        val tile = text(label, 14f, "#8C7AA8").apply {
            gravity = Gravity.CENTER
            isFocusable = true
            background = rounded("#66FFFFFF", 22f)
            setOnClickListener { onClick() }
            onFocusChangeListener = focusAnimator(1.1f)
        }
        tile.layoutParams = GridLayout.LayoutParams().apply {
            width = dp(104)
            height = dp(108)
            setMargins(dp(6), dp(6), dp(6), dp(6))
        }
        return tile
    }

    /** לחיצה פותחת, לחיצה ארוכה פותחת תפריט, ובחירה מגדילה את הפריט ומוסיפה מסגרת צבעונית. */
    private fun setupTile(view: View, app: App, all: List<App>, scale: Float) {
        view.setOnClickListener { launch(app) }
        view.setOnLongClickListener { showMenu(app, all); true }
        view.onFocusChangeListener = focusAnimator(scale)
        view.setOnKeyListener { _, keyCode, event ->
            if (keyCode == KeyEvent.KEYCODE_MENU && event.action == KeyEvent.ACTION_UP) {
                showMenu(app, all)
                true
            } else false
        }
    }

    private fun focusAnimator(scale: Float) = View.OnFocusChangeListener { v, focused ->
        v.animate().scaleX(if (focused) scale else 1f).scaleY(if (focused) scale else 1f)
            .translationZ(if (focused) dp(10).toFloat() else 0f).setDuration(160).start()
        v.foreground = if (focused) GradientDrawable().apply {
            cornerRadius = dp(22).toFloat()
            setStroke(dp(3), Color.parseColor("#B794F6"))
        } else null
    }

    private fun showMenu(app: App, all: List<App>) {
        val favs = favorites(all).toMutableList()
        val hidden = hidden(all).toMutableSet()
        val isFav = app.pkg in favs
        val isHidden = app.pkg in hidden
        val options = mutableListOf<Pair<String, () -> Unit>>()
        options += "▶  פתח" to { launch(app) }
        if (isFav) {
            options += "★  הסר מהמועדפים" to { favs.remove(app.pkg); saveFavs(favs) }
            options += "→  הזז שמאלה במועדפים" to {
                val i = favs.indexOf(app.pkg)
                if (i in 0 until favs.size - 1) { favs.removeAt(i); favs.add(i + 1, app.pkg); saveFavs(favs) }
            }
        } else {
            options += "☆  הוסף למועדפים" to { favs.add(app.pkg); saveFavs(favs) }
        }
        options += (if (isHidden) "👀  החזר לרשימה" else "🙈  הסתר") to {
            if (isHidden) hidden.remove(app.pkg) else hidden.add(app.pkg)
            saveHidden(hidden)
        }
        options += "ℹ  פרטי אפליקציה" to {
            tryStart(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${app.pkg}")))
            Unit
        }
        AlertDialog.Builder(this, android.R.style.Theme_Material_Light_Dialog_Alert)
            .setTitle(app.label)
            .setItems(options.map { it.first }.toTypedArray()) { _, which ->
                options[which].second()
                loadApps()
            }
            .show()
    }

    private fun saveFavs(list: List<String>) = prefs.edit().putString("favs", list.joinToString("|")).apply()
    private fun saveHidden(set: Set<String>) = prefs.edit().putString("hidden", set.joinToString("|")).apply()

    private fun launch(app: App) {
        val intent = packageManager.getLeanbackLaunchIntentForPackage(app.pkg)
            ?: packageManager.getLaunchIntentForPackage(app.pkg)
        if (intent != null) tryStart(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    private fun loadBanner(app: App): Drawable? = try {
        app.info.activityInfo.loadBanner(packageManager)
            ?: packageManager.getApplicationBanner(app.pkg)
    } catch (e: Exception) {
        null
    }

    private fun openSettings() {
        for (intent in listOf(
            Intent().setClassName("com.android.tv.settings", "com.android.tv.settings.MainSettings"),
            Intent().setClassName("com.android.settings", "com.android.settings.Settings"),
            Intent(Settings.ACTION_SETTINGS),
        )) if (tryStart(intent)) return
    }

    private fun tryStart(intent: Intent): Boolean = try {
        startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        true
    } catch (e: Exception) {
        false
    }

    // ===== מזג אוויר (לפי המיקום המשוער של החיבור לאינטרנט) =====

    private fun loadWeather() {
        val cachedAt = prefs.getLong("weather_at", 0)
        prefs.getString("weather", null)?.let { showWeather(it) }
        if (System.currentTimeMillis() - cachedAt < 30 * 60_000) return
        loader.execute {
            try {
                val client = OkHttpClient.Builder().callTimeout(10, TimeUnit.SECONDS).build()
                val place = JSONObject(client.newCall(Request.Builder().url("https://ipwho.is/").build()).execute().use { it.body!!.string() })
                val lat = place.optDouble("latitude", 32.08)
                val lon = place.optDouble("longitude", 34.78)
                val url = "https://api.open-meteo.com/v1/forecast?latitude=$lat&longitude=$lon&current=temperature_2m,weather_code"
                val current = JSONObject(client.newCall(Request.Builder().url(url).build()).execute().use { it.body!!.string() })
                    .getJSONObject("current")
                val temp = Math.round(current.getDouble("temperature_2m"))
                val label = "${weatherIcon(current.getInt("weather_code"))}  $temp°"
                prefs.edit().putString("weather", label).putLong("weather_at", System.currentTimeMillis()).apply()
                main.post { showWeather(label) }
            } catch (e: Exception) {
                Log.w("HomeActivity", "weather", e)
            }
        }
    }

    private fun showWeather(label: String) {
        weather.text = label
        weather.visibility = View.VISIBLE
    }

    private fun weatherIcon(code: Int) = when (code) {
        0 -> "☀️"
        1, 2 -> "🌤"
        3 -> "☁️"
        45, 48 -> "🌫"
        in 51..67, in 80..82 -> "🌧"
        in 71..77, 85, 86 -> "❄️"
        in 95..99 -> "⛈"
        else -> "🌡"
    }

    // ===== עזרים לעיצוב =====

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    private fun text(value: String, sizeSp: Float, color: String, bold: Boolean = false) = TextView(this).apply {
        text = value
        setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
        setTextColor(Color.parseColor(color))
        if (bold) typeface = Typeface.DEFAULT_BOLD
    }

    private fun sectionTitle(value: String) = text(value, 22f, "#4A3470", bold = true).apply {
        setPadding(dp(4), dp(26), dp(4), dp(4))
    }

    private fun rounded(color: String, radiusDp: Float) = GradientDrawable().apply {
        setColor(Color.parseColor(color))
        cornerRadius = radiusDp * resources.displayMetrics.density
    }

    private fun gradient() = GradientDrawable(
        GradientDrawable.Orientation.TL_BR,
        intArrayOf(Color.parseColor("#FFE4EC"), Color.parseColor("#EDE4FF")),
    )

    private fun pillButton(label: String, onClick: () -> Unit) = text(label, 18f, "#4A3470").apply {
        isFocusable = true
        background = getDrawable(R.drawable.btn_tv)
        setTextColor(getColorStateList(R.color.btn_text))
        gravity = Gravity.CENTER
        setPadding(dp(22), dp(12), dp(22), dp(12))
        setOnClickListener { onClick() }
        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            marginStart = dp(12)
        }
    }

    companion object {
        private val DEFAULT_FAVS = listOf(
            "com.teamsmart.videomanager.tv", "com.liskovsoft.smarttubetv.beta", "com.google.android.youtube.tv",
            "com.netflix.ninja", "com.apple.atve.androidtv.appletv", "com.disney.disneyplus",
            "com.amazon.amazonvideo.livingroom", "com.spotify.tv.android",
        )
        private val JUNK = Regex("launcher|webview|assist|remote ?service|tester|stub|provider|bridge|setup|wizard|^com\\.|^android", RegexOption.IGNORE_CASE)
    }
}
