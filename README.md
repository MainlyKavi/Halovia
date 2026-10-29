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
| Alerts reaching trusted contacts | **Simulated**: alerts go to the in-app contact view over `BroadcastChannel`/`localStorage` (also works across two browser tabs). The system notification on the same phone stands in for the contact's push |
| SOS calls to police or contacts | **Simulated in demo mode**: buttons show "this would call 112" and dial nothing. With demo mode off, they open the phone dialer (`tel:`) and the user still has to press call |

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
- **Push notifications.** Firebase Cloud Messaging (or APNs on iOS) so trusted contacts get alerts on their own phones, including when the app is closed.
- **Backend and real-time sync.** Replace the `BroadcastChannel` stand-in in `mobile/sync.ts` with a real channel. The existing `worker/` + D1 backend already has share sessions; a small SSE endpoint or Supabase Realtime (free tier) would carry the same `SharedSnapshot`.
- **Background location.** A foreground service so tracking and deviation checks continue with the screen off.
- **SMS fallback.** Send `formatAlertText()` over SMS when there is no data connection, with explicit consent and carrier costs explained.
- **Police and emergency integration.** Work with ERSS-112 (India) or local emergency services on a verified hand-off, instead of only showing the nearest station.
- **Real deviation input.** Use the driver's real position (shared by the ride app) rather than the passenger's phone, and re-route instead of flagging when traffic forces a legitimate detour.

## Author

Created by [MainlyKavi](https://github.com/MainlyKavi).
