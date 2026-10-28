import { CarFront, Eye, Home, Settings as SettingsIcon, UsersRound } from "lucide-react";
import { useEffect, useRef } from "react";
import { playSound, stopSound, unlockAudio } from "./audio";
import { DeviationBanner, SosOverlay, ToastHost } from "./components/Overlays";
import { ShareSheet } from "./components/ShareSheet";
import { vibrate } from "./native";
import { BookedScreen } from "./screens/BookedScreen";
import { ContactScreen } from "./screens/ContactScreen";
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

const tabs: Array<{ screen: Screen; key: "nav.home" | "nav.ride" | "nav.group" | "nav.settings"; icon: typeof Home }> = [
  { screen: "home", key: "nav.home", icon: Home },
  { screen: "ride", key: "nav.ride", icon: CarFront },
  { screen: "group", key: "nav.group", icon: UsersRound },
  { screen: "settings", key: "nav.settings", icon: SettingsIcon },
];

function Shell() {
  const { screen, navigate, t, settings, session } = useSafety();
  useAlertAudio();

  if (role === "rider" && !settings.onboarded) return <main className="m-app"><PermissionScreen /><ToastHost /></main>;

  const content = {
    home: <HomeScreen />, ride: <TrackingScreen />, group: <GroupScreen />, settings: <SettingsScreen />,
    booked: <BookedScreen />, script: <ScriptScreen />, contact: <ContactScreen />,
  }[screen];
  const showTabs = role === "rider" && screen !== "contact";
  const activeTab = screen === "booked" ? "ride" : screen === "script" ? "home" : screen;

  return (
    <main className={`m-app ${showTabs ? "with-tabs" : ""}`}>
      {screen !== "contact" && (
        <header className="m-header">
          <span className="brand-lockup"><span className="logo-mark" aria-hidden="true"><span className="logo-route" /><span className="logo-point" /></span><span className="brand-word">Halovia</span></span>
          <div className="m-header-actions">
            {settings.demoMode && <span className="m-demo-badge">{t("demo.badge")}</span>}
            {settings.demoMode && <button type="button" className="m-contact-toggle" onClick={() => navigate("contact")} aria-label={t("demo.contactView")}><Eye size={17} /><span>{t("demo.contactViewShort")}</span></button>}
          </div>
        </header>
      )}
      {session.sharing && screen !== "contact" && <span className="sr-only" role="status">{t("home.activeRide")}</span>}
      <div className="m-content" key={screen}>{content}</div>
      {showTabs && (
        <nav className="m-tabs" aria-label="Halovia">
          {tabs.map(({ screen: target, key, icon: Icon }) => (
            <button key={target} type="button" className={activeTab === target ? "active" : ""} aria-current={activeTab === target ? "page" : undefined} onClick={() => navigate(target)}>
              <Icon size={21} /><span>{t(key)}</span>{target === "ride" && session.sharing && <i className="m-tab-live" aria-hidden="true" />}
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
