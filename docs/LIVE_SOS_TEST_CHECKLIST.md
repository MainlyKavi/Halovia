# Live SOS: two-phone test checklist

Run this on the two physical phones after the one-time setup in the README (*Demo setup and run-through*). Phone A raises the SOS and Phone B is the trusted contact. Tick each box. If a step fails, the **If not** column says what to check first.

Write down before you start: both phone models, Android versions, and whether you're on Wi-Fi, mobile data or a hotspot.

The **Already checked** column says what was tested off-device while building this (browser plus Firebase emulators). Everything marked *Phone only* has not been tested yet.

## 1. Install and permissions

| # | Step | Expected | If not | Already checked |
| --- | --- | --- | --- | --- |
| 1.1 | Install the APK on both phones (uninstall the old Halovia first). Open it. | Permission screen. Header shows **DEMO MODE**. | "App not installed": uninstall the old version. | Android 15 emulator: launches, no crash |
| 1.2 | **Allow and continue**, allow location ("While using the app") and notifications. | Home screen. | Settings → Permissions shows what was denied. | Android 15 emulator |
| 1.3 | Settings → set your name (A: Shreya, B: Kavi). | Name saved. | | Browser |
| 1.4 | Settings → Permissions → **Make sure SOS alarms get through**. Fix every row: Battery Unrestricted, Full-screen alerts on (Android 14+), Location **Allow all the time**. Return to the app. | Every row says **Allowed**. | Some phones hide these settings: search Settings for "battery" or "full screen". | Android 15 emulator: battery dialog opens and the row turns Allowed; full-screen alerts were already allowed for this sideloaded app |
| 1.5 | Xiaomi, Oppo, Vivo, Realme or OnePlus: turn on Autostart for Halovia and lock it in recent apps. | | | *Phone only* |

## 2. Pairing

| # | Step | Expected | If not | Already checked |
| --- | --- | --- | --- | --- |
| 2.1 | Phone A: Home → "… can view this journey" → Trusted group. | **Live SOS between phones** card with Create / Join. | "Not set up in this build": `google-services.json` was missing when you built. | Browser |
| 2.2 | Phone A: **Create invite code**. | A 6-character code, and the member list shows "Shreya (you)". | "Could not reach the server": check internet. | Browser + emulator |
| 2.3 | Phone B: same screen → **Join with a code** → type the code (lowercase and spaces are fine). | Both names listed on both phones, within ~2 s, no reload. | "No circle has that code": retype it. | Browser + emulator |
| 2.4 | Look at the badges. | Both phones show **Alerts on** for both people. | Alerts off: notification permission denied or no Google Play services. Reopen the app after fixing. | *Phone only* (a browser has no push) |
| 2.5 | Wrong code on Phone B, e.g. `AAAAAA`. | "No circle has that code." | | Rules tests |

## 3. SOS trigger and cancel

| # | Step | Expected | If not | Already checked |
| --- | --- | --- | --- | --- |
| 3.1 | Phone A: single tap on HELP. | Nothing happens. | | Existing behaviour |
| 3.2 | Phone A: hold HELP for 2 s, then **Cancel SOS** during the countdown. | "SOS cancelled". Phone B gets nothing. | | Browser |
| 3.3 | Phone A: double-tap HELP and let the 5 s countdown finish. | Red SOS screen with **Sent**. Then, per person: Waiting → **Delivered to Kavi**. | Stuck on "Sending…": check network. | Browser + emulator (Sent) |

## 4. Alert on Phone B (the key test)

Repeat with Phone B in each state. Time from the end of Phone A's countdown to Phone B ringing.

| # | Phone B state | Expected | Time (s) | Already checked |
| --- | --- | --- | --- | --- |
| 4.1 | Halovia open on screen | Full-screen red alert at once, alarm sound, vibration. | | Browser (no sound check) |
| 4.2 | Halovia in background (home screen) | Heads-up alarm notification, alarm sound repeating, then full-screen alert on tap. | | *Phone only* |
| 4.3 | Screen **locked** | Screen turns on with the full-screen alarm over the lock screen. | | *Phone only* |
| 4.4 | Halovia swiped away from recents | Same as 4.3. (A force-stopped app gets nothing; that's Android's rule.) | | *Phone only* |
| 4.5 | Battery saver on | Note the result; it may be slower. | | *Phone only* |

In each case Phone A should show **Delivered to Kavi** within a few seconds of Phone B ringing (sent by Phone B's native code, even before anyone opens the app).

## 5. Live location

| # | Step | Expected | If not | Already checked |
| --- | --- | --- | --- | --- |
| 5.1 | Phone B: open the alert. | Map with Shreya's red marker. "Updated Ns ago" stays under ~15 s. Phone A: **Seen by Kavi**. | "Waiting for location…": Phone A's location permission is off. | Browser + emulator |
| 5.2 | Walk 50 m with Phone A. | Marker on B moves every few seconds and leaves a red trail. | | Browser (simulated GPS) |
| 5.3 | Lock Phone A and keep walking. | Phone A shows a "Halovia SOS is active" notification. B's marker keeps moving. | Stops: set Phone A's location to Allow all the time and battery to Unrestricted. | *Phone only* |
| 5.4 | In demo mode with a shared ride (Home → ride card → Share with Halovia), raise an SOS. | B's marker follows the simulated cab along the route. | | Logic only |

## 6. Status sync and ending

| # | Step | Expected | Already checked |
| --- | --- | --- | --- |
| 6.1 | Phone B: **Acknowledge**. | B's alarm stops and the notification clears. Phone A: **Kavi acknowledged**. | Browser + emulator |
| 6.2 | Phone B: **Hide**, then tap the red banner. | The alert hides to a banner and comes back. | Browser |
| 6.3 | Phone B: **End SOS**. | Phone A's SOS screen closes with "Kavi ended your SOS". B: "Shreya's SOS has ended". | Browser + emulator |
| 6.4 | New SOS; end it from Phone A (**I'm safe, stop SOS**). | B's alert closes and its notification is cleared. | Browser (alert closes, toast); notification clear is *Phone only* |
| 6.5 | SOS from Phone B instead. | Phone A gets the alert. It works both ways. | Symmetric code; *Phone only* |

## 7. Demo mode: nothing real is called

| # | Step | Expected | Already checked |
| --- | --- | --- | --- |
| 7.1 | Phone A SOS screen: **Call police 112**. | Toast "Demo mode: this would call 112". The dialer does **not** open. | Existing behaviour |
| 7.2 | Emergency tab: tap 1098, 181, 112 and 108. | A toast for each. The dialer does **not** open. | Browser (fixed in this branch) |
| 7.3 | Phone B alert: **Call Shreya**. | Toast "Demo mode: this would call Shreya". | Browser |
| 7.4 | (Only if you want to) Settings → demo mode off → Call Shreya. | The dialer opens with Shreya's number (if she added one on the pairing card). You still have to press call. | *Phone only* |

## 8. Poor network and offline

| # | Step | Expected | Already checked |
| --- | --- | --- | --- |
| 8.1 | Phone A: airplane mode on, raise an SOS. | "No network. SOS saved, sending automatically when back online." | Browser (simulated offline) |
| 8.2 | Airplane mode off. | Within seconds: **Sent**, then Delivered on Phone B. | Browser (sent ~0.5 s after reconnect) |
| 8.3 | Airplane mode on, raise an SOS, **close the app**, airplane off, reopen the app. | The SOS still sends (it is kept on the device). | *Phone only* |
| 8.4 | Phone B offline while A raises an SOS, then online. | B gets the push when back online (it is kept for 10 minutes). | *Phone only* |
| 8.5 | On campus Wi-Fi, time 4.3 again. | If it's much slower than on mobile data, use a hotspot for the demo (some networks block FCM ports 5228–5230). | *Phone only* |

## 9. After the test

- [ ] Firebase console → Functions → Logs: `SOS push` entries show `successCount: 1`.
- [ ] Firestore → circles → … → sos: the events show `deliveredTo`, `seenBy`, `ackBy` and `status: ended`.
- [ ] Record the timings from section 4 in the table below.

| Phone B state | Wi-Fi (s) | Mobile data (s) | Hotspot (s) |
| --- | --- | --- | --- |
| Open | | | |
| Background | | | |
| Locked | | | |
| Swiped away | | | |
