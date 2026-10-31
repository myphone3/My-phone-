package com.newphone.babymonitor;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

/**
 * שירות חזית שמשאיר את האפליקציה חיה כשהמסך כבוי:
 * במכשיר התינוק - מיקרופון, במכשיר ההורה - ניגון שמע.
 */
public class MonitorService extends Service {
    public static final String CH_RUN = "monitor_running";
    public static final String CH_ALERT = "monitor_alert_ring";
    public static final String CH_ALERT_VIBRATE = "monitor_alert_vibrate";
    public static final String CH_ALERT_SILENT = "monitor_alert_silent";
    static final int RUN_ID = 1001;

    private PowerManager.WakeLock wakeLock;

    static void ensureChannels(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        NotificationChannel run = new NotificationChannel(CH_RUN, "פעילות המוניטור", NotificationManager.IMPORTANCE_LOW);
        run.setDescription("מוצג כל עוד המוניטור פועל");
        nm.createNotificationChannel(run);
        NotificationChannel alert = new NotificationChannel(CH_ALERT, "התראות בכי", NotificationManager.IMPORTANCE_HIGH);
        alert.setDescription("התראה כשהתינוק בוכה או כשהקשר נותק");
        alert.enableVibration(true);
        alert.setVibrationPattern(new long[] {0, 500, 200, 500, 200, 500});
        alert.setBypassDnd(true);
        android.media.AudioAttributes aa = new android.media.AudioAttributes.Builder()
            .setUsage(android.media.AudioAttributes.USAGE_ALARM)
            .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        alert.setSound(android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_ALARM), aa);
        nm.createNotificationChannel(alert);
        NotificationChannel vib = new NotificationChannel(CH_ALERT_VIBRATE, "התראות בכי ברטט", NotificationManager.IMPORTANCE_HIGH);
        vib.setSound(null, null);
        vib.enableVibration(true);
        vib.setVibrationPattern(new long[] {0, 500, 200, 500, 200, 500});
        nm.createNotificationChannel(vib);
        NotificationChannel silent = new NotificationChannel(CH_ALERT_SILENT, "התראות בכי שקטות", NotificationManager.IMPORTANCE_HIGH);
        silent.setSound(null, null);
        silent.enableVibration(false);
        nm.createNotificationChannel(silent);
    }

    static PendingIntent openApp(Context ctx) {
        Intent i = new Intent(ctx, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, 0, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        ensureChannels(this);
        String mode = intent != null ? intent.getStringExtra("mode") : "parent";
        String title = intent != null ? intent.getStringExtra("title") : "ביבי-מוניטור";
        String text = intent != null ? intent.getStringExtra("text") : "";
        boolean camera = intent != null && intent.getBooleanExtra("camera", false);

        Notification n = new NotificationCompat.Builder(this, CH_RUN)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle(title)
            .setContentText(text)
            .setOngoing(true)
            .setContentIntent(openApp(this))
            .build();

        int type = 0;
        if (Build.VERSION.SDK_INT >= 30) {
            if ("baby".equals(mode)) {
                type = ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
                if (camera) type |= ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA;
            } else {
                type = ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK;
            }
        }
        ServiceCompat.startForeground(this, RUN_ID, n, type);

        if (wakeLock == null) {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "babymonitor:run");
            wakeLock.setReferenceCounted(false);
            wakeLock.acquire(12 * 60 * 60 * 1000L);
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        wakeLock = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
