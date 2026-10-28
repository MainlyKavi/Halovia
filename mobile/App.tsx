import { Eye, Home, MapPinned, Phone, Settings as SettingsIcon } from "lucide-react";
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
import { ScriptScreen } from "./screens/ScriptScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { TrackingScreen } from "./screens/TrackingScreen";
import { SafetyProvider, useSafety, type Screen } from "./state";

// Opening the app with ?view=contact (for example in a second browser tab)
// starts it as a pure trusted-contact screen that only listens for updates.
const role = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("view") === "contact" ? "contact" : "rider";

export function App() {
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { passive: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);
  return <SafetyProvider role={role}><Shell /></SafetyProvider>;
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

function Shell() {
  const { screen, navigate, t, settings, session } = useSafety();
  useAlertAudio();

  if (role === "rider" && !settings.onboarded) return <main className="m-app"><PermissionScreen /><ToastHost /></main>;

  const content = {
    home: <HomeScreen />, emergency: <EmergencyScreen />, ride: <TrackingScreen />, group: <GroupScreen />, settings: <SettingsScreen />,
    booked: <BookedScreen />, script: <ScriptScreen />, contact: <ContactScreen />,
  }[screen];
  const showTabs = role === "rider" && screen !== "contact";
  const activeTab = screen === "booked" ? "ride" : screen === "script" || screen === "group" ? "home" : screen;

  return (
    <main className={`m-app ${showTabs ? "with-tabs" : ""}`}>
      {screen !== "contact" && (
        <header className="m-header">
          <button type="button" className="m-brand" onClick={() => navigate("home")} aria-label={t("nav.home")}><Sparkle /><span>Halovia</span></button>
          <div className="m-header-actions">
            {settings.demoMode && <button type="button" className="m-contact-toggle" onClick={() => navigate("contact")} aria-label={t("demo.contactView")}><Eye size={16} /><span>{t("demo.badge")}</span></button>}
            <button type="button" className="m-gear" onClick={() => navigate("settings")} aria-label={t("nav.settings")}><SettingsIcon size={26} strokeWidth={1.9} /></button>
          </div>
        </header>
      )}
      {session.sharing && screen !== "contact" && <span className="sr-only" role="status">{t("home.activeRide")}</span>}
      <div className="m-content" key={screen}>{content}</div>
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
  const contactSide = screen === "contact";
  const viewerId = settings.contactViewerId ?? snapshot?.members[0]?.id ?? null;
  const sosId = snapshot?.sosActiveAlertId ?? null;
  const contactAlarm = contactSide && sosId !== null && !session.contactAcks.includes(sosId) && Boolean(snapshot?.alerts.find((alert) => alert.id === sosId)?.recipientIds.includes(viewerId ?? ""));
  const riderSiren = !contactSide && session.sos.phase === "active" && !session.sos.silenced;
  const wanted = contactAlarm ? "alarm" : riderSiren ? "siren" : null;

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
