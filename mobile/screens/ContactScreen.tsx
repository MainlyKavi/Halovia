import { AlertTriangle, ArrowLeft, Check, CheckCircle2, MapPinned, Phone, Radio, Siren, Volume2 } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/Primitives";
import { formatDistance, type SafetyAlert } from "@/lib/ride/alerts";
import { DriverPortrait } from "../components/DriverPortrait";
import { LiveMap } from "../components/LiveMap";
import { NearbyPlacesList } from "../components/NearbyPlaces";
import { audioUnlocked, unlockAudio } from "../audio";
import { isNative, openExternal } from "../native";
import { useSafety } from "../state";

/**
 * DEMO: what a trusted contact would see on their own phone. It renders only
 * from the shared snapshot, never from the rider's private state, so it shows
 * exactly what would be sent over a real push/realtime channel.
 */
export function ContactScreen() {
  const { t, snapshot, settings, updateSettings, navigate, role, session, acknowledgeAlert, showToast, locale } = useSafety();
  const [soundReady, setSoundReady] = useState(audioUnlocked);
  const members = snapshot?.members ?? [];
  const viewer = members.find((member) => member.id === settings.contactViewerId) ?? members[0] ?? null;
  const userFirst = (snapshot?.userName ?? settings.userName).split(" ")[0];
  const included = Boolean(viewer && snapshot?.sharing?.recipientIds.includes(viewer.id));
  const myAlerts = (snapshot?.alerts ?? []).filter((alert) => viewer && alert.recipientIds.includes(viewer.id));
  const activeSos = myAlerts.find((alert) => alert.id === snapshot?.sosActiveAlertId && !session.contactAcks.includes(alert.id)) ?? null;
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", second: "2-digit" });

  const call = (target: string, number: string) => {
    if (settings.demoMode) showToast(t("contact.simulatedCall", { target }), "warning");
    else openExternal(`tel:${number.replace(/[^\d+]/gu, "")}`);
  };
  const openMaps = (alert: SafetyAlert | null) => {
    const point = alert?.location ?? snapshot?.cab?.point;
    if (point) openExternal(isNative ? `geo:${point.lat},${point.lng}?q=${point.lat},${point.lng}(${encodeURIComponent(userFirst)})` : `https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=17/${point.lat}/${point.lng}`);
  };
  const userPhone = "+91 90000 00000";

  return (
    <div className={`m-screen m-contact ${activeSos ? "m-contact-sos" : ""}`}>
      <div className="m-contact-bar">
        {role === "rider" && <button type="button" className="button button-ghost button-sm" onClick={() => navigate("home")}><ArrowLeft size={17} />{t("demo.riderView")}</button>}
        {members.length > 0 && (
          <label className="m-viewer-pick">
            <span>{t("contact.viewAs")}</span>
            <select value={viewer?.id ?? ""} onChange={(event) => updateSettings({ contactViewerId: event.target.value })}>
              {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
          </label>
        )}
      </div>

      {!soundReady && (
        <button type="button" className="m-sound-unlock" onClick={() => { unlockAudio(); setSoundReady(true); }}><Volume2 size={18} />{t("contact.enableSound")}</button>
      )}

      {activeSos && (
        <section className="m-contact-alert" role="alert">
          <header><Siren size={26} /><div><h2>{t("contact.sosTitle", { name: activeSos.userName })}</h2><p>{t("contact.sosText", { name: userFirst })} {time.format(new Date(activeSos.createdAt))}</p></div></header>
          {activeSos.ride && <p className="m-contact-alert-ride"><strong className="m-plate m-plate-sm">{activeSos.ride.plate}</strong> {activeSos.ride.vehicle} · {activeSos.ride.driverName}</p>}
          <NearbyPlacesList nearest={activeSos.nearest} compact />
          <div className="m-contact-actions">
            <button type="button" className="m-sos-white" onClick={() => call(userFirst, userPhone)}><Phone size={17} />{t("contact.callUser", { name: userFirst })}</button>
            <button type="button" className="m-sos-white" onClick={() => call("100", "100")}><Phone size={17} />{t("contact.callPolice")} 100</button>
            <button type="button" className="m-sos-white" onClick={() => call("112", "112")}><Phone size={17} />{t("contact.callPolice")} 112</button>
            <button type="button" className="m-sos-white" onClick={() => openMaps(activeSos)}><MapPinned size={17} />{t("contact.openMaps")}</button>
          </div>
          <button type="button" className="m-sos-ghost m-block" onClick={() => acknowledgeAlert(activeSos.id)}><Check size={17} />{t("contact.ack")}</button>
        </section>
      )}

      {!snapshot?.sharing || !snapshot.ride ? (
        <div className="empty-state m-empty">
          <div className="empty-icon"><Radio size={26} /></div>
          <h3>{t("contact.waiting")}</h3>
          <p>{t("contact.waitingText", { name: userFirst })}</p>
        </div>
      ) : !included ? (
        <div className="empty-state m-empty"><div className="empty-icon"><Radio size={26} /></div><h3>{t("contact.waiting")}</h3><p>{t("contact.notIncluded", { name: userFirst })}</p></div>
      ) : (
        <>
          <header className="m-contact-head">
            <div><h1>{t("contact.rideOf", { name: userFirst })}</h1><p><span className="m-live-dot" />{t("contact.live")} · {t("contact.updated", { time: time.format(new Date(snapshot.updatedAt)) })}</p></div>
          </header>
          <LiveMap
            className="m-contact-map"
            route={snapshot.route}
            travelledMetres={0}
            cab={snapshot.cab}
            user={null}
            places={snapshot.nearest}
            deviated={snapshot.deviated}
            dark={settings.theme === "dark"}
            labels={{ you: userFirst, recenter: t("track.recenter"), offline: t("track.mapOffline") }}
          />
          {snapshot.arrived && <section className="card m-card m-arrived"><CheckCircle2 size={24} /><div><h3>{t("contact.arrived", { name: userFirst })}</h3></div></section>}
          <section className="card m-card m-contact-ride">
            <div className="m-driver">
              <DriverPortrait name={snapshot.ride.driver.name} size={52} />
              <div><small>{t("ride.driver")}</small><strong>{snapshot.ride.driver.name}</strong><span>{snapshot.ride.vehicle.colour} {snapshot.ride.vehicle.model}</span><b className="m-plate m-plate-sm">{snapshot.ride.vehicle.plate}</b></div>
            </div>
            <ol className="m-stops">
              <li><span className="m-stop-dot pickup" /><div><small>{t("ride.pickup")}</small><strong>{snapshot.ride.pickup.label}</strong></div></li>
              <li><span className="m-stop-dot drop" /><div><small>{t("ride.drop")}</small><strong>{snapshot.ride.drop.label}</strong></div></li>
            </ol>
            <div className="m-contact-quick">
              <button type="button" className="button button-secondary button-sm" onClick={() => call(userFirst, userPhone)}><Phone size={16} />{t("contact.callUser", { name: userFirst })}</button>
              <button type="button" className="button button-secondary button-sm" onClick={() => openMaps(null)}><MapPinned size={16} />{t("contact.openMaps")}</button>
            </div>
          </section>
        </>
      )}

      {myAlerts.length > 0 && (
        <section className="card m-card" aria-labelledby="contact-alerts">
          <h3 id="contact-alerts" className="m-card-title">{t("contact.alerts")}</h3>
          <ul className="m-alert-list">
            {myAlerts.map((alert) => (
              <li key={alert.id} className={alert.kind === "sos" ? "sos" : "deviation"}>
                {alert.kind === "sos" ? <Siren size={18} /> : <AlertTriangle size={18} />}
                <div>
                  <strong>{alert.kind === "sos" ? t("contact.sosTitle", { name: alert.userName }) : t("contact.deviationTitle")}</strong>
                  <small>{time.format(new Date(alert.createdAt))}{alert.distanceOffRouteMetres !== undefined ? ` · ${t("track.offRoute", { distance: formatDistance(alert.distanceOffRouteMetres) })}` : ""}</small>
                  {alert.nearest.police && <small>{t("contact.nearestPolice")}: {alert.nearest.police.name} ({formatDistance(alert.nearest.police.distanceMetres)})</small>}
                  {alert.nearest.hospital && <small>{t("contact.nearestHospital")}: {alert.nearest.hospital.name} ({formatDistance(alert.nearest.hospital.distanceMetres)})</small>}
                </div>
                <button type="button" className="icon-button" onClick={() => openMaps(alert)} aria-label={t("contact.openMaps")}><MapPinned size={17} /></button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {viewer && <p className="m-fineprint"><Avatar initials={viewer.initials} color={viewer.color} size="sm" />{t("contact.viewingAs", { name: viewer.name })}</p>}
    </div>
  );
}
