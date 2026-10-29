import { Home, MapPinned, Phone, Settings as SettingsIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { playSound, stopSound, unlockAudio } from "./audio";
import { DeviationBanner, SosOverlay, ToastHost } from "./components/Overlays";
import { ShareSheet } from "./components/ShareSheet";
import { vibrate } from "./native";
import { BookedScreen } from "./screens/BookedScreen";
import { ContactScreen } from "./screens/ContactScreen";
import { EmergencyScreen } from "./screens/EmergencyScreen";
import { GroupScreen } from "./screens/GroupScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { PermissionScreen } from "./screens/PermissionScreen";
import { RapidoDemoScreen } from "./screens/RapidoDemoScreen";
import { ScriptScreen } from "./screens/ScriptScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { TrackingScreen } from "./screens/TrackingScreen";
import { SafetyProvider, useSafety, type Screen } from "./state";
import { IncomingSosAlert } from "./cloud/IncomingSosAlert";
import { LiveSosProvider, useLiveSos } from "./cloud/LiveSosProvider";

// Opening the app with ?view=contact (for example in a second browser tab)
// starts it as a pure trusted-contact screen that only listens for updates.
const role = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("view") === "contact" ? "contact" : "rider";

export function App() {
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { passive: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);
  return <SafetyProvider role={role}><LiveSosProvider><Shell /></LiveSosProvider></SafetyProvider>;
}

const tabs: Array<{ screen: Screen; key: "nav.home" | "nav.emergency" | "nav.live" | "nav.settings"; icon: typeof Home }> = [
  { screen: "home", key: "nav.home", icon: Home },
  { screen: "emergency", key: "nav.emergency", icon: Phone },
  { screen: "ride", key: "nav.live", icon: MapPinned },
  { screen: "settings", key: "nav.settings", icon: SettingsIcon },
];

/** Four-point sparkle used as the Halovia mark in the app header. */
function Sparkle() {
  return (
    <svg className="m-sparkle" viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
      <path d="M16 1.5c.9 7.6 3.9 11.6 14.5 14.5C19.9 18.9 16.9 22.9 16 30.5 15.1 22.9 12.1 18.9 1.5 16 12.1 13.1 15.1 9.1 16 1.5Z" fill="currentColor" />
      <circle cx="26" cy="6" r="1.6" fill="currentColor" opacity=".55" />
    </svg>
  );
}

/**
 * The logo goes Home on tap. A long press (600 ms) toggles presenter tools,
 * which show the demo script link on Home.
 */
function BrandButton() {
  const { navigate, t, settings, updateSettings, showToast } = useSafety();
  const timer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const clear = () => { if (timer.current !== null) window.clearTimeout(timer.current); timer.current = null; };
  const start = () => {
    longPressed.current = false;
    clear();
    timer.current = window.setTimeout(() => {
      longPressed.current = true;
      const devTools = !settings.devTools;
      updateSettings({ devTools });
      void vibrate("tap");
      showToast(t(devTools ? "dev.on" : "dev.off"));
    }, 600);
  };
  return (
    <button
      type="button"
      className="m-brand"
      aria-label={t("nav.home")}
      onPointerDown={start}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onContextMenu={(event) => event.preventDefault()}
      onClick={() => { if (!longPressed.current) navigate("home"); }}
    >
      <Sparkle /><span>Halovia</span>
    </button>
  );
}

function Shell() {
  const { screen, navigate, t, settings, session } = useSafety();
  useAlertAudio();

  if (role === "rider" && !settings.onboarded) return <main className="m-app"><PermissionScreen /><ToastHost /></main>;

  const content = {
    home: <HomeScreen />, emergency: <EmergencyScreen />, ride: <TrackingScreen />, group: <GroupScreen />, settings: <SettingsScreen />,
    booked: <BookedScreen />, script: <ScriptScreen />, contact: <ContactScreen />, rapido: <RapidoDemoScreen />,
  }[screen];
  const fullScreen = screen === "contact" || screen === "rapido";
  const showTabs = role === "rider" && !fullScreen;
  const activeTab = screen === "booked" ? "ride" : screen === "script" || screen === "group" ? "home" : screen;

  return (
    <main className={`m-app ${showTabs ? "with-tabs" : ""}`}>
      {!fullScreen && (
        <header className="m-header">
          <BrandButton />
          {settings.demoMode && <span className="m-demo-pill" role="note">{t("demo.badge")}</span>}
        </header>
      )}
      {session.sharing && screen !== "contact" && <span className="sr-only" role="status">{t("home.activeRide")}</span>}
      <div className="m-content m-screen-enter" key={screen}>{content}</div>
      {showTabs && (
        <nav className="m-tabs" aria-label="Halovia">
          {tabs.map(({ screen: target, key, icon: Icon }) => (
            <button key={target} type="button" className={activeTab === target ? "active" : ""} aria-current={activeTab === target ? "page" : undefined} onClick={() => navigate(target)}>
              <Icon size={24} strokeWidth={activeTab === target ? 2.3 : 1.8} fill={target === "home" && activeTab === target ? "currentColor" : "none"} /><span>{t(key)}</span>{target === "ride" && session.sharing && <i className="m-tab-live" aria-hidden="true" />}
            </button>
          ))}
        </nav>
      )}
      <DeviationBanner />
      <ShareSheet />
      {role === "rider" && screen !== "contact" && <SosOverlay />}
      {role === "rider" && <IncomingSosAlert />}
      <ToastHost />
    </main>
  );
}

/**
 * One owner for sound and vibration so the rider's siren and the contact's
 * alarm never play over each other when switching views on one phone.
 */
function useAlertAudio() {
  const { screen, session, snapshot, settings } = useSafety();
  const { incoming, acknowledged, uid } = useLiveSos();
  // An SOS from another phone in the circle rings until acknowledged.
  const liveAlarm = incoming.some((sos) => !acknowledged.includes(sos.id) && !(uid && sos.ackBy[uid]));
  const contactSide = screen === "contact";
  const viewerId = settings.contactViewerId ?? snapshot?.members[0]?.id ?? null;
  const sosId = snapshot?.sosActiveAlertId ?? null;
  const contactAlarm = contactSide && sosId !== null && !session.contactAcks.includes(sosId) && Boolean(snapshot?.alerts.find((alert) => alert.id === sosId)?.recipientIds.includes(viewerId ?? ""));
  const riderSiren = !contactSide && session.sos.phase === "active" && !session.sos.silenced;
  const wanted = contactAlarm || liveAlarm ? "alarm" : riderSiren ? "siren" : null;

  useEffect(() => {
    if (!wanted) { stopSound(); return; }
    playSound(wanted);
    void vibrate("sos");
    const timer = window.setInterval(() => void vibrate("sos"), 1_700);
    return () => { window.clearInterval(timer); stopSound(); };
  }, [wanted]);

  // New deviation alerts chime once on whichever side is showing.
  const latestDeviation = (contactSide ? snapshot?.alerts : session.alerts)?.find((alert) => alert.kind === "deviation" && (!contactSide || alert.recipientIds.includes(viewerId ?? "")))?.id ?? null;
  const heard = useRef<string | null>(latestDeviation);
  useEffect(() => {
    if (!latestDeviation || latestDeviation === heard.current) return;
    heard.current = latestDeviation;
    if (!wanted) playSound("chime");
    if (contactSide) void vibrate("warning");
  }, [contactSide, latestDeviation, wanted]);
}
