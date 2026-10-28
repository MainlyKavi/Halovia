import { AlertTriangle, BellOff, Check, Eye, Phone, ShieldCheck, X } from "lucide-react";
import { formatDistance } from "@/lib/ride/alerts";
import { useNow } from "../hooks";
import { SOS_COUNTDOWN_MS, useSafety } from "../state";
import { openExternal } from "../native";
import { NearbyPlacesList } from "./NearbyPlaces";

export function SosOverlay() {
  const { session, t, members, settings, cancelSos, stopSos, silenceSiren, showToast, nearest, navigate } = useSafety();
  const sos = session.sos;
  const now = useNow(sos.phase === "countdown");
  if (sos.phase === "idle") return null;

  if (sos.phase === "countdown") {
    const left = Math.max(0, sos.endsAt - now);
    const seconds = Math.ceil(left / 1_000);
    const ring = 2 * Math.PI * 54;
    return (
      <div className="m-sos-overlay m-sos-countdown" role="alertdialog" aria-modal="true" aria-labelledby="sos-countdown-title" aria-describedby="sos-countdown-text">
        <div className="m-countdown-ring" aria-hidden="true">
          <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" className="track" /><circle cx="60" cy="60" r="54" className="fill" style={{ strokeDasharray: ring, strokeDashoffset: ring * (1 - left / SOS_COUNTDOWN_MS) }} /></svg>
          <strong>{seconds}</strong>
        </div>
        <h2 id="sos-countdown-title">{t("sos.countdownTitle", { seconds })}</h2>
        <p id="sos-countdown-text">{t("sos.countdownText")}</p>
        <button type="button" className="m-sos-cancel" onClick={cancelSos} data-autofocus><X size={20} />{t("sos.cancel")}</button>
      </div>
    );
  }

  const alert = session.alerts.find((item) => item.id === sos.alertId);
  const names = members.filter((member) => alert?.recipientIds.includes(member.id)).map((member) => member.name.split(" ")[0]).join(", ");
  const callPolice = () => { if (settings.demoMode) showToast(t("sos.simulatedCall", { number: "112" }), "warning"); else openExternal("tel:112"); };
  return (
    <div className="m-sos-overlay m-sos-active" role="alertdialog" aria-modal="true" aria-labelledby="sos-active-title">
      <div className="m-sos-pulse" aria-hidden="true"><AlertTriangle size={44} /></div>
      <h2 id="sos-active-title">{t("sos.activeTitle")}</h2>
      <p>{t("sos.activeText")}</p>
      {names && <p className="m-sos-sent"><Check size={16} />{t("sos.sentTo", { names })}</p>}
      {settings.demoMode && <p className="m-sos-demo">{t("sos.demoLabel")}</p>}
      <div className="m-sos-places"><NearbyPlacesList nearest={alert?.nearest ?? nearest} compact /></div>
      <div className="m-sos-actions">
        <button type="button" className="m-sos-white" onClick={callPolice}><Phone size={18} />{t("sos.callPolice", { number: "112" })}</button>
        {!sos.silenced && <button type="button" className="m-sos-ghost" onClick={silenceSiren}><BellOff size={18} />{t("sos.silence")}</button>}
        <button type="button" className="m-sos-ghost" onClick={stopSos}><ShieldCheck size={18} />{t("sos.stop")}</button>
        {settings.demoMode && <button type="button" className="m-sos-link" onClick={() => navigate("contact")}><Eye size={16} />{t("demo.contactView")}</button>}
      </div>
    </div>
  );
}

export function DeviationBanner() {
  const { session, t, dismissDeviation, triggerSos, screen } = useSafety();
  const alert = session.alerts.find((item) => item.id === session.riderDeviationAlertId);
  if (!alert || screen === "contact" || session.sos.phase !== "idle") return null;
  return (
    <div className="m-deviation" role="alert">
      <span className="m-deviation-icon"><AlertTriangle size={22} /></span>
      <div>
        <strong>{t("deviation.title")}</strong>
        <p>{t("deviation.text", { distance: formatDistance(Math.max(alert.distanceOffRouteMetres ?? 0, session.deviation.distanceMetres)) })}</p>
        <div className="m-deviation-actions">
          <button type="button" className="button button-secondary button-sm" onClick={dismissDeviation}>{t("deviation.ok")}</button>
          <button type="button" className="button button-danger button-sm" onClick={() => { dismissDeviation(); triggerSos(); }}>{t("deviation.sos")}</button>
        </div>
      </div>
    </div>
  );
}

export function ToastHost() {
  const { toast } = useSafety();
  if (!toast) return null;
  return <div key={toast.id} className={`m-toast ${toast.tone === "warning" ? "m-toast-warning" : ""}`} role="status">{toast.tone === "warning" ? <AlertTriangle size={17} /> : <Check size={17} />}<span>{toast.text}</span></div>;
}
