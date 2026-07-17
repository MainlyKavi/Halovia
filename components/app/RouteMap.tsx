"use client";

import { Clock3, MapPin, WifiOff } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { TransportIcon } from "@/components/app/TransportIcon";
import { formatTime } from "@/lib/i18n/format";
import type { Journey } from "@/lib/types";

export function RouteMap({ compact = false, journey }: { compact?: boolean; journey: Journey }) {
  const { state, t } = useApp();
  const progress = journey.progress;
  const offline = journey.connectionStatus === "offline";
  return (
    <div className={`mock-map ${compact ? "mock-map-compact" : ""}`} aria-label={t("active.route")}>
      <div className="map-grid" />
      <span className={`map-state-pill ${offline ? "offline" : ""}`}>{offline ? <WifiOff size={13} /> : <span className="map-state-dot" />}{offline ? t("common.offline") : t("viewer.simulatedLocation")}</span>
      <span className="map-road road-a" /><span className="map-road road-b" /><span className="map-road road-c" />
      <div className="route-css" aria-hidden="true">
        <span className={`route-segment segment-a ${progress >= 18 ? "reached" : ""}`} />
        <span className={`route-segment segment-b ${progress >= 42 ? "reached" : ""}`} />
        <span className={`route-segment segment-c ${progress >= 72 ? "reached" : ""}`} />
      </div>
      <span className="map-marker marker-start"><span><TransportIcon type={journey.travelType} size={15} /></span><small>{t("active.current")}</small></span>
      <span className="map-marker marker-end"><span><MapPin size={16} /></span><small>{t("active.destination")}</small></span>
      <span className="map-car" style={{ insetInlineStart: `${Math.max(22, Math.min(76, progress))}%` }}><TransportIcon type={journey.travelType} size={15} /></span>
      {!compact && <div className="map-bottom-sheet"><span><TransportIcon type={journey.travelType} size={19} /><small>{t("start.travelType")}</small><strong>{t(`travel.${journey.travelType}` as Parameters<typeof t>[0])}</strong></span><span><Clock3 size={19} /><small>{t("home.eta")}</small><strong>{formatTime(journey.eta, state.user.locale)}</strong></span><span><span className={`sheet-status-dot ${journey.emergencyState === "none" ? "safe" : "attention"}`} /><small>{t("active.safetyStatus")}</small><strong>{t(`status.${journey.status}` as Parameters<typeof t>[0])}</strong></span></div>}
    </div>
  );
}
