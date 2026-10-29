package app.halovia.prototype;

import android.app.Activity;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(HaloviaNativePlugin.class);
        super.onCreate(savedInstanceState);
        HaloviaMessagingService.ensureChannel(this);
        handleSosIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleSosIntent(intent);
    }

    /**
     * Opened from an SOS alarm: show over the lock screen without asking for
     * the PIN (Android asks only if Call or Maps is tapped). The web app turns
     * this off once the alert is acknowledged.
     */
    private void handleSosIntent(Intent intent) {
        if (intent != null && intent.hasExtra(HaloviaMessagingService.EXTRA_SOS)) showOverLockScreen(this, true);
    }

    static void showOverLockScreen(Activity activity, boolean on) {
        if (Build.VERSION.SDK_INT >= 27) {
            activity.setShowWhenLocked(on);
            activity.setTurnScreenOn(on);
        } else {
            int flags = WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON;
            if (on) activity.getWindow().addFlags(flags);
            else activity.getWindow().clearFlags(flags);
        }
        if (on) activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        else activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
}
