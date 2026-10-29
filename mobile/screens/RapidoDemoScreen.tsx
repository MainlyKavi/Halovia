import { ArrowLeft, KeyRound, ShieldCheck, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { PICKUP_APPROACH_ROUTE } from "@/lib/ride/fallback-route";
import { pointAlongPolyline, polylineLengthMetres } from "@/lib/ride/geo";
import { defaultRecipients } from "@/lib/ride/group";
import { DriverPortrait } from "../components/DriverPortrait";
import { LiveMap } from "../components/LiveMap";
import { SPEEDS, useSafety } from "../state";

const APPROACH_LENGTH = polylineLengthMetres(PICKUP_APPROACH_ROUTE);

/**
 * DEMO ONLY: a generic ride-hailing booking screen, standing in for the cab
 * app the rider booked with. Deliberately unbranded (no logo, colours or
 * wordmark of any real company). Its button hands the ride to Halovia.
 */
export function RapidoDemoScreen() {
  const { t, session, members, settings, startSharing, navigate, locale } = useSafety();
  const ride = session.ride;
  const [travelled, setTravelled] = useState(0);
  const [busy, setBusy] = useState(false);

  // The cab drives toward the pickup at city speed, then waits there.
  useEffect(() => {
    const timer = window.setInterval(() => setTravelled((current) => Math.min(APPROACH_LENGTH, current + SPEEDS.realistic * 0.5)), 500);
    return () => window.clearInterval(timer);
  }, []);

  if (!ride) return null;
  const along = pointAlongPolyline(PICKUP_APPROACH_ROUTE, travelled);
  const minutes = Math.max(1, Math.ceil((APPROACH_LENGTH - travelled) / SPEEDS.realistic / 60));
  const sharing = Boolean(session.sharing);
  const money = new Intl.NumberFormat(locale, { style: "currency", currency: "INR", maximumFractionDigits: 0 });

  const share = async () => {
    if (sharing) { navigate("home"); return; }
    setBusy(true);
    await startSharing(defaultRecipients(members));
    setBusy(false);
    navigate("home");
  };

  return (
    <div className="m-screen m-ridehail">
      <div className="m-ridehail-bar">
        <button type="button" className="m-ridehail-back" onClick={() => window.history.back()} aria-label={t("rapido.back")}><ArrowLeft size={22} /></button>
        <span className="m-ridehail-badge">{t("rapido.badge")}</span>
      </div>

      <LiveMap
        className="m-ridehail-map"
        route={PICKUP_APPROACH_ROUTE}
        travelledMetres={travelled}
        cab={{ point: along.point, bearing: along.bearing }}
        user={ride.pickup.location}
        places={{ police: null, hospital: null }}
        deviated={false}
        dark={settings.theme === "dark"}
        tinted={false}
        followCab={false}
        labels={{ you: t("track.you"), recenter: t("track.recenter"), offline: t("track.mapOffline") }}
      />

      <section className="m-ridehail-card">
        <p className="m-ridehail-kicker">{t("rapido.booked")} · {t("rapido.onTheWay")}</p>
        <h1>{t("rapido.arriving", { minutes })}</h1>

        <div className="m-ridehail-driver">
          <DriverPortrait name={ride.driver.name} size={56} />
          <div>
            <strong>{ride.driver.name}</strong>
            <span><Star size={13} fill="currentColor" />{ride.driver.rating.toFixed(1)}</span>
          </div>
          <div className="m-ridehail-otp"><KeyRound size={14} /><small>{t("ride.otp")}</small><strong>{ride.otp}</strong></div>
        </div>

        <div className="m-ridehail-vehicle">
          <div><small>{t("ride.vehicle")}</small><strong>{ride.vehicle.colour} {ride.vehicle.model}</strong></div>
          <b className="m-plate">{ride.vehicle.plate}</b>
        </div>

        <ol className="m-stops">
          <li><span className="m-stop-dot pickup" /><div><small>{t("ride.pickup")}</small><strong>{ride.pickup.label}</strong><span>{ride.pickup.address}</span></div></li>
          <li><span className="m-stop-dot drop" /><div><small>{t("ride.drop")}</small><strong>{ride.drop.label}</strong><span>{ride.drop.address}</span></div></li>
        </ol>

        <div className="m-ridehail-fare"><small>{t("ride.fare")}</small><strong>{money.format(ride.fareInr)}</strong></div>
      </section>

      <button type="button" className="button button-primary button-lg m-block m-share-button" disabled={busy} onClick={() => void share()}>
        <ShieldCheck size={20} />{sharing ? t("ride.alreadyShared") : t("ride.shareCta")}
      </button>
      <p className="m-fineprint">{t("ride.simulatedNote")}</p>
    </div>
  );
}
