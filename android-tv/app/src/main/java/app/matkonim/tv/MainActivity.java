package app.matkonim.tv;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * אפליקציית "מתכונים בגדול" לטלוויזיה (Android TV / Google TV / Fire TV).
 * מציגה את מסך הטלוויזיה של האתר על כל המסך, המסך לא נכבה, והשלט עובד.
 * המתכונים נשמרים במכשיר ונפתחים גם בלי אינטרנט.
 */
public class MainActivity extends Activity {
    static final String HOME = "https://matkonim-myphone3.vercel.app/tv";
    WebView web;
    Updater updater;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // המסך לא נכבה ולא עובר לשומר מסך כל עוד האפליקציה פתוחה
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        web.setKeepScreenOn(true);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false); // מוזיקה בלי לחיצה
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setUserAgentString(s.getUserAgentString() + " MatkonimTV/1.0 SmartTV");

        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                String host = u.getHost() == null ? "" : u.getHost();
                // נשארים בתוך האפליקציה (כולל נגן יוטיוב)
                return !(host.endsWith("vercel.app") || host.contains("youtube") || host.contains("google"));
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError err) {
                if (req.isForMainFrame()) view.loadUrl("file:///android_asset/offline.html");
            }
        });

        // גשר קטן: באתר אפשר ללחוץ "בדיקת עדכונים" ולראות את מספר הגרסה
        updater = new Updater(this);
        web.addJavascriptInterface(new Object() {
            @android.webkit.JavascriptInterface public void checkUpdate() { runOnUiThread(() -> updater.check(true)); }
            @android.webkit.JavascriptInterface public int version() { return updater.currentVersion(); }
        }, "MatkonimApp");

        setContentView(web);
        updater.check(false);
        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(HOME);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    // כפתור "חזור" בשלט: קודם האתר מטפל (חזרה מהמתכון וכו'), ורק במסך הבית יוצאים
    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        int code = e.getKeyCode();
        if (code == KeyEvent.KEYCODE_BACK || code == KeyEvent.KEYCODE_ESCAPE) {
            if (e.getAction() == KeyEvent.ACTION_UP) {
                web.evaluateJavascript("(window.__tvBack ? window.__tvBack() : false)", r -> {
                    if (!"true".equals(r)) {
                        if (web.canGoBack() && web.getUrl() != null && web.getUrl().startsWith("file:")) web.goBack();
                        else moveTaskToBack(true);
                    }
                });
            }
            return true;
        }
        // כפתורי מדיה בשלט → למוזיקה באתר
        String media = null;
        if (code == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE || code == KeyEvent.KEYCODE_MEDIA_PLAY || code == KeyEvent.KEYCODE_MEDIA_PAUSE) media = "MediaPlayPause";
        else if (code == KeyEvent.KEYCODE_MEDIA_NEXT || code == KeyEvent.KEYCODE_MEDIA_FAST_FORWARD) media = "MediaTrackNext";
        else if (code == KeyEvent.KEYCODE_MEDIA_PREVIOUS || code == KeyEvent.KEYCODE_MEDIA_REWIND) media = "MediaTrackPrevious";
        if (media != null) {
            if (e.getAction() == KeyEvent.ACTION_DOWN && e.getRepeatCount() == 0) {
                web.evaluateJavascript("window.dispatchEvent(new KeyboardEvent('keydown',{key:'" + media + "'}))", null);
            }
            return true;
        }
        return super.dispatchKeyEvent(e);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        if (updater != null) updater.resume();
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    protected void onPause() {
        // ממשיכים לנגן מוזיקה גם כשהאפליקציה ברקע — לא קוראים ל-web.onPause()
        super.onPause();
    }
}
