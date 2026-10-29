import { PushNotifications } from "@capacitor/push-notifications";
import { isNative } from "../native";

// FCM registration. The push itself is shown by the native
// HaloviaMessagingService (full-screen alarm), not by this plugin; JS only
// needs the device token, plus the message when the app happens to be open.

export type PushStatus = "unsupported" | "denied" | "registering" | "ready" | "error";

export interface PushHandlers {
  onStatus: (status: PushStatus) => void;
  onToken: (token: string) => void;
  onMessage: (data: Record<string, string>) => void;
}

/** Only call when the build has google-services.json (native Firebase exists). */
export function registerPush({ onStatus, onToken, onMessage }: PushHandlers): () => void {
  if (!isNative) { onStatus("unsupported"); return () => undefined; }
  let stopped = false;
  const handles: Array<Promise<{ remove: () => Promise<void> }>> = [];
  void (async () => {
    try {
      let permission = (await PushNotifications.checkPermissions()).receive;
      if (permission === "prompt" || permission === "prompt-with-rationale") permission = (await PushNotifications.requestPermissions()).receive;
      if (stopped) return;
      if (permission !== "granted") { onStatus("denied"); return; }
      onStatus("registering");
      handles.push(PushNotifications.addListener("registration", ({ value }) => { if (!stopped) { onToken(value); onStatus("ready"); } }));
      handles.push(PushNotifications.addListener("registrationError", () => { if (!stopped) onStatus("error"); }));
      handles.push(PushNotifications.addListener("pushNotificationReceived", (notification) => { if (!stopped) onMessage((notification.data ?? {}) as Record<string, string>); }));
      await PushNotifications.register();
    } catch {
      if (!stopped) onStatus("error");
    }
  })();
  return () => {
    stopped = true;
    handles.forEach((handle) => void handle.then((listener) => listener.remove()).catch(() => undefined));
  };
}
