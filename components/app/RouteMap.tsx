"use client";

import { MapPin } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { JourneyMap } from "@/components/app/JourneyMap";
import type { Journey } from "@/lib/types";

export function RouteMap({ compact = false, journey }: { compact?: boolean; journey: Journey }) {
  const { t } = useApp();
  if (!journey.originCoordinate || !journey.destinationCoordinate) {
    return <div className={`production-map map-unavailable ${compact ? "compact" : ""}`}><MapPin size={24} /><p>{journey.isDemo ? t("common.demoData") : t("map.routeUnavailable")}</p></div>;
  }
  return <JourneyMap
    compact={compact}
    origin={journey.originCoordinate}
    destination={journey.destinationCoordinate}
    latest={journey.latestCoordinate ?? null}
    travelType={journey.travelType}
    stale={journey.connectionStatus === "offline" || Boolean(journey.endedAt)}
  />;
}
