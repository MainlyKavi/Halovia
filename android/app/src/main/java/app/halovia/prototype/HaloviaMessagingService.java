package app.halovia.prototype;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.service.notification.StatusBarNotification;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.android.gms.tasks.Tasks;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.RemoteMessage;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

/**
 * Receives the SOS push even when the app is closed or the phone is locked
 * (data-only, high-priority FCM message) and shows it as an alarm: full-screen
 * on the lock screen, alarm sound that repeats until opened, vibration.
 * Then it posts a delivery receipt so the sender sees "Delivered".
 *
 * Extends the Capacitor push plugin's service so the web app still gets
 * tokens and pushNotificationReceived events when it is running.
 */
public class HaloviaMessagingService extends MessagingService {

    private static final String TAG = "HaloviaSOS";
    static final String CHANNEL_ID = "halovia_sos_alarm";
    static final String GROUP = "halovia_sos";
    static final String EXTRA_SOS = "halovia_sos";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        super.onMessageReceived(message);
        Map<String, String> data = message.getData();
        String type = data.get("type");
        if ("sos".equals(type)) {
            showSos(this, data);
            sendDeliveryReceipt(data);
        } else if ("sos_end".equals(type)) {
            String sosId = data.get("sosId");
            if (sosId != null) {
                NotificationManager manager = getSystemService(NotificationManager.class);
                if (manager != null) manager.cancel(sosId, 0);
            }
        }
    }

    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "SOS alarms", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("An SOS from someone in your Halovia circle");
        Uri alarm = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        if (alarm == null) alarm = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        channel.setSound(alarm, new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[] { 0, 900, 300, 900, 300, 900 });
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        channel.setBypassDnd(true);
        manager.createNotificationChannel(channel);
    }

    static void showSos(Context context, Map<String, String> data) {
        ensureChannel(context);
        String sosId = data.get("sosId");
        String name = data.get("senderName");
        if (sosId == null) return;
        if (name == null || name.isEmpty()) name = "Someone";
        boolean demo = "1".equals(data.get("demo"));

        Intent open = new Intent(context, MainActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(EXTRA_SOS, sosId);
        PendingIntent pending = PendingIntent.getActivity(context, sosId.hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_halovia)
            .setColor(0xFFD42A45)
            .setContentTitle((demo ? "[DEMO] " : "") + "SOS from " + name)
            .setContentText(name + " needs help. Tap to see their live location.")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setGroup(GROUP)
            .setAutoCancel(true)
            .setOngoing(true)
            .setContentIntent(pending)
            .setFullScreenIntent(pending, true)
            .addAction(0, "Open", pending);
        Notification notification = builder.build();
        // Keep ringing until the person opens it (or the sender ends the SOS).
        notification.flags |= Notification.FLAG_INSISTENT;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager != null) manager.notify(sosId, 0, notification);
    }

    static void clearSosNotifications(Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        for (StatusBarNotification active : manager.getActiveNotifications()) {
            if (GROUP.equals(active.getNotification().getGroup())) manager.cancel(active.getTag(), active.getId());
        }
    }

    /** POST {circleId, sosId, uid, token} to the ackSosDelivery function. Runs on FCM's worker thread. */
    private void sendDeliveryReceipt(Map<String, String> data) {
        String url = data.get("ackUrl");
        if (url == null || url.isEmpty()) return;
        HttpURLConnection connection = null;
        try {
            String token = Tasks.await(FirebaseMessaging.getInstance().getToken(), 5, TimeUnit.SECONDS);
            JSONObject body = new JSONObject();
            body.put("circleId", data.get("circleId"));
            body.put("sosId", data.get("sosId"));
            body.put("uid", data.get("recipientUid"));
            body.put("token", token);
            connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setConnectTimeout(6_000);
            connection.setReadTimeout(6_000);
            connection.setRequestMethod("POST");
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            try (OutputStream out = connection.getOutputStream()) {
                out.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }
            Log.i(TAG, "delivery receipt: HTTP " + connection.getResponseCode());
        } catch (Exception error) {
            // The web app also records delivery when it opens; this is the fast path.
            Log.w(TAG, "delivery receipt failed", error);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }
}
