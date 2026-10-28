import { Building2, Cross, LoaderCircle, Navigation, Shield } from "lucide-react";
import { directionsLink, formatDistance } from "@/lib/ride/alerts";
import type { NearbySafetyPlace, NearestSafetyPlaces } from "@/lib/ride/places";
import { isNative, openExternal } from "../native";
import { useSafety } from "../state";

function PlaceRow({ place, kind, compact }: { place: NearbySafetyPlace | null; kind: "police" | "hospital"; compact?: boolean }) {
  const { t } = useSafety();
  const Icon = kind === "police" ? Shield : Cross;
  return (
    <div className={`m-place m-place-${kind}`}>
      <span className="m-place-icon"><Icon size={18} /></span>
      <span className="m-place-text">
        <small>{t(kind === "police" ? "places.police" : "places.hospital")}</small>
        <strong>{place?.name ?? t("places.none")}</strong>
        {place && <span>{t("places.away", { distance: formatDistance(place.distanceMetres) })}</span>}
      </span>
      {place && !compact && (
        <button type="button" className="m-place-go" onClick={() => openExternal(directionsLink(place.location, place.name, isNative))} aria-label={`${t("places.directions")}: ${place.name}`}>
          <Navigation size={16} /><span>{t("places.directions")}</span>
        </button>
      )}
    </div>
  );
}

export function NearbyPlacesList({ nearest, compact }: { nearest: NearestSafetyPlaces; compact?: boolean }) {
  return <div className="m-places-list"><PlaceRow place={nearest.police} kind="police" compact={compact} /><PlaceRow place={nearest.hospital} kind="hospital" compact={compact} /></div>;
}

export function NearbyPlacesCard() {
  const { t, places, nearest } = useSafety();
  return (
    <section className="card m-card" aria-labelledby="places-title">
      <header className="m-card-head">
        <h3 id="places-title"><Building2 size={18} />{t("places.title")}</h3>
        {places && <small className="m-source">{t(`places.source.${places.source}`)}</small>}
      </header>
      {places ? <NearbyPlacesList nearest={nearest} /> : <p className="m-loading-line"><LoaderCircle className="spin" size={16} />{t("places.loading")}</p>}
    </section>
  );
}
