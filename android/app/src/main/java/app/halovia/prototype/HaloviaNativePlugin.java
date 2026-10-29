package app.halovia.prototype;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

/**
 * Small bridge for the live SOS: tells the web app whether this build has
 * Firebase (google-services.json) and the settings that decide whether an
 * alarm gets through in the background, and opens the matching settings pages.
 */
@CapacitorPlugin(name = "HaloviaNative")
public class HaloviaNativePlugin extends Plugin {

    @PluginMethod
    public void status(PluginCall call) {
        Context context = getContext();
        JSObject result = new JSObject();
        boolean firebase = !FirebaseApp.getApps(context).isEmpty();
        result.put("firebaseConfigured", firebase);
        if (firebase) {
            FirebaseOptions options = FirebaseApp.getInstance().getOptions();
            JSObject config = new JSObject();
            config.put("apiKey", options.getApiKey());
            config.put("appId", options.getApplicationId());
            config.put("projectId", options.getProjectId());
            config.put("senderId", options.getGcmSenderId());
            result.put("firebase", config);
        }
        result.put("sdkInt", Build.VERSION.SDK_INT);
        result.put("notificationsEnabled", NotificationManagerCompat.from(context).areNotificationsEnabled());
        boolean fullScreen = true;
        if (Build.VERSION.SDK_INT >= 34) {
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            fullScreen = manager != null && manager.canUseFullScreenIntent();
        }
        result.put("canUseFullScreenIntent", fullScreen);
        PowerManager power = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        result.put("ignoringBatteryOptimizations", power != null && power.isIgnoringBatteryOptimizations(context.getPackageName()));
        boolean background = Build.VERSION.SDK_INT < 29
            || ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED;
        result.put("backgroundLocation", background);
        call.resolve(result);
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        String pkg = getContext().getPackageName();
        // Direct "allow" dialog first; some Android skins only have the list.
        if (!start(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + pkg)))
            && !start(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))) {
            start(appDetails());
        }
        call.resolve();
    }

    @PluginMethod
    public void openFullScreenIntentSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT < 34 || !start(new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + getContext().getPackageName())))) {
            start(appDetails());
        }
        call.resolve();
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        start(appDetails());
        call.resolve();
    }

    @PluginMethod
    public void setAlertMode(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        Activity activity = getActivity();
        if (activity != null) {
            activity.runOnUiThread(() -> MainActivity.showOverLockScreen(activity, on));
        }
        if (!on) HaloviaMessagingService.clearSosNotifications(getContext());
        call.resolve();
    }

    /** Settings pages and dialogs pause the app; tell the web app to re-read status when it is back. */
    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        notifyListeners("resumed", new JSObject());
    }

    private Intent appDetails() {
        return new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
    }

    private boolean start(Intent intent) {
        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            return true;
        } catch (Exception error) {
            return false;
        }
    }
}
