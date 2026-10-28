import { CarFront, ChevronRight, ListChecks, Radio } from "lucide-react";
import { Avatar } from "@/components/ui/Primitives";
import { formatDistance } from "@/lib/ride/alerts";
import { NearbyPlacesCard } from "../components/NearbyPlaces";
import { SosButton } from "../components/SosButton";
import { useSafety } from "../state";

export function HomeScreen() {
  const { t, settings, session, members, navigate, triggerSos, remaining } = useSafety();
  const sharing = session.sharing;
  const ride = session.ride;
  const sharedWith = members.filter((member) => sharing?.recipientIds.includes(member.id));

  return (
    <div className="m-screen m-home">
      <header className="m-hello">
        <h1>{t("home.greeting", { name: settings.userName })}</h1>
        <p>{t("app.tagline")}</p>
      </header>

      <SosButton label={t("sos.label")} hint={t("home.sosHint")} ariaLabel={t("sos.button")} disabled={session.sos.phase !== "idle"} onTrigger={triggerSos} />

      {sharing && ride ? (
        <button type="button" className="card m-card m-ride-live" onClick={() => navigate("ride")}>
          <span className="m-live-dot" aria-hidden="true" />
          <span className="m-ride-live-text">
            <strong>{session.simulation.arrived ? t("track.arrived") : t("home.activeRide")}</strong>
            <small>{ride.vehicle.plate} · {ride.drop.label} · {formatDistance(remaining)}</small>
            <span className="m-chip m-chip-share"><Radio size={13} />{sharedWith.length === 1 ? t("track.sharingWithOne") : t("track.sharingWith", { count: sharedWith.length })}</span>
          </span>
          <ChevronRight size={20} />
        </button>
      ) : (
        <section className="card m-card m-ride-empty">
          <span className="m-ride-empty-icon"><CarFront size={22} /></span>
          <div>
            <h3>{t("home.noRide")}</h3>
            <p>{t("home.noRideText")}</p>
            <button type="button" className="button button-primary" disabled={!ride} onClick={() => navigate("booked")}>{t("home.openRide")}</button>
          </div>
        </section>
      )}

      <button type="button" className="card m-card m-group-peek" onClick={() => navigate("group")}>
        <span>
          <strong>{t("home.groupTitle")}</strong>
          <small>{t("home.groupCount", { count: members.length })}</small>
        </span>
        <span className="m-avatar-stack">{members.slice(0, 4).map((member) => <Avatar key={member.id} initials={member.initials} color={member.color} size="sm" />)}</span>
        <ChevronRight size={18} />
      </button>

      <NearbyPlacesCard />

      {settings.demoMode && (
        <button type="button" className="m-script-link" onClick={() => navigate("script")}><ListChecks size={18} />{t("home.demoScript")}<ChevronRight size={16} /></button>
      )}
    </div>
  );
}
