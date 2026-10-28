import { EmergencyContactsCard } from "../components/EmergencyContacts";
import { NearbyPlacesCard } from "../components/NearbyPlaces";
import { SosButton } from "../components/SosButton";
import { useSafety } from "../state";

export function EmergencyScreen() {
  const { t, session, settings, triggerSos } = useSafety();
  return (
    <div className="m-screen m-home">
      <header className="m-page-head"><div><h1>{t("emergency.title")}</h1><p>{t("emergency.subtitle")}</p></div></header>
      <SosButton label={t("home.help")} hint={t("home.sosHint")} ariaLabel={t("sos.button")} disabled={session.sos.phase !== "idle"} onTrigger={triggerSos} />
      <EmergencyContactsCard />
      <NearbyPlacesCard />
      {settings.demoMode && <p className="m-fineprint">{t("sos.demoLabel")}</p>}
    </div>
  );
}
