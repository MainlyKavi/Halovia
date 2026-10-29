# Halovia

**Protection that travels with you.**

Halovia is a women's safety prototype for cab journeys. This repository holds two apps that share one `lib/`:

| App | Folder | What it is |
| --- | --- | --- |
| **Android ride-safety prototype** | `mobile/`, `android/` | Installable Capacitor APK for live demos: trusted group, mock ride booking, "Share with Halovia", live tracking, route-deviation alerts, SOS, nearby police and hospitals, and a contact view. Runs fully on the phone with no backend. |
| Web app | `app/`, `components/`, `worker/` | The original Next.js (vinext) PWA with journey setup, check-ins and a Cloudflare Worker backend. Unchanged by the Android work. |

> Halovia is a prototype. It does not contact emergency services, does not send real SMS or push messages, and must not be relied on in a real emergency.

## What is real and what is simulated (Android prototype)

| Feature | Status |
| --- | --- |
| Trusted group (add, edit, delete, per-ride selection) | **Real**, stored on the device (`localStorage`) |
| Route between pickup and drop | **Real** OSRM route from `routing.openstreetmap.de` (Echelon Institute of Technology → Town Park, Faridabad, 15.3 km); a baked-in copy is used offline |
| Map tiles | **Real** OpenStreetMap data via OpenFreeMap (no API key); falls back to a plain background offline |
| Nearest police station and hospital | **Fixed demo data** for the Echelon area (Police Station Bhupani, Sarvodaya Hospital Sector 8), always shown, with tap-to-navigate. See *Demo location data* below |
| Your GPS dot | **Real** device location (Capacitor Geolocation) when permission is granted |
| Deviation detection | **Real** point-to-polyline math (`lib/ride/deviation.ts`, unit tested); in demo mode it watches the simulated cab |
| Vibration, system notifications, status bar colour | **Real** Capacitor Haptics, Local Notifications and Status Bar |
| Siren and alert sound | **Real**, generated with the Web Audio API (turn the media volume up) |
| Ride booking (driver, plate, fare) | **Simulated**: `MockRideProvider`, plus a generic, unbranded ride-app screen at Settings → Rapido (demo). Halovia has no access to Rapido, Ola or Uber. Brand names are text labels only |
| Cab movement | **Simulated**: the cab drives along the real route at a demo speed; "Simulate wrong turn" sends it off route |
| SOS to a paired phone (live SOS) | **Real**: Firebase (anonymous Auth, Firestore, Cloud Functions, FCM). The other phone in the circle gets a full-screen alarm, even locked, and follows the sender's live location. Needs the one-time Firebase setup below |
| Route deviation alerts to trusted contacts | **Simulated**: they go to the in-app contact view over `BroadcastChannel`/`localStorage` (also works across two browser tabs). The system notification on the same phone stands in for the contact's push |
| SOS calls to police, helplines or contacts | **Simulated in demo mode**: every call button (SOS screen, Emergency tiles, the contact's Call button) shows "this would call …" and dials nothing. With demo mode off, they open the phone dialer (`tel:`) and the user still has to press call. Nothing ever sends SMS |

Simulated code is marked in comments (`DEMO ONLY`, `DEMO STAND-IN FOR A BACKEND`, `MockRideProvider`), and the Settings screen shows "SOS simulated in demo mode".

## How it is built

The web app is server-rendered (vinext RSC, auth headers, a Worker backend), so a static export would have meant ripping out its auth and backend. Instead, `vite.mobile.config.ts` builds a separate single-page app from `mobile/` into `dist-mobile/`. That app reuses `lib/`, the theme tokens and primitives from `app/globals.css` and `components/ui`, and `maplibre-gl`. Capacitor 7 then wraps `dist-mobile/` into the Android project in `android/`.

```
lib/ride/            Domain logic with unit tests (no React)
  geo.ts             Haversine, point-to-polyline distance, walking a polyline
  deviation.ts       Off-route detector (threshold + grace period)
  simulation.ts      DEMO ONLY simulated cab and wrong turn
  ride-provider.ts   RideProvider interface + MockRideProvider (Rapido/Ola/Uber labels)
  route.ts           OSRM route fetch with offline fallback
  places.ts          Fixed police/hospital data (primary), optional Overpass lookup
  alerts.ts          SOS and deviation alert builders, SMS-style text
  group.ts           Trusted group helpers
  strings.ts         EN / HI / ES strings for the mobile app
mobile/              React UI, Capacitor plugin wrappers, siren, sync bus
android/             Capacitor Android project (debug APK)
```

## Demo location data

| Place | Coordinates | Source |
| --- | --- | --- |
| Start: Echelon Institute of Technology, Kabulpur, Faridabad 121101 | 28.3872703, 77.4440745 | OpenStreetMap node 4211294504 (Nominatim reverse geocode: Chirsi, Faridabad 121101) |
| Drop: Town Park, Sector 12, Faridabad | 28.4399036, 77.3165280 | OpenStreetMap way 761709949 (Nominatim) |
| Police Station Bhupani, Sector 89 | 28.4210247, 77.3667617 | **Approximate.** OSM has no point for this station, so this is the Sector 89, Faridabad centroid from Nominatim |
| Sarvodaya Hospital, YMCA Road, Sector 8 | 28.4222263, 77.3167697 | OpenStreetMap node 6895526377 (via Overpass) |

The app shows the distances from the brief: 8.5 km to the police station and 15.6 km to the hospital. Measured from the Echelon start point:

- Police (Sector 89 point): 8.4 km straight line, 9.2 km by road (OSRM). Close to the brief.
- Sarvodaya Hospital, Sector 8: 13.0 km straight line, 14.0 km by road (OSRM). The brief's 15.6 km is about 1.6 km more than the road distance.

## Run in a browser (fastest way to try it)

Requires Node 22.

```bash
npm install
npm run mobile:dev
```

To test the offline fallbacks, open http://localhost:5174/?simulateOffline=1 (development builds only): every request from the page fails, so the map uses its plain style and the baked route.

Open http://localhost:5174 with your browser's device toolbar set to a phone size. To see the contact side live in a second tab, open http://localhost:5174/?view=contact.

## Build the Android APK

One-time setup:

1. Install JDK 21 (for example Temurin 21) and set `JAVA_HOME` to it.
2. Install the Android SDK (Android Studio, or the command-line tools) with `platform-tools`, `platforms;android-35` and `build-tools;35.0.0`.
3. Create `android/local.properties` pointing at the SDK, for example:
   ```properties
   sdk.dir=C:/Users/<you>/AppData/Local/Android/Sdk
   ```

Build (Windows):

```bash
npm run android:sync
cd android && gradlew.bat assembleDebug
```

On macOS or Linux, use `./gradlew assembleDebug`. The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`.

### Install on your phone

1. On the phone: Settings → About phone → tap **Build number** 7 times, then Settings → Developer options → enable **USB debugging**.
2. Connect it over USB and accept the "Allow USB debugging" prompt.
3. Install:
   ```bash
   adb devices
   adb install -r android/app/build/outputs/apk/debug/app-debug.apk
   ```
   (`adb` is in `<sdk>/platform-tools`.) You can also copy the APK to the phone and open it, after allowing installs from that source.

### Run in an emulator

The emulator needs hardware virtualization (Intel VT-x / AMD-V enabled in BIOS, plus Windows Hypervisor Platform or the Android Emulator hypervisor driver).

```bash
sdkmanager "system-images;android-35;google_apis;x86_64" "emulator"
avdmanager create avd -n halovia_demo -k "system-images;android-35;google_apis;x86_64" -d pixel_7
emulator -avd halovia_demo
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Or run `npm run android:run`, which syncs and launches on a connected device or emulator.

## Demo

See [DEMO_SCRIPT.md](DEMO_SCRIPT.md) for a 3-minute walkthrough. In the app, the **Demo script** screen (Home → "Open demo script") has a button for each step.

## Demo setup and run-through

Live SOS between two physical Android phones: hold HELP on Phone A and Phone B gets an alarm within seconds, even when it is locked, and follows A's live location. Do the setup once, the day before; then run the 2-minute script. The full two-phone test list is in [docs/LIVE_SOS_TEST_CHECKLIST.md](docs/LIVE_SOS_TEST_CHECKLIST.md).

### How it works

```
Phone A (HELP held)                       Firebase                                  Phone B (locked)
 SOS written to Firestore ───────────▶ circles/{id}/sos/{sosId} ──trigger──▶ onSosCreated ──FCM high-priority──▶ HaloviaMessagingService
 (queued offline, retried)                     ▲      ▲                                                      full-screen alarm + receipt
 location every ~4 s ─────────────────────────┘      └──── Delivered / Seen / Acknowledged / End ◀───────── app opens: live map
```

- **Pairing:** Phone A creates a circle and shows a 6-character invite code; Phone B types it in. Anonymous sign-in, no accounts. Each phone is in one circle; an SOS goes to everyone else in it (so it works both ways).
- **Security:** Firestore rules (`firebase/firestore.rules`) let only circle members read an SOS; a recipient can only write their own Delivered/Seen/Acknowledged mark. FCM tokens are private to each phone. The rules are covered by emulator tests.
- **Secrets:** `android/app/google-services.json`, `.env.local` and `firebase/.firebaserc` are git-ignored. Without `google-services.json` the app works exactly as before and says live SOS is not set up.

### One-time setup (about 30 minutes)

You need: a Google account, a payment card for the Blaze plan (Cloud Functions are not available on the free Spark plan; a demo stays inside the free quota, so expected cost is ₹0), Node 22, JDK 21 and the Android SDK (see *Build the Android APK*).

1. **Create the project.** Open https://console.firebase.google.com → **Create a project** → name it, for example, `halovia-demo` → turn Google Analytics off → **Create project**.
2. **Switch to Blaze.** Bottom-left **Spark plan → Upgrade** → **Blaze** → add the card. Then set a budget alert: Google Cloud console → Billing → Budgets & alerts → create a ₹100 budget with email alerts.
3. **Add the Android app.** Project overview → **Add app** → Android icon. Package name: `app.halovia.prototype` (exactly). Nickname: Halovia. Leave SHA-1 empty. **Register app**.
4. **Download `google-services.json`** on the next screen and save it as `android/app/google-services.json`. Skip the "Add Firebase SDK" and "Next steps" screens (already done in this repo). Never commit this file; git already ignores it.
5. **Enable anonymous sign-in.** Build → **Authentication** → **Get started** → **Sign-in method** → **Anonymous** → Enable → **Save**.
6. **Create Firestore.** Build → **Firestore Database** → **Create database** → location **asia-south1 (Mumbai)** → **Start in production mode** → **Create**. If you choose another location, change `REGION` in `firebase/functions/src/index.ts` to match before step 7.
7. **Deploy the rules and the push functions** from this repo:
   ```bash
   cd firebase
   npm ci
   npx firebase login
   npx firebase use --add          # pick your project, alias "default"
   npm run deploy                  # Firestore rules + 3 Cloud Functions
   ```
   The first deploy enables Cloud Functions, Cloud Build, Artifact Registry, Eventarc and Cloud Run for you (a few minutes). If it asks about an Artifact Registry cleanup policy, accept the default. Check: Console → Functions lists `onSosCreated`, `onSosEnded`, `ackSosDelivery` in asia-south1, and Firestore → **Rules** shows the Halovia rules.
8. **Check FCM.** Project settings (gear) → **Cloud Messaging** → "Firebase Cloud Messaging API (V1)" says **Enabled**. (No server key is needed; the old legacy API is not used.)
9. **Build the APK** (with `google-services.json` in place):
   ```bash
   npm ci
   npm run android:sync
   cd android && ./gradlew assembleDebug     # Windows: gradlew.bat assembleDebug
   ```
10. **Install on both phones.** Uninstall any older Halovia first (an APK built on another computer has a different signing key and will fail with "App not installed"). Then `adb install -r android/app/build/outputs/apk/debug/app-debug.apk` on each phone, or copy the APK over and open it.
11. **Set up each phone.**
    - Open Halovia → **Allow and continue** → allow location and notifications.
    - Settings → set **Your name** (for example Shreya on Phone A, Kavi on Phone B).
    - Settings → Permissions → **Make sure SOS alarms get through** → press **Open settings** on every row that is not "Allowed":
      - **Battery:** choose Unrestricted.
      - **Full-screen alerts** (Android 14+): turn it on.
      - **Location:** Permissions → Location → **Allow all the time**.
    - Xiaomi, Oppo, Vivo, Realme and OnePlus: also turn on **Autostart** for Halovia, and lock Halovia in the recent-apps screen.
12. **Pair.** Phone A: Home → the "can view this journey" row → Trusted group → **Create invite code**. Phone B: same screen → **Join with a code** → type it. Both phones now list both names with **Alerts on**. If a phone says Alerts off, check its notification permission and internet, then reopen the app.
13. **Rehearse once** with Phone B locked (script below). On some phones the first push after install is slow; the second is not.

For browser-only testing against the local emulators, copy the Firebase variables from `.env.example` into `.env.local` and run `cd firebase && npx firebase emulators:start --only auth,firestore,functions --project demo-halovia` next to `npm run mobile:dev`. Open two different origins (http://127.0.0.1:5174 and http://phone-b.localhost:5174) to get two separate users.

### 2-minute script for the professor

Before you start: both phones charged, on **mobile data or a phone hotspot** (campus Wi-Fi often blocks FCM's ports 5228–5230), volume up, DEMO MODE label visible in the header. Optional: on Phone A, share the booked ride first (Home → ride card → **Share with Halovia** → share), so the SOS location follows the simulated cab and the marker on Phone B moves even indoors.

| Time | Do | Say / show |
| --- | --- | --- |
| 0:00 | Show both phones on Trusted group | "Shreya's phone and Kavi's phone are paired with an invite code. Both show Alerts on." |
| 0:15 | Lock Phone B, put it face up | "Kavi isn't using his phone. It's locked." |
| 0:20 | Phone A: hold **HELP** for 2 s | "Hold or double-tap, so it can't fire by accident." The 5-second countdown appears: "She can still cancel." |
| 0:30 | Let it reach zero | Phone A: **SOS active → Sent**. Phone B lights up with a full-screen alarm. Phone A: **Delivered to Kavi**. |
| 0:45 | Pick up Phone B, open the alert | Map with Shreya's live position, "Updated 3s ago". Phone A: **Seen by Kavi**. |
| 1:00 | Walk a few steps with Phone A (or let the simulated cab move) | The red marker moves on Phone B every few seconds. |
| 1:15 | Phone B: **Acknowledge** | Alarm stops. Phone A: **Kavi acknowledged**. |
| 1:25 | Phone B: **Call Shreya** | "Demo mode: this would call Shreya. No call was made." Same for 112 on the Emergency tab: nothing real is ever dialled in demo mode. |
| 1:40 | Phone B: **End SOS** | Phone A's SOS screen closes: "Kavi ended your SOS". Either phone can end it. |
| 1:50 | (If time) Phone A airplane mode → HELP → "No network. SOS saved…" → airplane off | It sends by itself within seconds. |

### If something fails during the demo

- **No alarm on locked Phone B after ~10 s:** unlock B and open Halovia. The alert appears straight from Firestore within about a second, even when push is slow. Keep going with the script.
- **Network is bad:** switch both phones to a hotspot from a third phone or your laptop. Phone A queues the SOS and shows "No network. SOS saved…", then sends it when the hotspot connects.
- **Push is broken on the day:** keep Halovia open on Phone B's screen (screen timeout set to 10 minutes). The in-app alert, map and status all work without push.
- **Firebase is unreachable:** the original single-phone demo still works with no backend: SOS → "Demo: switch to contact view" (see DEMO_SCRIPT.md).
- **Backup:** record the whole run-through once with both phones' screen recorders (Quick Settings → Screen record, with audio) during the rehearsal and keep the videos on your laptop.

## Checks

```bash
npm run lint
npm run typecheck
npm test
```

## Web app (original)

```bash
npm install
npm run dev
```

The web app uses a Cloudflare Worker backend with D1/R2 (`worker/`, `db/`, `drizzle/`) and expects an authenticated user. See `.env.example` for the local development identity.

## Future work

- **Real ride-app partnerships.** Implement `RideProvider` against Rapido, Ola or Uber partner APIs or deep-link callbacks, so ride details arrive without retyping. This needs their permission and API access.
- **Ride sharing over the backend.** SOS now goes through Firebase; ride sharing and deviation alerts still use the `BroadcastChannel` stand-in in `mobile/sync.ts`. Move them to the same circle in Firestore.
- **Background ride tracking.** SOS location already runs in a foreground service; ride tracking and deviation checks do not yet.
- **QR pairing.** Show the invite code as a QR code and scan it with the camera instead of typing it.
- **SMS fallback.** Send `formatAlertText()` over SMS when there is no data connection, with explicit consent and carrier costs explained.
- **Police and emergency integration.** Work with ERSS-112 (India) or local emergency services on a verified hand-off, instead of only showing the nearest station.
- **Real deviation input.** Use the driver's real position (shared by the ride app) rather than the passenger's phone, and re-route instead of flagging when traffic forces a legitimate detour.

## Author

Created by [MainlyKavi](https://github.com/MainlyKavi).
