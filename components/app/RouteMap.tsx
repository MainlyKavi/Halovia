"use client";

import { MapPin, Navigation } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";

export function RouteMap({ compact = false, progress = 0 }: { compact?: boolean; progress?: number }) {
  const { t } = useApp();
  return (
    <div className={`mock-map ${compact ? "mock-map-compact" : ""}`} aria-label={t("active.route")}>
      <div className="map-grid" />
      <span className="map-road road-a" /><span className="map-road road-b" /><span className="map-road road-c" />
      <div className="route-css" aria-hidden="true">
        <span className={`route-segment segment-a ${progress >= 18 ? "reached" : ""}`} />
        <span className={`route-segment segment-b ${progress >= 42 ? "reached" : ""}`} />
        <span className={`route-segment segment-c ${progress >= 72 ? "reached" : ""}`} />
      </div>
      <span className="map-marker marker-start"><span><Navigation size={14} /></span><small>{t("active.current")}</small></span>
      <span className="map-marker marker-end"><span><MapPin size={16} /></span><small>{t("active.destination")}</small></span>
      <span className="map-car" style={{ left: `${Math.max(22, Math.min(76, progress))}%` }}><Navigation size={15} /></span>
    </div>
  );
}
