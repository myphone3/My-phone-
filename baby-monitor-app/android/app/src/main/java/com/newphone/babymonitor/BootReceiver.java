package com.newphone.babymonitor;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/**
 * אחרי הפעלה מחדש של הטלפון אנדרואיד לא מרשה להדליק מיקרופון/מצלמה ברקע,
 * לכן מציגים התראה: הקשה עליה פותחת את האפליקציה והיא ממשיכה לבד מאיפה שהייתה.
 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;
        String mode = ctx.getSharedPreferences("bm", Context.MODE_PRIVATE).getString("active_mode", null);
        if (mode == null) return;
        MonitorService.ensureChannels(ctx);
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, MonitorService.CH_ALERT)
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .setContentTitle("baby".equals(mode) ? "מכשיר התינוק כבוי" : "המוניטור לא מחובר")
            .setContentText("הטלפון הופעל מחדש. הקישו כדי להמשיך את ביבי-מוניטור")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(MonitorService.openApp(ctx));
        try {
            NotificationManagerCompat.from(ctx).notify(1500, b.build());
        } catch (SecurityException e) {
            // אין הרשאת התראות
        }
    }
}
