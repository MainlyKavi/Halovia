import { CarFront, CheckCircle2, CornerUpRight, Radio, Route } from "lucide-react";
import { Avatar } from "@/components/ui/Primitives";
import { formatDistance } from "@/lib/ride/alerts";
import { LiveMap } from "../components/LiveMap";
import { NearbyPlacesCard } from "../components/NearbyPlaces";
import { useNow } from "../hooks";
import { useSafety } from "../state";

export function TrackingScreen() {
  const { t, session, cab, gps, nearest, settings, members, remaining, etaMinutes, simulateWrongTurn, endRide, navigate, locale } = useSafety();
  const { ride, sharing, route } = session;
  const now = useNow(true, 15_000);

  if (!ride || !sharing || !route) {
    return (
      <div className="m-screen">
        <div className="empty-state m-empty">
          <div className="empty-icon"><CarFront size={26} /></div>
          <h3>{t("track.noRide")}</h3>
          <p>{t("track.noRideText")}</p>
          {ride && <button type="button" className="button button-primary" onClick={() => navigate("booked")}>{t("home.openRide")}</button>}
        </div>
      </div>
    );
  }

  const sharedWith = members.filter((member) => sharing.recipientIds.includes(member.id));
  const arrived = session.simulation.arrived;
  const offRoute = session.deviation.distanceMetres > settings.deviationMetres;
  const eta = new Date(now + etaMinutes * 60_000);

  return (
    <div className="m-screen m-track">
      <LiveMap
        className="m-track-map"
        route={route.points}
        travelledMetres={session.simulation.detour ? session.simulation.detour.rejoinAtMetres : session.simulation.travelledMetres}
        cab={cab}
        user={gps?.point ?? null}
        places={nearest}
        deviated={session.deviation.deviated}
        dark={settings.theme === "dark"}
        labels={{ you: t("track.you"), recenter: t("track.recenter"), offline: t("track.mapOffline") }}
      />

      <div className="m-track-chips">
        <span className="m-chip m-chip-share"><Radio size={13} />{sharedWith.length === 1 ? t("track.sharingWithOne") : t("track.sharingWith", { count: sharedWith.length })}</span>
        <span className={`m-chip ${offRoute ? "m-chip-warn" : "m-chip-ok"}`}><Route size={13} />{offRoute ? t("track.offRoute", { distance: formatDistance(session.deviation.distanceMetres) }) : t("track.onRoute")}</span>
      </div>

      {arrived ? (
        <section className="card m-card m-arrived">
          <CheckCircle2 size={26} />
          <div><h3>{t("track.arrived")}</h3><p>{t("track.arrivedText", { place: ride.drop.label })}</p></div>
        </section>
      ) : (
        <section className="card m-card m-track-stats">
          <div><small>{t("track.eta")}</small><strong>{new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(eta)}</strong><span>{t("ride.minutes", { minutes: etaMinutes })}</span></div>
          <div><small>{t("track.remaining")}</small><strong>{formatDistance(remaining)}</strong><span>{ride.drop.label}</span></div>
        </section>
      )}

      <section className="card m-card m-track-ride">
        <div><strong>{ride.vehicle.colour} {ride.vehicle.model}</strong><small>{ride.driver.name}</small><span className="m-plate m-plate-sm">{ride.vehicle.plate}</span></div>
        <span className="m-avatar-stack">{sharedWith.slice(0, 4).map((member) => <Avatar key={member.id} initials={member.initials} color={member.color} size="sm" />)}</span>
      </section>

      {settings.demoMode && !arrived && (
        <section className="m-demo-controls" aria-label={t("demo.badge")}>
          <button type="button" className="button button-secondary m-block" disabled={Boolean(session.simulation.detour)} onClick={simulateWrongTurn}>
            <CornerUpRight size={18} />{session.simulation.detour ? t("track.rejoining") : t("track.wrongTurn")}
          </button>
          <small>{t("track.simulated")} · {route.source === "osrm" ? t("track.routeLive") : t("track.routeOffline")}</small>
        </section>
      )}

      <NearbyPlacesCard />

      <button type="button" className="button button-ghost m-block" onClick={() => { endRide(); navigate("home"); }}>{t("track.endRide")}</button>
    </div>
  );
}
