package app.matkonim.tv;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.widget.Toast;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * בדיקת עדכונים: בכל פתיחה בודקים אם יש גרסה חדשה של האפליקציה באתר.
 * אם יש — שואלים "לעדכן?" ומתקינים מעל הגרסה הקיימת (בלי למחוק ובלי להתקין מחדש ידנית).
 */
public class Updater {
    static final String SITE = "https://matkonim-myphone3.vercel.app";
    final Activity act;
    boolean busy = false;

    Updater(Activity act) { this.act = act; }

    int currentVersion() {
        try {
            PackageInfo p = act.getPackageManager().getPackageInfo(act.getPackageName(), 0);
            return p.versionCode;
        } catch (Exception e) { return 0; }
    }

    void check(boolean manual) {
        if (busy) return;
        new Thread(() -> {
            try {
                String txt = readText(SITE + "/tv-version.json?t=" + System.currentTimeMillis());
                JSONObject j = new JSONObject(txt);
                int latest = j.optInt("versionCode", 0);
                String url = j.optString("url", "/matkonim-tv.apk");
                if (!url.startsWith("http")) url = SITE + url;
                final String apk = url;
                final String name = j.optString("versionName", "");
                if (latest > currentVersion()) act.runOnUiThread(() -> ask(apk, name));
                else if (manual) act.runOnUiThread(() -> toast("יש לכם כבר את הגרסה האחרונה"));
            } catch (Exception e) {
                if (manual) act.runOnUiThread(() -> toast("לא הצלחנו לבדוק עדכונים כרגע"));
            }
        }).start();
    }

    void ask(String apk, String name) {
        if (act.isFinishing()) return;
        new AlertDialog.Builder(act)
            .setTitle("🎉 יש גרסה חדשה של האפליקציה" + (name.isEmpty() ? "" : " (" + name + ")"))
            .setMessage("לעדכן עכשיו? זה לוקח כמה שניות, והמתכונים וההגדרות נשמרים.")
            .setPositiveButton("עדכון", (d, w) -> start(apk))
            .setNegativeButton("אחר כך", null)
            .show();
    }

    void start(String apk) {
        // באנדרואיד 8 ומעלה צריך לאשר פעם אחת לאפליקציה להתקין עדכונים
        if (Build.VERSION.SDK_INT >= 26 && !act.getPackageManager().canRequestPackageInstalls()) {
            toast("אשרו ״התקנת אפליקציות״ עבור מתכונים בגדול, וחזרו — העדכון ימשיך");
            pendingApk = apk;
            try {
                act.startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + act.getPackageName())));
            } catch (Exception e) {
                act.startActivity(new Intent(Settings.ACTION_SECURITY_SETTINGS));
            }
            return;
        }
        download(apk);
    }

    String pendingApk = null;

    // אחרי שחוזרים מההגדרות
    void resume() {
        if (pendingApk != null && (Build.VERSION.SDK_INT < 26 || act.getPackageManager().canRequestPackageInstalls())) {
            String a = pendingApk;
            pendingApk = null;
            download(a);
        }
    }

    void download(String apk) {
        busy = true;
        toast("מוריד את העדכון...");
        new Thread(() -> {
            try {
                PackageInstaller pi = act.getPackageManager().getPackageInstaller();
                PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
                params.setAppPackageName(act.getPackageName());
                int id = pi.createSession(params);
                PackageInstaller.Session session = pi.openSession(id);
                HttpURLConnection c = (HttpURLConnection) new URL(apk + (apk.contains("?") ? "&" : "?") + "t=" + System.currentTimeMillis()).openConnection();
                c.setConnectTimeout(15000);
                c.setReadTimeout(30000);
                try (InputStream in = c.getInputStream(); OutputStream out = session.openWrite("matkonim.apk", 0, -1)) {
                    byte[] buf = new byte[65536];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                    session.fsync(out);
                }
                Intent i = new Intent(act, InstallReceiver.class);
                int flags = Build.VERSION.SDK_INT >= 31 ? PendingIntent.FLAG_MUTABLE | PendingIntent.FLAG_UPDATE_CURRENT : PendingIntent.FLAG_UPDATE_CURRENT;
                PendingIntent pend = PendingIntent.getBroadcast(act, id, i, flags);
                session.commit(pend.getIntentSender());
                session.close();
            } catch (Exception e) {
                act.runOnUiThread(() -> toast("העדכון לא הצליח. נסו שוב מאוחר יותר"));
            } finally {
                busy = false;
            }
        }).start();
    }

    void toast(String s) { Toast.makeText(act, s, Toast.LENGTH_LONG).show(); }

    static String readText(String u) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(u).openConnection();
        c.setConnectTimeout(8000);
        c.setReadTimeout(8000);
        c.setUseCaches(false);
        try (InputStream in = c.getInputStream()) {
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
            return b.toString("UTF-8");
        }
    }
}
