import { Check, ChevronDown, MapPinned, Phone, ShieldCheck, Siren, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { audioUnlocked, unlockAudio } from "../audio";
import { useNow } from "../hooks";
import { isNative, openExternal } from "../native";
import { useSafety } from "../state";
import { useLiveSos } from "./LiveSosProvider";
import { SosMap } from "./SosMap";

/**
 * Full-screen alert on the trusted contact's phone when someone in the circle
 * raises an SOS: who, a live map, and Acknowledge / Call / End. "Hide" shrinks
 * it to a banner while the SOS stays active.
 */
export function IncomingSosAlert() {
  const { t, settings, showToast } = useSafety();
  const { incoming, acknowledged, hidden, acknowledge, end, markSeen, setHidden, uid, online } = useLiveSos();
  const now = useNow(incoming.length > 0, 1_000);
  const [soundReady, setSoundReady] = useState(audioUnlocked);
  const sos = incoming.find((item) => !hidden.includes(item.id)) ?? null;
  const banner = !sos ? incoming[0] ?? null : null;

  // "Seen" means the alert is actually on screen, not just received.
  useEffect(() => {
    if (!sos) return;
    const check = () => { if (document.visibilityState === "visible") markSeen(sos); };
    check();
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, [markSeen, sos]);

  if (banner) {
    return (
      <button type="button" className="m-live-banner" onClick={() => setHidden(banner, false)}>
        <Siren size={20} />{t("live.alert.banner", { name: banner.senderName.split(" ")[0] })}
      </button>
    );
  }
  if (!sos) return null;

  const first = sos.senderName.split(" ")[0];
  const acked = acknowledged.includes(sos.id) || Boolean(uid && sos.ackBy[uid]);
  const age = sos.location ? Math.max(0, Math.round((now - sos.location.at) / 1_000)) : null;
  // Demo mode on either phone means no real call is ever placed.
  const call = () => {
    if (settings.demoMode || sos.demo) { showToast(t("live.alert.simulatedCall", { name: first }), "warning"); return; }
    if (!sos.senderPhone) { showToast(t("live.alert.noPhone", { name: first }), "warning"); return; }
    openExternal(`tel:${sos.senderPhone.replace(/[^\d+]/gu, "")}`);
  };
  const openMaps = () => {
    const point = sos.location;
    if (point) openExternal(isNative ? `geo:${point.lat},${point.lng}?q=${point.lat},${point.lng}(${encodeURIComponent(first)})` : `https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=17/${point.lat}/${point.lng}`);
  };

  return (
    <div className="m-sos-overlay m-sos-active m-live-alert" role="alertdialog" aria-modal="true" aria-labelledby="live-sos-title">
      <div className="m-live-alert-head">
        <div className="m-sos-pulse" aria-hidden="true"><Siren size={34} /></div>
        <div>
          <h2 id="live-sos-title">{t("live.alert.title", { name: sos.senderName })}</h2>
          <p>{t("live.alert.text", { name: first })}</p>
        </div>
      </div>
      {(settings.demoMode || sos.demo) && <p className="m-sos-demo">{t("demo.badge")}</p>}
      {!soundReady && !acked && (
        <button type="button" className="m-sos-link" onClick={() => { unlockAudio(); setSoundReady(true); }}><Volume2 size={16} />{t("contact.enableSound")}</button>
      )}
      <SosMap location={sos.location} trail={sos.trail} name={sos.senderName} dark={settings.theme === "dark"} offlineLabel={t("track.mapOffline")} />
      <p className="m-live-age" role="status">
        {!online ? t("live.offline") : age === null ? t("live.alert.noLocation") : t("live.alert.updated", { seconds: age })}
        {sos.location?.accuracy ? ` · ±${Math.round(sos.location.accuracy)} m` : ""}
      </p>
      {acked && <p className="m-sos-sent"><Check size={16} />{t("live.alert.acknowledged", { name: first })}</p>}
      <div className="m-sos-actions">
        {!acked && <button type="button" className="m-sos-white" onClick={() => acknowledge(sos)} data-autofocus><Check size={18} />{t("live.alert.acknowledge")}</button>}
        <button type="button" className={acked ? "m-sos-white" : "m-sos-ghost"} onClick={call}><Phone size={18} />{t("live.alert.call", { name: first })}</button>
        <button type="button" className="m-sos-ghost" onClick={openMaps} disabled={!sos.location}><MapPinned size={18} />{t("live.alert.openMaps")}</button>
        <button type="button" className="m-sos-ghost" onClick={() => end(sos)}><ShieldCheck size={18} />{t("live.alert.end")}</button>
        <button type="button" className="m-sos-link" onClick={() => setHidden(sos, true)}><ChevronDown size={16} />{t("live.alert.hide")}</button>
      </div>
    </div>
  );
}
