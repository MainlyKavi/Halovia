import { Capacitor, registerPlugin } from "@capacitor/core";
import type { BackgroundGeolocationPlugin } from "@capacitor-community/background-geolocation";
import { Geolocation, type Position } from "@capacitor/geolocation";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { LocalNotifications } from "@capacitor/local-notifications";
import { StatusBar, Style } from "@capacitor/status-bar";
import type { LatLng } from "@/lib/ride/geo";

// Thin wrappers around the Capacitor plugins. Every call is guarded so a
// missing permission, an unsupported browser, or a plugin error never throws
// into the UI during a live demo.

export const isNative = Capacitor.isNativePlatform();

export type PermissionState = "granted" | "denied" | "prompt" | "unavailable";

function normalize(state: string | undefined): PermissionState {
  if (state === "granted") return "granted";
  if (state === "denied") return "denied";
  if (state === "prompt" || state === "prompt-with-rationale") return "prompt";
  return "unavailable";
}

export async function checkLocationPermission(): Promise<PermissionState> {
  try {
    if (isNative) return normalize((await Geolocation.checkPermissions()).location);
    if (!("geolocation" in navigator)) return "unavailable";
    if (!navigator.permissions?.query) return "prompt";
    return normalize((await navigator.permissions.query({ name: "geolocation" })).state);
  } catch {
    return "unavailable";
  }
}

export async function requestLocationPermission(): Promise<PermissionState> {
  try {
    if (isNative) return normalize((await Geolocation.requestPermissions({ permissions: ["location"] })).location);
    if (!("geolocation" in navigator)) return "unavailable";
    return await new Promise<PermissionState>((resolve) => {
      navigator.geolocation.getCurrentPosition(() => resolve("granted"), (error) => resolve(error.code === error.PERMISSION_DENIED ? "denied" : "granted"), { timeout: 15_000 });
    });
  } catch {
    return "denied";
  }
}

export async function checkNotificationPermission(): Promise<PermissionState> {
  try {
    if (isNative) return normalize((await LocalNotifications.checkPermissions()).display);
    if (typeof Notification === "undefined") return "unavailable";
    return Notification.permission === "default" ? "prompt" : normalize(Notification.permission);
  } catch {
    return "unavailable";
  }
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  try {
    if (isNative) {
      const result = normalize((await LocalNotifications.requestPermissions()).display);
      if (result === "granted") await ensureAlertChannel();
      return result;
    }
    if (typeof Notification === "undefined") return "unavailable";
    return normalize(await Notification.requestPermission());
  } catch {
    return "denied";
  }
}

const ALERT_CHANNEL = "halovia-alerts";

async function ensureAlertChannel(): Promise<void> {
  if (Capacitor.getPlatform() !== "android") return;
  try {
    await LocalNotifications.createChannel({ id: ALERT_CHANNEL, name: "Safety alerts", description: "Route deviation and SOS alerts", importance: 5, visibility: 1, vibration: true });
  } catch { /* Channel creation is best effort. */ }
}

let notificationId = 1;

/** Shows a system notification. In this prototype it stands in for the push a trusted contact's phone would get. */
export async function notify(title: string, body: string): Promise<void> {
  try {
    if (isNative) {
      if ((await LocalNotifications.checkPermissions()).display !== "granted") return;
      await ensureAlertChannel();
      notificationId = (notificationId % 100_000) + 1;
      await LocalNotifications.schedule({ notifications: [{ id: notificationId, title, body, channelId: ALERT_CHANNEL }] });
      return;
    }
    if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState === "hidden") new Notification(title, { body, icon: "./favicon.svg" });
  } catch { /* Notifications are a nice-to-have on top of the in-app alert. */ }
}

export async function vibrate(pattern: "tap" | "warning" | "sos"): Promise<void> {
  try {
    if (isNative) {
      if (pattern === "tap") await Haptics.impact({ style: ImpactStyle.Medium });
      else if (pattern === "warning") { await Haptics.notification({ type: NotificationType.Warning }); await Haptics.vibrate({ duration: 600 }); }
      else await Haptics.vibrate({ duration: 1_000 });
      return;
    }
    // Browsers block vibration until the page has had a tap.
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    navigator.vibrate?.(pattern === "tap" ? 20 : pattern === "warning" ? [250, 120, 250] : [900, 200, 900]);
  } catch { /* Vibration is not available on every device. */ }
}

export interface GpsFix {
  point: LatLng;
  accuracy: number;
  at: number;
}

/** Watches the device GPS. Returns a stop function; errors and denial are reported, never thrown. */
export function watchGps(onFix: (fix: GpsFix) => void, onError: (denied: boolean) => void): () => void {
  let stopped = false;
  const handle = (position: Position | GeolocationPosition) => {
    if (!stopped) onFix({ point: { lat: position.coords.latitude, lng: position.coords.longitude }, accuracy: position.coords.accuracy, at: position.timestamp });
  };
  if (isNative) {
    let id: string | null = null;
    Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 20_000, maximumAge: 5_000 }, (position, error) => {
      if (position) handle(position);
      else if (error) onError(/denied|permission/iu.test(String((error as { message?: string }).message ?? error)));
    }).then((watchId) => { id = watchId; if (stopped) void Geolocation.clearWatch({ id: watchId }); }).catch(() => onError(true));
    return () => { stopped = true; if (id) void Geolocation.clearWatch({ id }).catch(() => undefined); };
  }
  if (!("geolocation" in navigator)) { onError(false); return () => undefined; }
  const id = navigator.geolocation.watchPosition(handle, (error) => onError(error.code === error.PERMISSION_DENIED), { enableHighAccuracy: true, timeout: 20_000, maximumAge: 5_000 });
  return () => { stopped = true; navigator.geolocation.clearWatch(id); };
}

export async function styleStatusBar(theme: "pink" | "light" | "dark", sos: boolean): Promise<void> {
  if (!isNative) return;
  const colors = { pink: "#fff7f8", light: "#f7f6f2", dark: "#17171c" } as const;
  try {
    await StatusBar.setStyle({ style: sos || theme === "dark" ? Style.Dark : Style.Light });
    await StatusBar.setBackgroundColor({ color: sos ? "#c81e3a" : colors[theme] });
  } catch { /* Not supported on every Android version. */ }
}

/** Opens tel:, geo: or https: links. Capacitor hands non-app URLs to Android as an intent. */
export function openExternal(url: string): void {
  if (isNative || url.startsWith("tel:") || url.startsWith("geo:")) window.location.href = url;
  else window.open(url, "_blank", "noopener,noreferrer");
}

/** Native side of the live SOS (android/.../HaloviaNativePlugin.java). */
export interface NativeStatus {
  /** google-services.json was bundled, so FCM push and the native Firebase app exist. */
  firebaseConfigured: boolean;
  firebase?: { apiKey: string; appId: string; projectId: string; senderId: string };
  sdkInt: number;
  notificationsEnabled: boolean;
  canUseFullScreenIntent: boolean;
  ignoringBatteryOptimizations: boolean;
  backgroundLocation: boolean;
}

interface HaloviaNativePlugin {
  status(): Promise<NativeStatus>;
  openBatterySettings(): Promise<void>;
  openFullScreenIntentSettings(): Promise<void>;
  openAppSettings(): Promise<void>;
  /** On: show over the lock screen and turn the screen on. Off: also clears SOS notifications. */
  setAlertMode(options: { on: boolean }): Promise<void>;
  addListener(event: "resumed", listener: () => void): Promise<{ remove: () => Promise<void> }>;
}

const HaloviaNative = registerPlugin<HaloviaNativePlugin>("HaloviaNative");
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");

export async function nativeStatus(): Promise<NativeStatus | null> {
  if (Capacitor.getPlatform() !== "android") return null;
  try { return await HaloviaNative.status(); } catch { return null; }
}

/** Called whenever the app returns to the foreground, e.g. from a settings page or dialog. */
export function onNativeResume(listener: () => void): () => void {
  if (Capacitor.getPlatform() !== "android") return () => undefined;
  const handle = HaloviaNative.addListener("resumed", listener).catch(() => null);
  return () => { void handle.then((value) => value?.remove()); };
}

export type NativeSettingsPage = "battery" | "fullScreen" | "app";

export async function openNativeSettings(page: NativeSettingsPage): Promise<void> {
  try {
    if (page === "battery") await HaloviaNative.openBatterySettings();
    else if (page === "fullScreen") await HaloviaNative.openFullScreenIntentSettings();
    else await HaloviaNative.openAppSettings();
  } catch { /* Settings screens differ between Android skins; nothing to do. */ }
}

export async function setAlertMode(on: boolean): Promise<void> {
  if (Capacitor.getPlatform() !== "android") return;
  try { await HaloviaNative.setAlertMode({ on }); } catch { /* Older plugin build. */ }
}

/**
 * Location for an active SOS. On Android this runs a foreground service
 * (persistent notification) so fixes keep arriving with the screen locked;
 * in a browser it falls back to watchPosition.
 */
export function watchSosLocation(text: { title: string; message: string }, onFix: (fix: GpsFix) => void, onError: (denied: boolean) => void): () => void {
  if (!isNative) return watchGps(onFix, onError);
  let stopped = false;
  let id: string | null = null;
  BackgroundGeolocation.addWatcher(
    { backgroundTitle: text.title, backgroundMessage: text.message, requestPermissions: true, stale: false, distanceFilter: 0 },
    (location, error) => {
      if (stopped) return;
      if (location) onFix({ point: { lat: location.latitude, lng: location.longitude }, accuracy: location.accuracy, at: location.time ?? Date.now() });
      else if (error) onError(error.code === "NOT_AUTHORIZED");
    },
  ).then((watcherId) => { id = watcherId; if (stopped) void BackgroundGeolocation.removeWatcher({ id: watcherId }).catch(() => undefined); })
    .catch(() => onError(false));
  return () => { stopped = true; if (id) void BackgroundGeolocation.removeWatcher({ id }).catch(() => undefined); };
}
