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
    private lateinit var gear: View
    private lateinit var drawer: FrameLayout
    private lateinit var grid: GridLayout
    private lateinit var drawerScroll: ScrollView

    private var apps: List<App> = emptyList()
    private var drawerOpen = false
    private var showHidden = false
    private var photoIndex = 0
    private var frontBitmap: Bitmap? = null

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
        val fallback = View(this).apply {
            background = GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                intArrayOf(Color.parseColor("#F79AC0"), Color.parseColor("#B794F6"), Color.parseColor("#6D5BD0")),
            )
        }
        root.addView(fallback, match)
        bgBack = ImageView(this).apply { scaleType = ImageView.ScaleType.CENTER_CROP; alpha = 0f }
        bgFront = ImageView(this).apply { scaleType = ImageView.ScaleType.CENTER_CROP; alpha = 0f }
        root.addView(bgBack, FrameLayout.LayoutParams(match))
        root.addView(bgFront, FrameLayout.LayoutParams(match))

        // הצללה עדינה למעלה ולמטה, כדי שהשעון והמועדפים ייקראו טוב על כל תמונה
        root.addView(View(this).apply {
            background = GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                intArrayOf(Color.argb(120, 20, 10, 35), Color.argb(10, 20, 10, 35), Color.argb(40, 20, 10, 35), Color.argb(190, 20, 10, 35)),
            )
        }, FrameLayout.LayoutParams(match))

        // שעון, תאריך וברכה - למעלה מימין
        val clockBox = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        greeting = text("", 26f, "#FFFFFF", bold = true).apply { alpha = 0.92f }
        clock = text("", 120f, "#FFFFFF", bold = true).apply {
            setLineSpacing(0f, 0.85f)
            includeFontPadding = false
            letterSpacing = -0.02f
        }
        date = text("", 26f, "#FFFFFF").apply { alpha = 0.9f }
        listOf(greeting, clock, date).forEach { shadow(it); clockBox.addView(it) }
        root.addView(clockBox, FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP or Gravity.START).apply {
            marginStart = dp(56); topMargin = dp(40)
        })

        // מזג אוויר - בכרטיס זכוכית, מתחת לשעון
        val wBox = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            background = rounded(Color.argb(70, 255, 255, 255), 28f, Color.argb(90, 255, 255, 255))
            setPadding(dp(22), dp(12), dp(26), dp(12))
            visibility = View.GONE
        }
        weatherTemp = text("", 44f, "#FFFFFF", bold = true).apply { includeFontPadding = false }
        weatherText = text("", 19f, "#FFFFFF").apply { setPadding(dp(16), 0, 0, 0); setLineSpacing(0f, 1.1f) }
        wBox.addView(weatherTemp)
        wBox.addView(weatherText)
        weatherBox = wBox
        root.addView(wBox, FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP or Gravity.START).apply {
            marginStart = dp(60); topMargin = dp(262)
        })

        // כפתור הגדרות - בפינה למעלה
        gear = text("⚙", 30f, "#FFFFFF").apply {
            gravity = Gravity.CENTER
            isFocusable = true
            background = rounded(Color.argb(70, 255, 255, 255), 999f, Color.argb(110, 255, 255, 255))
            setOnClickListener { showSettingsMenu() }
            onFocusChangeListener = focusAnimator(1.15f, round = true)
        }
        root.addView(gear, FrameLayout.LayoutParams(dp(64), dp(64), Gravity.TOP or Gravity.END).apply {
            marginEnd = dp(44); topMargin = dp(40)
        })

        // שורת המועדפים - למטה
        val bottom = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            clipChildren = false
            clipToPadding = false
        }
        val favScroll = HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = false
            clipChildren = false
            clipToPadding = false
            setPadding(dp(50), dp(16), dp(50), dp(10))
        }
        favRow = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL; clipChildren = false }
        favScroll.addView(favRow)
        bottom.addView(favScroll)
        bottom.addView(text("▼   כל האפליקציות", 17f, "#FFFFFF").apply {
            alpha = 0.85f
            gravity = Gravity.CENTER
            shadow(this)
            setPadding(0, dp(2), 0, dp(20))
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        root.addView(bottom, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM))

        // רשימת כל האפליקציות - נפתחת מלמטה
        drawer = FrameLayout(this).apply {
            setBackgroundColor(Color.argb(225, 24, 14, 40))
            visibility = View.GONE
        }
        drawerScroll = ScrollView(this).apply { isVerticalScrollBarEnabled = false; clipToPadding = false }
        val drawerPage = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(56), dp(34), dp(56), dp(40))
        }
        drawerPage.addView(text("כל האפליקציות", 30f, "#FFFFFF", bold = true))
        drawerPage.addView(text("לחיצה ארוכה על OK: הוספה למועדפים או הסתרה  ·  חזור: סגירה", 16f, "#C9B8F0").apply {
            setPadding(0, dp(4), 0, dp(18))
        })
        grid = GridLayout(this).apply { columnCount = 7; clipChildren = false }
        drawerPage.addView(grid)
        drawerScroll.addView(drawerPage)
        drawer.addView(drawerScroll, FrameLayout.LayoutParams(match))
        root.addView(drawer, FrameLayout.LayoutParams(match))
        return root
    }

    private fun updateClock() {
        val now = Date()
        clock.text = SimpleDateFormat("HH:mm", Locale.getDefault()).format(now)
        date.text = SimpleDateFormat("EEEE, d 'ב'MMMM", Locale("iw")).format(now)
        greeting.text = when (Calendar.getInstance().get(Calendar.HOUR_OF_DAY)) {
            in 5..11 -> "בוקר טוב"
            in 12..16 -> "צהריים טובים"
            in 17..21 -> "ערב טוב"
            else -> "לילה טוב"
        }
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
                if (pkg in result || pkg == packageName) continue
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
        for (app in favApps) favRow.addView(favoriteCard(app))
        if (favApps.isEmpty()) favRow.addView(addFavoriteCard())

        grid.removeAllViews()
        val visible = apps.filter { showHidden || it.pkg !in hidden }
        for ((i, app) in visible.withIndex()) grid.addView(appTile(app, dimmed = app.pkg in hidden, firstRow = i < 7))
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
        card.layoutParams = LinearLayout.LayoutParams(dp(208), dp(117)).apply { marginEnd = dp(22) }
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
        card.layoutParams = LinearLayout.LayoutParams(dp(260), dp(117))
        return card
    }

    private fun appTile(app: App, dimmed: Boolean, firstRow: Boolean): View {
        val tile = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            isFocusable = true
            background = rounded(Color.argb(28, 255, 255, 255), 22f)
            setPadding(dp(8), dp(12), dp(8), dp(10))
            alpha = if (dimmed) 0.45f else 1f
        }
        val icon = ImageView(this)
        tile.addView(icon, LinearLayout.LayoutParams(dp(56), dp(56)))
        loader.execute {
            val drawable = try { app.info.loadIcon(packageManager) } catch (e: Exception) { null }
            main.post { icon.setImageDrawable(drawable) }
        }
        tile.addView(text(app.label, 14f, "#FFFFFF").apply {
            gravity = Gravity.CENTER
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.END
            setPadding(0, dp(8), 0, 0)
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        tile.setOnClickListener { launch(app) }
        tile.setOnLongClickListener { showAppMenu(app); true }
        tile.onFocusChangeListener = focusAnimator(1.12f, light = true)
        tile.setOnKeyListener { _, keyCode, event ->
            when {
                // מהשורה העליונה, "למעלה" חוזר למסך הבית
                firstRow && keyCode == KeyEvent.KEYCODE_DPAD_UP && event.action == KeyEvent.ACTION_DOWN -> { closeDrawer(); true }
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

    private fun tileParams() = GridLayout.LayoutParams().apply {
        width = dp(110)
        height = dp(112)
        setMargins(dp(7), dp(7), dp(7), dp(7))
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

    private fun showSettingsMenu() {
        val photos = PhotoStore.list(this).size
        val options = listOf<Pair<String, () -> Unit>>(
            "⚙  הגדרות הטלוויזיה" to { openSettings() },
            "📱  שלט מהפון (קוד QR וחיבור)" to { startActivity(Intent(this, MainActivity::class.java)) },
            "🖼  תמונות רקע ($photos)" to {
                AlertDialog.Builder(this, android.R.style.Theme_Material_Light_Dialog_Alert)
                    .setTitle("תמונות רקע")
                    .setMessage("מוסיפים ומוחקים תמונות מהטלפון:\nבשלט ← לשונית \"אפליקציות\" ← \"תמונות רקע למסך הבית\".\n\nשם אפשר גם לבחור כל כמה זמן התמונה מתחלפת.")
                    .setPositiveButton("הבנתי", null)
                    .show()
                Unit
            },
        )
        AlertDialog.Builder(this, android.R.style.Theme_Material_Light_Dialog_Alert)
            .setTitle("הגדרות")
            .setItems(options.map { it.first }.toTypedArray()) { _, which -> options[which].second() }
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
        weatherTemp.text = "${weatherIcon(code)} ${data.optInt("temp")}°"
        val city = data.optString("city")
        weatherText.text = "${weatherName(code)}\n${data.optInt("max")}° / ${data.optInt("min")}°" + if (city.isNotBlank()) "  ·  $city" else ""
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

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    private fun text(value: String, sizeSp: Float, color: String, bold: Boolean = false) = TextView(this).apply {
        text = value
        setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
        setTextColor(Color.parseColor(color))
        if (bold) typeface = Typeface.DEFAULT_BOLD
    }

    private fun shadow(view: TextView) = view.setShadowLayer(dp(10).toFloat(), 0f, dp(2).toFloat(), Color.argb(130, 20, 10, 40))

    private fun rounded(color: Int, radiusDp: Float, stroke: Int? = null) = GradientDrawable().apply {
        setColor(color)
        cornerRadius = radiusDp * resources.displayMetrics.density
        if (stroke != null) setStroke(dp(1), stroke)
    }

    companion object {
        private val JUNK = Regex("launcher|webview|assist|remote ?service|tester|stub|provider|bridge|setup|wizard|^com\\.|^android", RegexOption.IGNORE_CASE)
    }
}
