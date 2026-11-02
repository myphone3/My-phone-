package com.newphone.babymonitor;

import android.Manifest;
import android.app.NotificationManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.IntentFilter;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.BatteryManager;
import android.provider.MediaStore;
import android.util.Base64;
import java.io.OutputStream;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "Monitor",
    permissions = {
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }),
        @Permission(alias = "camera", strings = { Manifest.permission.CAMERA }),
        @Permission(alias = "notifications", strings = { "android.permission.POST_NOTIFICATIONS" })
    }
)
public class MonitorPlugin extends Plugin {
    private int alertId = 2000;
    private float ambientTemp = Float.NaN;

    @Override
    public void load() {
        // חיישן טמפרטורת חדר קיים רק בחלק מהטלפונים
        SensorManager sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        Sensor s = sm != null ? sm.getDefaultSensor(Sensor.TYPE_AMBIENT_TEMPERATURE) : null;
        if (s != null) {
            sm.registerListener(new SensorEventListener() {
                @Override public void onSensorChanged(SensorEvent e) { ambientTemp = e.values[0]; }
                @Override public void onAccuracyChanged(Sensor sensor, int accuracy) {}
            }, s, SensorManager.SENSOR_DELAY_NORMAL);
        }
    }

    @PluginMethod
    public void deviceInfo(PluginCall call) {
        JSObject r = new JSObject();
        Intent b = ContextCompat.registerReceiver(getContext(), null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED), ContextCompat.RECEIVER_NOT_EXPORTED);
        if (b != null) {
            int level = b.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
            int scale = b.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
            int status = b.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
            int plugged = b.getIntExtra(BatteryManager.EXTRA_PLUGGED, 0);
            if (level >= 0 && scale > 0) r.put("battery", Math.round(level * 100f / scale));
            r.put("charging", plugged != 0 || status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL);
        }
        if (!Float.isNaN(ambientTemp)) r.put("temp", Math.round(ambientTemp * 10) / 10.0);
        call.resolve(r);
    }

    /** שמירת תמונה מהשידור לגלריה (תיקייה BabyMonitor) */
    @PluginMethod
    public void saveImage(PluginCall call) {
        String data = call.getString("data");
        if (data == null) { call.reject("no_data"); return; }
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            ContentResolver cr = getContext().getContentResolver();
            ContentValues v = new ContentValues();
            v.put(MediaStore.Images.Media.DISPLAY_NAME, call.getString("name", "baby-" + System.currentTimeMillis() + ".jpg"));
            v.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
            if (Build.VERSION.SDK_INT >= 29) v.put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/BabyMonitor");
            Uri uri = cr.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
            if (uri == null) { call.reject("insert_failed"); return; }
            try (OutputStream os = cr.openOutputStream(uri)) { os.write(bytes); }
            call.resolve();
        } catch (Exception e) {
            call.reject("save_failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void requestAll(PluginCall call) {
        boolean needNotif = Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED;
        boolean baby = "baby".equals(call.getString("mode"));
        boolean wantMic = baby || Boolean.TRUE.equals(call.getBoolean("mic", false));
        boolean needMic = wantMic && getPermissionState("microphone") != PermissionState.GRANTED;
        boolean needCam = baby && Boolean.TRUE.equals(call.getBoolean("camera", false)) && getPermissionState("camera") != PermissionState.GRANTED;
        java.util.List<String> aliases = new java.util.ArrayList<>();
        if (needMic) aliases.add("microphone");
        if (needCam) aliases.add("camera");
        if (needNotif) aliases.add("notifications");
        if (aliases.isEmpty()) permsDone(call);
        else requestPermissionForAliases(aliases.toArray(new String[0]), call, "permsDone");
    }

    @PermissionCallback
    private void permsDone(PluginCall call) {
        JSObject r = new JSObject();
        r.put("microphone", getPermissionState("microphone") == PermissionState.GRANTED);
        r.put("camera", getPermissionState("camera") == PermissionState.GRANTED);
        r.put("notifications", Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED);
        call.resolve(r);
    }

    @PluginMethod
    public void start(PluginCall call) {
        Context ctx = getContext();
        Intent i = new Intent(ctx, MonitorService.class);
        i.putExtra("mode", call.getString("mode", "parent"));
        i.putExtra("title", call.getString("title", "ביבי-מוניטור"));
        i.putExtra("text", call.getString("text", ""));
        i.putExtra("camera", Boolean.TRUE.equals(call.getBoolean("camera", false)));
        try {
            ContextCompat.startForegroundService(ctx, i);
            call.resolve();
        } catch (Exception e) {
            call.reject("start_failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getContext().stopService(new Intent(getContext(), MonitorService.class));
        call.resolve();
    }

    @PluginMethod
    public void alert(PluginCall call) {
        Context ctx = getContext();
        MonitorService.ensureChannels(ctx);
        String mode = call.getString("mode", "ring");
        String channel = "silent".equals(mode) ? MonitorService.CH_ALERT_SILENT
            : "vibrate".equals(mode) ? MonitorService.CH_ALERT_VIBRATE : MonitorService.CH_ALERT;
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, channel)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle(call.getString("title", "התינוק בוכה"))
            .setContentText(call.getString("text", ""))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .setContentIntent(MonitorService.openApp(ctx));
        try {
            NotificationManagerCompat.from(ctx).notify(alertId++, b.build());
        } catch (SecurityException e) {
            // אין הרשאת התראות
        }
        call.resolve();
    }

    /** מחשיך את המסך כמעט לגמרי ומונע ממנו להינעל, כך שהמצלמה והמיקרופון ממשיכים לעבוד */
    @PluginMethod
    public void dim(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        getActivity().runOnUiThread(() -> {
            android.view.Window w = getActivity().getWindow();
            android.view.WindowManager.LayoutParams lp = w.getAttributes();
            if (on) {
                w.addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                lp.screenBrightness = 0.01f;
            } else {
                w.clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                lp.screenBrightness = android.view.WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE;
            }
            w.setAttributes(lp);
            call.resolve();
        });
    }

    @PluginMethod
    public void batteryStatus(PluginCall call) {
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        JSObject r = new JSObject();
        r.put("unrestricted", Build.VERSION.SDK_INT < 23 || pm.isIgnoringBatteryOptimizations(getContext().getPackageName()));
        call.resolve(r);
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            i.setData(Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (Exception e) {
            Intent i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        }
        call.resolve();
    }
}
