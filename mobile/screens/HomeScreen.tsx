import { ChevronRight, ListChecks, UsersRound } from "lucide-react";
import { useMemo } from "react";
import { formatDistance } from "@/lib/ride/alerts";
import { bearingDegrees, destinationPoint } from "@/lib/ride/geo";
import { defaultRecipients, summarizeViewers } from "@/lib/ride/group";
import { brandLabel } from "@/lib/ride/ride-provider";
import { FALLBACK_PLANNED_ROUTE } from "@/lib/ride/route";
import { EmergencyContactsCard } from "../components/EmergencyContacts";
import { LiveMap } from "../components/LiveMap";
import { SosButton } from "../components/SosButton";
import { useSafety } from "../state";

/** Splits a translated template around one placeholder so the value can be styled separately. */
function around(text: string, placeholder: string): [string, string] {
  const [before = "", after = ""] = text.split(placeholder);
  return [before, after];
}

export function HomeScreen() {
  const { t, settings, session, members, navigate, triggerSos, remaining, cab, gps, nearest } = useSafety();
  const { ride, sharing } = session;
  const route = session.route?.points ?? FALLBACK_PLANNED_ROUTE.points;
  // Who can see the journey: the live share, or who a new share would go to.
  const viewerIds = sharing?.recipientIds ?? defaultRecipients(members);
  const viewers = members.filter((member) => viewerIds.includes(member.id));
  const names = summarizeViewers(viewers.map((member) => member.name), { pair: t("home.viewersPair"), more: t("home.viewersMore") });
  // Before sharing, the booked cab is shown a short way off, heading to the pickup.
  const approach = bearingDegrees(route[0], route[Math.min(8, route.length - 1)]);
  const waitingCab = useMemo(() => (ride ? { point: destinationPoint(route[0], (approach + 200) % 360, 450), bearing: (approach + 20) % 360 } : null), [approach, ride, route]);
  // Before the ride starts, the pulsing dot sits at the pickup point (or real GPS when available).
  const user = gps?.point ?? (sharing ? null : ride?.pickup.location ?? null);

  return (
    <div className="m-screen m-home">
      {ride && (
        <button type="button" className="m-connected" onClick={() => navigate(sharing ? "ride" : "booked")}>
          <i aria-hidden="true" />
          <span>{around(t("home.connected"), "{brand}")[0]}<strong>{brandLabel(ride.brand)}</strong>{around(t("home.connected"), "{brand}")[1]}</span>
          <ChevronRight size={17} />
        </button>
      )}

      <LiveMap
        className="m-home-map"
        route={route}
        travelledMetres={sharing ? session.simulation.travelledMetres : 0}
        cab={cab ?? waitingCab}
        user={user}
        places={nearest}
        deviated={session.deviation.deviated}
        dark={settings.theme === "dark"}
        chip={formatDistance(remaining)}
        followCab={Boolean(sharing)}
        labels={{ you: t("track.you"), recenter: t("track.recenter"), offline: t("track.mapOffline") }}
      />

      <SosButton label={t("home.help")} hint={t("home.sosHint")} ariaLabel={t("sos.button")} disabled={session.sos.phase !== "idle"} onTrigger={triggerSos} />

      <button type="button" className="card m-card m-group-card" onClick={() => navigate("group")}>
        <span className="m-group-icon" aria-hidden="true"><UsersRound size={26} /></span>
        <span className="m-group-text">
          <small>{t("home.groupLabel")}</small>
          {names ? <><strong>{names}</strong><span>{around(t("home.canSee"), "{names}").join(" ").trim()}</span></> : <span>{t("home.noViewers")}</span>}
        </span>
        <ChevronRight size={20} />
      </button>

      <EmergencyContactsCard onMore={() => navigate("emergency")} />

      {settings.demoMode && (
        <button type="button" className="m-script-link" onClick={() => navigate("script")}><ListChecks size={18} />{t("home.demoScript")}<ChevronRight size={16} /></button>
      )}
    </div>
  );
}
