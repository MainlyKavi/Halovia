import { ChevronRight, ListChecks, Phone } from "lucide-react";
import { useMemo } from "react";
import { Avatar } from "@/components/ui/Primitives";
import { formatDistance } from "@/lib/ride/alerts";
import { bearingDegrees, destinationPoint } from "@/lib/ride/geo";
import { defaultRecipients, summarizeViewers } from "@/lib/ride/group";
import { brandLabel } from "@/lib/ride/ride-provider";
import { FALLBACK_PLANNED_ROUTE } from "@/lib/ride/route";
import { LiveMap } from "../components/LiveMap";
import { SosButton } from "../components/SosButton";
import { useSafety } from "../state";

/**
 * Home, in priority order: HELP, then the journey (status and map), then who
 * can view it. Helplines live on the Emergency tab; presenter tools are
 * hidden unless switched on by long-pressing the logo.
 */
export function HomeScreen() {
  const { t, settings, session, members, navigate, triggerSos, remaining, cab, gps, nearest } = useSafety();
  const { ride, sharing } = session;
  const route = session.route?.points ?? FALLBACK_PLANNED_ROUTE.points;
  const viewerIds = sharing?.recipientIds ?? defaultRecipients(members);
  const viewers = members.filter((member) => viewerIds.includes(member.id));
  const names = summarizeViewers(viewers.map((member) => member.name), { pair: t("home.viewersPair"), more: t("home.viewersMore") });
  // Before sharing, the booked cab is shown a short way off, heading to the pickup.
  const approach = bearingDegrees(route[0], route[Math.min(8, route.length - 1)]);
  const waitingCab = useMemo(() => (ride ? { point: destinationPoint(route[0], (approach + 200) % 360, 450), bearing: (approach + 20) % 360 } : null), [approach, ride, route]);
  const user = gps?.point ?? (sharing ? null : ride?.pickup.location ?? null);
  const status = sharing ? t("home.rideLive") : ride ? t("home.rideBooked", { brand: brandLabel(ride.brand) }) : "";

  return (
    <div className="m-screen m-home">
      <SosButton label={t("home.help")} hint={t("home.sosHint")} ariaLabel={t("sos.button")} disabled={session.sos.phase !== "idle"} onTrigger={triggerSos} />

      {ride && (
        <section className="m-journey" aria-label={status}>
          <button type="button" className="m-journey-head" onClick={() => navigate(sharing ? "ride" : "booked")}>
            <i className={sharing ? "live" : ""} aria-hidden="true" />
            <span className="m-journey-text">
              <strong>{status}</strong>
              <small>{t("home.route", { from: ride.pickup.label, to: ride.drop.label })}</small>
            </span>
            <span className="m-journey-distance">{formatDistance(remaining)}</span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
          <LiveMap
            className="m-home-map"
            route={route}
            travelledMetres={sharing ? session.simulation.travelledMetres : 0}
            cab={cab ?? waitingCab}
            user={user}
            places={nearest}
            deviated={session.deviation.deviated}
            dark={settings.theme === "dark"}
            followCab={Boolean(sharing)}
            labels={{ you: t("track.you"), recenter: t("track.recenter"), offline: t("track.mapOffline") }}
          />
        </section>
      )}

      <button type="button" className="m-viewers" onClick={() => navigate("group")}>
        <span className="m-avatar-stack" aria-hidden="true">{viewers.slice(0, 3).map((member) => <Avatar key={member.id} initials={member.initials} color={member.color} size="sm" />)}</span>
        <span className="m-viewers-text">{names ? t("home.canSee", { names }) : t("home.noViewers")}</span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>

      <div className="m-home-links">
        <button type="button" className="m-text-link" onClick={() => navigate("emergency")}><Phone size={16} />{t("home.emergencyNumbers")}</button>
        {settings.devTools && <button type="button" className="m-text-link" onClick={() => navigate("script")}><ListChecks size={16} />{t("home.demoScript")}</button>}
      </div>
    </div>
  );
}
