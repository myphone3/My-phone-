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
    public static final String CH_ALERT = "monitor_alert";
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
        nm.createNotificationChannel(alert);
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

        Notification n = new NotificationCompat.Builder(this, CH_RUN)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle(title)
            .setContentText(text)
            .setOngoing(true)
            .setContentIntent(openApp(this))
            .build();

        int type = 0;
        if (Build.VERSION.SDK_INT >= 30) {
            type = "baby".equals(mode)
                ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                : ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK;
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
