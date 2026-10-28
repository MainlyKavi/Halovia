import { ArrowLeft, Clock3, IndianRupee, KeyRound, ShieldCheck, Star } from "lucide-react";
import { RIDE_BRANDS } from "@/lib/ride/ride-provider";
import { brandLabel } from "@/lib/ride/ride-provider";
import { DriverPortrait } from "../components/DriverPortrait";
import { useSafety } from "../state";

/** Generic cab-app style confirmation for the MOCK ride. No real ride app is involved. */
export function BookedScreen() {
  const { t, session, navigate, setShareSheetOpen, changeBrand, settings, locale } = useSafety();
  const ride = session.ride;
  if (!ride) return null;
  const sharing = Boolean(session.sharing);
  const number = new Intl.NumberFormat(locale);

  return (
    <div className="m-screen m-booked">
      <div className="m-topbar">
        <button type="button" className="icon-button" onClick={() => navigate("home")} aria-label={t("common.back")}><ArrowLeft size={20} /></button>
        <span className="m-brand-tag">{t("ride.via", { brand: brandLabel(ride.brand) })}</span>
      </div>

      <section className="card m-card m-confirm">
        <p className="m-confirm-kicker"><span className="m-live-dot" aria-hidden="true" />{t("ride.confirmed")}</p>
        <h1>{t("ride.arriving", { minutes: ride.pickupEtaMinutes })}</h1>
        <div className="m-driver">
          <DriverPortrait name={ride.driver.name} photoUrl={ride.driver.photoUrl} />
          <div>
            <small>{t("ride.driver")}</small>
            <strong>{ride.driver.name}</strong>
            <span><Star size={13} />{t("ride.rating", { rating: ride.driver.rating.toFixed(1), trips: number.format(ride.driver.trips) })}</span>
          </div>
          <div className="m-otp"><KeyRound size={14} /><small>{t("ride.otp")}</small><strong>{ride.otp}</strong></div>
        </div>
        <div className="m-vehicle">
          <div><small>{t("ride.vehicle")}</small><strong>{ride.vehicle.colour} {ride.vehicle.model}</strong></div>
          <div className="m-plate" aria-label={`${t("ride.plate")}: ${ride.vehicle.plate}`}>{ride.vehicle.plate}</div>
        </div>
        <ol className="m-stops">
          <li><span className="m-stop-dot pickup" /><div><small>{t("ride.pickup")}</small><strong>{ride.pickup.label}</strong><span>{ride.pickup.address}</span></div></li>
          <li><span className="m-stop-dot drop" /><div><small>{t("ride.drop")}</small><strong>{ride.drop.label}</strong><span>{ride.drop.address}</span></div></li>
        </ol>
        <div className="m-ride-facts">
          <div><Clock3 size={16} /><small>{t("ride.eta")}</small><strong>{t("ride.minutes", { minutes: ride.tripMinutes })}</strong></div>
          <div><IndianRupee size={16} /><small>{t("ride.fare")}</small><strong>{new Intl.NumberFormat(locale, { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(ride.fareInr)}</strong></div>
        </div>
      </section>

      <section className="m-share-cta">
        <button type="button" className="button button-primary button-lg m-block m-share-button" onClick={() => (sharing ? navigate("ride") : setShareSheetOpen(true))}>
          <ShieldCheck size={20} />{sharing ? t("ride.alreadyShared") : t("ride.shareCta")}
        </button>
        <p>{t("ride.shareCtaText")}</p>
      </section>

      {settings.demoMode && (
        <section className="m-provider" aria-labelledby="provider-label">
          <h3 id="provider-label">{t("ride.provider")}</h3>
          <div className="m-segmented" role="radiogroup" aria-labelledby="provider-label">
            {RIDE_BRANDS.map(({ brand, label }) => (
              <button key={brand} type="button" role="radio" aria-checked={ride.brand === brand} disabled={sharing} className={ride.brand === brand ? "on" : ""} onClick={() => changeBrand(brand)}>{label}</button>
            ))}
          </div>
          <p>{t("ride.providerHint")}</p>
        </section>
      )}
      <p className="m-fineprint">{t("ride.simulatedNote")}</p>
    </div>
  );
}
