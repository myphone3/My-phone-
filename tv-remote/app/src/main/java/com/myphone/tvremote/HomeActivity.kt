package com.myphone.tvremote

import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.content.pm.ResolveInfo
import android.graphics.Bitmap
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
import android.view.animation.DecelerateInterpolator
import android.view.animation.LinearInterpolator
import android.widget.FrameLayout
import android.widget.GridLayout
import android.widget.HorizontalScrollView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * מסך הבית של "שלט מהפון": תמונות רקע מתחלפות, שעון ומזג אוויר גדולים,
 * שורת מועדפים למטה, ו"חץ למטה" פותח את כל האפליקציות.
 */
class HomeActivity : Activity() {

    private val main = Handler(Looper.getMainLooper())
    private val loader = Executors.newFixedThreadPool(2)

    private lateinit var bgFront: ImageView
    private lateinit var bgBack: ImageView
    private lateinit var clock: TextView
    private lateinit var date: TextView
    private lateinit var greeting: TextView
    private lateinit var weatherTemp: TextView
    private lateinit var weatherText: TextView
    private lateinit var weatherBox: View
    private lateinit var favRow: LinearLayout
    private lateinit var drawer: FrameLayout
    private lateinit var grid: GridLayout
    private lateinit var drawerScroll: ScrollView

    private var apps: List<App> = emptyList()
    private var drawerOpen = false
    private var showHidden = false
    private var photoIndex = 0
    private var frontBitmap: Bitmap? = null
    private var favWidth = 200

    private val prefs by lazy { getSharedPreferences("home", Context.MODE_PRIVATE) }

    private class App(val pkg: String, val label: String, val info: ResolveInfo)

    private val tick = object : Runnable {
        override fun run() {
            updateClock()
            main.postDelayed(this, 10_000)
        }
    }

    private val slideshow = object : Runnable {
        override fun run() {
            nextPhoto()
            main.postDelayed(this, PhotoStore.intervalSec(this@HomeActivity) * 1000L)
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
        PhotoStore.listener = { restartSlideshow() }
        restartSlideshow()
        loadApps()
        loadWeather()
    }

    override fun onPause() {
        main.removeCallbacks(tick)
        main.removeCallbacks(slideshow)
        PhotoStore.listener = null
        super.onPause()
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        // לחיצה על "בית" כשכבר נמצאים במסך הבית: סוגרים את רשימת האפליקציות
        if (drawerOpen) closeDrawer()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (drawerOpen) closeDrawer()
    }

    // ===== בניית המסך =====

    private fun buildScreen(): View {
        val root = FrameLayout(this).apply {
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            setBackgroundColor(Color.parseColor("#1E1432"))
        }
        val match = FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)

        // תמונות הרקע (שתי שכבות שמתחלפות ברכות). בלי תמונות: רקע צבעוני רך.
        root.addView(View(this).apply {
            background = GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                intArrayOf(Color.parseColor("#F79AC0"), Color.parseColor("#B794F6"), Color.parseColor("#6D5BD0")),
            )
        }, match)
        bgBack = ImageView(this).apply { scaleType = ImageView.ScaleType.CENTER_CROP; alpha = 0f }
        bgFront = ImageView(this).apply { scaleType = ImageView.ScaleType.CENTER_CROP; alpha = 0f }
        root.addView(bgBack, FrameLayout.LayoutParams(match))
        root.addView(bgFront, FrameLayout.LayoutParams(match))

        // הצללה עדינה למעלה ולמטה, כדי שהשעון והמועדפים ייקראו טוב על כל תמונה
        root.addView(View(this).apply {
            background = GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                intArrayOf(Color.argb(110, 15, 8, 30), Color.argb(20, 15, 8, 30), Color.argb(30, 15, 8, 30), Color.argb(190, 15, 8, 30)),
            )
        }, FrameLayout.LayoutParams(match))

        // שעון בסגנון אפל: תאריך קטן למעלה, שעה ענקית ודקה מתחתיו, מזג אוויר בשורה עדינה - הכול במרכז
        val clockBox = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
        }
        date = text("", 24f, "#FFFFFF", weight = 500).apply { alpha = 0.92f; gravity = Gravity.CENTER }
        clock = text("", 150f, "#FFFFFF", weight = 250).apply {
            gravity = Gravity.CENTER
            includeFontPadding = false
            maxLines = 1
            isSingleLine = true
            setPadding(0, dp(-6), 0, dp(-4))
        }
        greeting = text("", 1f, "#FFFFFF").apply { visibility = View.GONE }
        listOf(date, clock).forEach { shadow(it); clockBox.addView(it, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT)) }

        val wBox = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            background = rounded(Color.argb(55, 255, 255, 255), 999f, Color.argb(80, 255, 255, 255))
            setPadding(dp(18), dp(7), dp(18), dp(7))
            visibility = View.GONE
        }
        weatherTemp = text("", 22f, "#FFFFFF", weight = 600)
        weatherText = text("", 18f, "#FFFFFF", weight = 400).apply { alpha = 0.92f; setPaddingRelative(dp(16), 0, 0, 0) }
        wBox.addView(weatherTemp)
        wBox.addView(weatherText)
        weatherBox = wBox
        clockBox.addView(wBox, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            topMargin = dp(10)
        })
        root.addView(clockBox, FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP or Gravity.CENTER_HORIZONTAL).apply {
            topMargin = dp(46)
        })

        // שורת המועדפים - למטה
        val bottom = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            clipChildren = false
            clipToPadding = false
        }
        val favScroll = HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = false
            isFillViewport = true
            clipChildren = false
            clipToPadding = false
            setPadding(dp(SAFE_SIDE), dp(18), dp(SAFE_SIDE), dp(12))
        }
        favRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_HORIZONTAL
            clipChildren = false
        }
        favScroll.addView(favRow)
        bottom.addView(favScroll)
        bottom.addView(text("⌄   כל האפליקציות", 16f, "#FFFFFF", weight = 500).apply {
            alpha = 0.8f
            gravity = Gravity.CENTER
            shadow(this)
            // מרווח מהשוליים: הרבה טלוויזיות "חותכות" קצת מקצוות המסך
            setPadding(0, dp(2), 0, dp(SAFE_BOTTOM))
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        root.addView(bottom, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM))

        // רשימת כל האפליקציות - נפתחת מלמטה, על כל רוחב המסך
        drawer = FrameLayout(this).apply {
            setBackgroundColor(Color.argb(232, 22, 13, 38))
            visibility = View.GONE
        }
        drawerScroll = ScrollView(this).apply { isVerticalScrollBarEnabled = false; clipToPadding = false }
        val drawerPage = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(DRAWER_PAD), dp(30), dp(DRAWER_PAD), dp(40))
        }
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val titles = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        titles.addView(text("כל האפליקציות", 28f, "#FFFFFF", weight = 700))
        titles.addView(text("לחיצה ארוכה על OK: מועדפים או הסתרה  ·  חזור: סגירה", 15f, "#C9B8F0"))
        header.addView(titles, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        // קיצורים: WiFi, הגדרות, ושלט מהפון
        header.addView(iconButton(R.drawable.ic_wifi_line) { openWifi() })
        header.addView(iconButton(R.drawable.ic_settings_line) { openSettings() })
        drawerPage.addView(header)
        grid = GridLayout(this).apply {
            columnCount = GRID_COLUMNS
            clipChildren = false
            setPadding(0, dp(18), 0, 0)
        }
        drawerPage.addView(grid)
        drawerScroll.addView(drawerPage)
        drawer.addView(drawerScroll, FrameLayout.LayoutParams(match))
        root.addView(drawer, FrameLayout.LayoutParams(match))
        return root
    }

    /** כפתור עגול עם סמל בלבד (בסגנון אפל), בראש רשימת האפליקציות. "למעלה" ממנו סוגר את הרשימה. */
    private fun iconButton(icon: Int, onClick: () -> Unit): View {
        val button = FrameLayout(this).apply {
            isFocusable = true
            background = rounded(Color.argb(45, 255, 255, 255), 999f, Color.argb(80, 255, 255, 255))
            setOnClickListener { onClick() }
            onFocusChangeListener = focusAnimator(1.12f, light = true, round = true)
            setOnKeyListener { _, keyCode, event ->
                if (keyCode == KeyEvent.KEYCODE_DPAD_UP && event.action == KeyEvent.ACTION_DOWN) { closeDrawer(); true } else false
            }
            layoutParams = LinearLayout.LayoutParams(dp(52), dp(52)).apply { marginStart = dp(14) }
        }
        button.addView(ImageView(this).apply { setImageResource(icon) }, FrameLayout.LayoutParams(dp(26), dp(26), Gravity.CENTER))
        return button
    }

    private fun openWifi() {
        for (intent in listOf(
            Intent().setClassName("com.android.tv.settings", "com.android.tv.settings.connectivity.NetworkActivity"),
            Intent("android.settings.WIFI_SETTINGS").setPackage("com.android.tv.settings"),
            Intent(Settings.ACTION_WIFI_SETTINGS),
            Intent(Settings.ACTION_WIRELESS_SETTINGS),
        )) if (tryStart(intent)) return
        openSettings()
    }

    private fun updateClock() {
        val now = Date()
        clock.text = SimpleDateFormat("H:mm", Locale.getDefault()).format(now)
        date.text = SimpleDateFormat("EEEE, d בMMMM", Locale("iw")).format(now)
    }

    // ===== תמונות רקע =====

    private fun restartSlideshow() {
        main.removeCallbacks(slideshow)
        main.post(slideshow)
    }

    private fun nextPhoto() {
        val photos = PhotoStore.list(this)
        if (photos.isEmpty()) {
            bgFront.animate().alpha(0f).setDuration(800).start()
            bgBack.alpha = 0f
            return
        }
        if (photos.size == 1 && frontBitmap != null) return
        photoIndex = (photoIndex + 1) % photos.size
        val file = photos[photoIndex]
        val w = resources.displayMetrics.widthPixels
        val h = resources.displayMetrics.heightPixels
        loader.execute {
            val bitmap = PhotoStore.decode(file, w, h) ?: return@execute
            main.post { crossfadeTo(bitmap) }
        }
    }

    /**
     * מעבר רך לתמונה הבאה, עם זום איטי מאוד ("אפקט קן ברנס").
     * שתי שכבות קבועות: התמונה החדשה נכנסת לשכבה שלא מוצגת, ואז מחליפים ביניהן בהדרגה.
     */
    private fun crossfadeTo(bitmap: Bitmap) {
        val top = bgFront
        val bottom = bgBack
        val old = frontBitmap
        frontBitmap = bitmap
        val zoomMs = PhotoStore.intervalSec(this) * 1000L + 1600
        fun zoom(v: ImageView) {
            v.scaleX = 1f
            v.scaleY = 1f
            v.animate().scaleX(1.08f).scaleY(1.08f).setDuration(zoomMs).setInterpolator(LinearInterpolator()).start()
        }
        if (top.alpha > 0.5f) {
            bottom.setImageBitmap(bitmap)
            bottom.alpha = 1f
            zoom(bottom)
            top.animate().alpha(0f).setDuration(1400).setInterpolator(DecelerateInterpolator()).withEndAction {
                top.setImageDrawable(null)
                if (old != null && old !== bitmap) old.recycle()
            }.start()
        } else {
            top.setImageBitmap(bitmap)
            top.alpha = 0f
            zoom(top)
            top.animate().alpha(1f).setDuration(1400).setInterpolator(DecelerateInterpolator()).withEndAction {
                bottom.setImageDrawable(null)
                bottom.alpha = 0f
                if (old != null && old !== bitmap) old.recycle()
            }.start()
        }
    }

    // ===== אפליקציות =====

    private fun loadApps() {
        loader.execute {
            val list = queryApps()
            main.post {
                apps = list
                render()
            }
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

    // רק מה שבחרתם מופיע במועדפים - אין ברירות מחדל
    private fun favorites(): MutableList<String> =
        prefs.getString("favs2", "")!!.split('|').filter { it.isNotBlank() }.toMutableList()

    private fun hidden(): MutableSet<String> {
        val saved = prefs.getString("hidden", null)
        if (saved != null) return saved.split('|').filter { it.isNotBlank() }.toMutableSet()
        return apps.filter { JUNK.containsMatchIn(it.label) || JUNK.containsMatchIn(it.pkg.substringAfterLast('.')) }
            .map { it.pkg }.toMutableSet()
    }

    private fun render() {
        val favs = favorites()
        val hidden = hidden()
        val byPkg = apps.associateBy { it.pkg }
        val hadFocusInRow = favRow.hasFocus()

        favRow.removeAllViews()
        val favApps = favs.mapNotNull { byPkg[it] }
        val across = favApps.size.coerceIn(1, 5)
        favWidth = ((designWidth - SAFE_SIDE * 2 - 40 - across * FAV_GAP) / across).coerceAtMost(210)
        for (app in favApps) favRow.addView(favoriteCard(app))
        if (favApps.isEmpty()) favRow.addView(addFavoriteCard())

        grid.removeAllViews()
        val visible = apps.filter { showHidden || it.pkg !in hidden }
        for (app in visible) grid.addView(appTile(app, dimmed = app.pkg in hidden))
        grid.addView(actionTile(if (showHidden) "🙈\nהסתר מוסתרות" else "👀\nהצג מוסתרות") {
            showHidden = !showHidden
            render()
        })

        if (!drawerOpen && (hadFocusInRow || currentFocus == null)) favRow.getChildAt(0)?.requestFocus()
    }

    private fun favoriteCard(app: App): View {
        val card = FrameLayout(this).apply {
            background = rounded(Color.WHITE, 22f)
            elevation = dp(6).toFloat()
            isFocusable = true
            clipToOutline = true
            outlineProvider = android.view.ViewOutlineProvider.BACKGROUND
        }
        val image = ImageView(this).apply { scaleType = ImageView.ScaleType.CENTER_CROP }
        card.addView(image, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        loader.execute {
            val banner = loadBanner(app)
            val icon = if (banner == null) try { app.info.loadIcon(packageManager) } catch (e: Exception) { null } else null
            main.post {
                if (banner != null) {
                    image.setImageDrawable(banner)
                } else {
                    image.scaleType = ImageView.ScaleType.FIT_CENTER
                    image.setPadding(dp(30), dp(14), dp(30), dp(34))
                    image.background = GradientDrawable(
                        GradientDrawable.Orientation.TL_BR,
                        intArrayOf(Color.parseColor("#FFE4EC"), Color.parseColor("#EDE4FF")),
                    )
                    image.setImageDrawable(icon)
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
        card.setOnClickListener { launch(app) }
        card.setOnLongClickListener { showAppMenu(app); true }
        card.onFocusChangeListener = focusAnimator(1.12f)
        card.setOnKeyListener { _, keyCode, event ->
            when {
                keyCode == KeyEvent.KEYCODE_DPAD_DOWN && event.action == KeyEvent.ACTION_DOWN -> { openDrawer(); true }
                keyCode == KeyEvent.KEYCODE_MENU && event.action == KeyEvent.ACTION_UP -> { showAppMenu(app); true }
                else -> false
            }
        }
        card.layoutParams = LinearLayout.LayoutParams(dp(favWidth), dp(favWidth * 9 / 16)).apply {
            marginStart = dp(FAV_GAP / 2)
            marginEnd = dp(FAV_GAP / 2)
        }
        return card
    }

    private fun addFavoriteCard(): View {
        val card = text("＋  הוספת מועדפים", 18f, "#FFFFFF", bold = true).apply {
            gravity = Gravity.CENTER
            isFocusable = true
            background = rounded(Color.argb(60, 255, 255, 255), 22f, Color.argb(140, 255, 255, 255))
            setOnClickListener {
                openDrawer()
                Toast.makeText(this@HomeActivity, "בחרו אפליקציה ולחצו לחיצה ארוכה על OK ← \"הוסף למועדפים\"", Toast.LENGTH_LONG).show()
            }
            onFocusChangeListener = focusAnimator(1.08f)
            setOnKeyListener { _, keyCode, event ->
                if (keyCode == KeyEvent.KEYCODE_DPAD_DOWN && event.action == KeyEvent.ACTION_DOWN) { openDrawer(); true } else false
            }
        }
        card.layoutParams = LinearLayout.LayoutParams(dp(260), dp(110))
        return card
    }

    private fun appTile(app: App, dimmed: Boolean): View {
        val tile = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            isFocusable = true
            background = rounded(Color.argb(28, 255, 255, 255), 22f)
            setPadding(dp(6), dp(8), dp(6), dp(8))
            alpha = if (dimmed) 0.45f else 1f
        }
        val icon = ImageView(this)
        tile.addView(icon, LinearLayout.LayoutParams(dp(50), dp(50)))
        loader.execute {
            val drawable = try { app.info.loadIcon(packageManager) } catch (e: Exception) { null }
            main.post { icon.setImageDrawable(drawable) }
        }
        tile.addView(text(app.label, 13f, "#FFFFFF").apply {
            gravity = Gravity.CENTER
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.END
            includeFontPadding = true
            setPadding(0, dp(7), 0, dp(2))
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        tile.setOnClickListener { launch(app) }
        tile.setOnLongClickListener { showAppMenu(app); true }
        tile.onFocusChangeListener = focusAnimator(1.12f, light = true)
        tile.setOnKeyListener { _, keyCode, event ->
            when {
                keyCode == KeyEvent.KEYCODE_MENU && event.action == KeyEvent.ACTION_UP -> { showAppMenu(app); true }
                else -> false
            }
        }
        tile.layoutParams = tileParams()
        return tile
    }

    private fun actionTile(label: String, onClick: () -> Unit): View = text(label, 14f, "#C9B8F0").apply {
        gravity = Gravity.CENTER
        isFocusable = true
        background = rounded(Color.argb(18, 255, 255, 255), 22f, Color.argb(60, 255, 255, 255))
        setOnClickListener { onClick() }
        onFocusChangeListener = focusAnimator(1.1f, light = true)
        layoutParams = tileParams()
    }

    /** גודל משבצת שממלא את כל רוחב המסך בשורות שלמות. */
    private fun tileParams() = GridLayout.LayoutParams().apply {
        val usable = designWidth - DRAWER_PAD * 2
        val size = usable / GRID_COLUMNS - TILE_GAP * 2
        width = dp(size)
        height = dp(size + 8)
        setMargins(dp(TILE_GAP), dp(TILE_GAP), dp(TILE_GAP), dp(TILE_GAP))
    }

    private fun openDrawer() {
        if (drawerOpen) return
        drawerOpen = true
        drawer.visibility = View.VISIBLE
        drawer.alpha = 0f
        drawer.translationY = dp(60).toFloat()
        drawer.animate().alpha(1f).translationY(0f).setDuration(260).setInterpolator(DecelerateInterpolator()).start()
        drawerScroll.scrollTo(0, 0)
        grid.getChildAt(0)?.requestFocus()
    }

    private fun closeDrawer() {
        if (!drawerOpen) return
        drawerOpen = false
        drawer.animate().alpha(0f).translationY(dp(60).toFloat()).setDuration(200)
            .withEndAction { drawer.visibility = View.GONE }.start()
        favRow.getChildAt(0)?.requestFocus()
    }

    /** בחירה מגדילה את הפריט ומוסיפה מסגרת צבעונית. */
    private fun focusAnimator(scale: Float, light: Boolean = false, round: Boolean = false) = View.OnFocusChangeListener { v, focused ->
        v.animate().scaleX(if (focused) scale else 1f).scaleY(if (focused) scale else 1f)
            .translationZ(if (focused) dp(12).toFloat() else 0f).setDuration(160).start()
        v.foreground = if (focused) GradientDrawable().apply {
            cornerRadius = if (round) dp(999).toFloat() else dp(22).toFloat()
            setStroke(dp(3), Color.parseColor(if (light) "#E9DDFF" else "#FFFFFF"))
            if (light) setColor(Color.argb(30, 255, 255, 255))
        } else null
    }

    private fun showAppMenu(app: App) {
        val favs = favorites()
        val hidden = hidden()
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
            options += "←  הזז ימינה במועדפים" to {
                val i = favs.indexOf(app.pkg)
                if (i > 0) { favs.removeAt(i); favs.add(i - 1, app.pkg); saveFavs(favs) }
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
                render()
            }
            .show()
    }

    private fun saveFavs(list: List<String>) = prefs.edit().putString("favs2", list.joinToString("|")).apply()
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
        prefs.getString("weather2", null)?.let { showWeather(JSONObject(it)) }
        if (System.currentTimeMillis() - prefs.getLong("weather2_at", 0) < 30 * 60_000) return
        loader.execute {
            try {
                val client = OkHttpClient.Builder().callTimeout(12, TimeUnit.SECONDS).build()
                fun get(url: String) = client.newCall(Request.Builder().url(url).build()).execute().use { it.body!!.string() }
                val place = try { JSONObject(get("https://ipwho.is/")) } catch (e: Exception) { JSONObject() }
                val lat = place.optDouble("latitude", 32.08)
                val lon = place.optDouble("longitude", 34.78)
                val forecast = JSONObject(get(
                    "https://api.open-meteo.com/v1/forecast?latitude=$lat&longitude=$lon" +
                        "&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1"
                ))
                val current = forecast.getJSONObject("current")
                val daily = forecast.getJSONObject("daily")
                val data = JSONObject()
                    .put("temp", Math.round(current.getDouble("temperature_2m")))
                    .put("code", current.getInt("weather_code"))
                    .put("max", Math.round(daily.getJSONArray("temperature_2m_max").getDouble(0)))
                    .put("min", Math.round(daily.getJSONArray("temperature_2m_min").getDouble(0)))
                    .put("city", place.optString("city", ""))
                prefs.edit().putString("weather2", data.toString()).putLong("weather2_at", System.currentTimeMillis()).apply()
                main.post { showWeather(data) }
            } catch (e: Exception) {
                Log.w("HomeActivity", "weather", e)
            }
        }
    }

    private fun showWeather(data: JSONObject) {
        val code = data.optInt("code")
        weatherTemp.text = "${weatherIcon(code)}  ${data.optInt("temp")}°"
        weatherText.text = "${weatherName(code)}  ·  ${data.optInt("max")}° / ${data.optInt("min")}°"
        weatherBox.visibility = View.VISIBLE
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

    private fun weatherName(code: Int) = when (code) {
        0 -> "בהיר"
        1 -> "בהיר ברובו"
        2 -> "מעונן חלקית"
        3 -> "מעונן"
        45, 48 -> "ערפל"
        in 51..57 -> "טפטוף"
        in 61..67 -> "גשם"
        in 71..77, 85, 86 -> "שלג"
        in 80..82 -> "ממטרים"
        in 95..99 -> "סופת רעמים"
        else -> ""
    }

    // ===== עזרים לעיצוב =====

    /**
     * כל המידות מתוכננות למסך בגובה 540 יחידות, ומוגדלות לפי הטלוויזיה -
     * ככה המסך נראה אותו דבר בכל טלוויזיה ובכל רזולוציה.
     */
    private val unit by lazy { resources.displayMetrics.heightPixels / 540f }
    private val designWidth by lazy { (resources.displayMetrics.widthPixels / unit).toInt() }

    private fun dp(value: Int) = (value * unit).toInt()

    private fun text(value: String, size: Float, color: String, bold: Boolean = false, weight: Int = 0) = TextView(this).apply {
        text = value
        setTextSize(TypedValue.COMPLEX_UNIT_PX, size * unit)
        setTextColor(Color.parseColor(color))
        typeface = when {
            weight > 0 && android.os.Build.VERSION.SDK_INT >= 28 -> Typeface.create(Typeface.SANS_SERIF, weight, false)
            weight >= 600 -> Typeface.DEFAULT_BOLD
            bold -> Typeface.DEFAULT_BOLD
            else -> Typeface.DEFAULT
        }
    }

    private fun shadow(view: TextView) = view.setShadowLayer(dp(10).toFloat(), 0f, dp(2).toFloat(), Color.argb(130, 20, 10, 40))

    private fun rounded(color: Int, radiusDp: Float, stroke: Int? = null) = GradientDrawable().apply {
        setColor(color)
        cornerRadius = radiusDp * resources.displayMetrics.density
        if (stroke != null) setStroke(dp(1), stroke)
    }

    companion object {
        private const val GRID_COLUMNS = 8
        private const val SAFE_SIDE = 56
        private const val SAFE_BOTTOM = 30
        private const val FAV_GAP = 22
        private const val DRAWER_PAD = 48
        private const val TILE_GAP = 6
        private val JUNK = Regex("launcher|webview|assist|remote ?service|tester|stub|provider|bridge|setup|wizard|^com\\.|^android", RegexOption.IGNORE_CASE)
    }
}
