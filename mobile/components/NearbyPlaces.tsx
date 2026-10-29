import { Building2, Cross, Navigation, Shield } from "lucide-react";
import { directionsLink, formatDistance } from "@/lib/ride/alerts";
import type { NearbySafetyPlace, NearestSafetyPlaces } from "@/lib/ride/places";
import { isNative, openExternal } from "../native";
import { useSafety } from "../state";

function PlaceRow({ place, kind, compact }: { place: NearbySafetyPlace; kind: "police" | "hospital"; compact?: boolean }) {
  const { t } = useSafety();
  const Icon = kind === "police" ? Shield : Cross;
  return (
    <div className={`m-place m-place-${kind}`}>
      <span className="m-place-icon"><Icon size={18} /></span>
      <span className="m-place-text">
        <small>{t(kind === "police" ? "places.police" : "places.hospital")}</small>
        <strong>{place.name}</strong>
        <span>{t("places.away", { distance: formatDistance(place.distanceMetres) })}{!compact && place.address ? ` · ${place.address}` : ""}</span>
      </span>
      <button type="button" className={`m-place-go ${compact ? "m-place-go-icon" : ""}`} onClick={() => openExternal(directionsLink(place.location, place.name, isNative))} aria-label={t("places.navigate", { name: place.name })}>
        <Navigation size={16} />{!compact && <span>{t("places.directions")}</span>}
      </button>
    </div>
  );
}

/** Rows for the alert's police station and hospital. Rows only render for places that exist. */
export function NearbyPlacesList({ nearest, compact }: { nearest: NearestSafetyPlaces; compact?: boolean }) {
  return (
    <div className="m-places-list">
      {nearest.police && <PlaceRow place={nearest.police} kind="police" compact={compact} />}
      {nearest.hospital && <PlaceRow place={nearest.hospital} kind="hospital" compact={compact} />}
    </div>
  );
}

export function NearbyPlacesCard() {
  const { t, nearest } = useSafety();
  return (
    <section className="card m-card" aria-labelledby="places-title">
      <header className="m-card-head"><h3 id="places-title"><Building2 size={18} />{t("places.title")}</h3></header>
      <NearbyPlacesList nearest={nearest} />
    </section>
  );
}
