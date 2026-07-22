"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AlertTriangle, Clock3, LockKeyhole, MapPin, Radio, RefreshCw, ShieldAlert, ShieldCheck, Signal, SignalZero } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { JourneyMap } from "@/components/app/JourneyMap";
import { TransportIcon } from "@/components/app/TransportIcon";
import { Card, CompactLanguageSwitcher } from "@/components/ui/Primitives";
import { Logo } from "@/components/ui/Logo";
import { HaloviaApiError, haloviaApi } from "@/lib/api-client";
import { LOCATION_POLICY } from "@/lib/config";
import { formatDateTime, formatDistance, formatNumber, formatTime } from "@/lib/i18n/format";
import { locationUpdateAge } from "@/lib/map-policy";
import type { ViewerPayload } from "@/lib/api-types";

export function TrustedViewer({ token }: { token: string }) {
  const { state, t } = useApp();
  const [payload, setPayload] = useState<ViewerPayload | null>(null);
  const [connection, setConnection] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [terminal, setTerminal] = useState<"invalid" | "expired" | "revoked" | "ended" | null>(null);

  useEffect(() => {
    let stopped = false;
    let controller: AbortController | null = null;
    async function refresh() {
      controller?.abort();
      controller = new AbortController();
      try {
        const result = await haloviaApi.viewer(token, controller.signal);
        if (stopped) return;
        setPayload(result);
        setConnection("connected");
        setTerminal(null);
      } catch (error) {
        if (stopped || (error instanceof DOMException && error.name === "AbortError")) return;
        setConnection("disconnected");
        if (error instanceof HaloviaApiError && error.status === 410) {
          const next = error.code === "viewer_expired" ? "expired" : error.code === "viewer_revoked" ? "revoked" : "ended";
          setTerminal(next);
        } else if (error instanceof HaloviaApiError && error.status === 404) setTerminal("invalid");
      }
    }
    void refresh();
    const interval = window.setInterval(() => { if (!document.hidden) void refresh(); }, LOCATION_POLICY.viewerPollIntervalMs);
    const online = () => void refresh();
    const offline = () => setConnection("disconnected");
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      stopped = true;
      controller?.abort();
      window.clearInterval(interval);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [token]);

  if (terminal) return <ViewerShell><Card className="viewer-terminal"><span className="empty-icon"><LockKeyhole size={28} /></span><h1>{t("viewer.unavailableTitle")}</h1><p>{t("viewer.unavailableText")}</p></Card></ViewerShell>;
  if (!payload) return <ViewerShell><Card className="viewer-terminal"><RefreshCw className="spin" size={26} /><h1>{t("common.loading")}</h1><p>{connection === "disconnected" ? t("tracking.offline") : t("tracking.updating")}</p></Card></ViewerShell>;

  const { journey, freshness } = payload;
  const latest = journey.latestLocation;
  const stale = freshness !== "live" || connection !== "connected";
  const safetyIcon = journey.safetyStatus === "safe" ? <ShieldCheck size={24} /> : journey.safetyStatus === "help_requested" ? <ShieldAlert size={24} /> : <AlertTriangle size={24} />;
  const updateAge = locationUpdateAge(journey.lastServerUpdateAt);
  const updateAgeText = updateAge.kind === "justNow" ? t("tracking.updatedJustNow")
    : updateAge.kind === "seconds" ? t("tracking.updatedSeconds", { count: formatNumber(updateAge.value, state.user.locale) })
    : updateAge.kind === "minutes" ? t("tracking.updatedMinutes", { count: formatNumber(updateAge.value, state.user.locale) })
    : t("tracking.updateUnavailable");
  const connectionText = connection === "connected" ? t("viewer.connected") : connection === "connecting" ? t("viewer.connecting") : t("viewer.disconnected");
  const safetyText = journey.safetyStatus === "safe" ? t("status.safeCheckIn")
    : journey.safetyStatus === "check_pending" ? t("status.safetyCheckRequested")
    : journey.safetyStatus === "attention_required" ? t("status.prototypeEscalated")
    : t("status.helpRequested");

  return <ViewerShell>
    <main className="viewer-main">
      <div className="viewer-heading"><div><p className="eyebrow"><Radio size={15} />{t("viewer.localOnly")}</p><h1>{journey.ownerDisplayName}</h1><p>{t("viewer.sharedBy")} {journey.ownerDisplayName}</p></div><div className={`viewer-connection ${connection}`}>{connection === "connected" ? <Signal size={17} /> : <SignalZero size={17} />}{connectionText}</div></div>

      <section className="viewer-map-card">
        <JourneyMap origin={journey.origin} destination={journey.destination} latest={latest} travelType={journey.transportType} stale={stale} />
        <div className={`tracking-pill tracking-${freshness}`} role="status"><span className="status-symbol">{freshness === "live" ? "✓" : "!"}</span>{freshness === "live" ? t("tracking.live") : freshness === "stale" ? t("tracking.stale") : t("tracking.unavailable")}</div>
      </section>

      <Card className="viewer-journey-card">
        <div className="viewer-destination"><span><MapPin size={20} /></span><div><small>{t("home.destination")}</small><h2>{journey.destinationName}</h2><p><TransportIcon type={journey.transportType} size={16} />{t(`travel.${journey.transportType}` as Parameters<typeof t>[0])}</p></div></div>
        <div className="journey-stat-row"><div><small>{t("active.routeEta")}</small><strong>{journey.routeEta ? formatTime(journey.routeEta, state.user.locale) : "—"}</strong></div><div><small>{t("active.safetyEta")}</small><strong>{formatTime(journey.safetyEta, state.user.locale)}</strong></div><div><small>{t("active.remainingDistance")}</small><strong>{journey.remainingDistanceMetres !== null ? formatDistance(journey.remainingDistanceMetres, state.user.locale) : "—"}</strong></div></div>

        <div className={`safety-status-card safety-status-${journey.safetyStatus}`}><span className="safety-state-icon">{safetyIcon}</span><div><small>{t("viewer.currentStatus")}</small><h2>{safetyText}</h2><p>{journey.safetyStatus === "help_requested" ? t("viewer.helpRequested") : t("active.noExternalDelivery")}</p></div></div>

        <div className="viewer-technical"><div><Clock3 size={17} /><span><small>{t("active.lastServerUpdate")}</small><strong>{updateAgeText}</strong></span></div><div><MapPin size={17} /><span><small>{t("active.locationAccuracy")}</small><strong>{latest ? `±${formatDistance(Math.round(latest.accuracy), state.user.locale)}` : "—"}</strong></span></div></div>

        {(journey.driverName || journey.vehicleNumber || journey.vehicleDescription || journey.hasVehicleImage) && <details className="active-vehicle"><summary>{t("start.vehicleTitle")}</summary><dl>{journey.driverName && <div><dt>{t("start.driverName")}</dt><dd>{journey.driverName}</dd></div>}{journey.vehicleNumber && <div><dt>{t("start.vehicleNumber")}</dt><dd>{journey.vehicleNumber}</dd></div>}{journey.vehicleDescription && <div><dt>{t("start.vehicleDescription")}</dt><dd>{journey.vehicleDescription}</dd></div>}</dl>{journey.hasVehicleImage && <Image unoptimized width={960} height={540} className="vehicle-backend-image" src={`/api/view/${encodeURIComponent(token)}/vehicle-image`} alt={t("start.imagePreviewAlt")} />}</details>}

        <details className="active-timeline" open><summary>{t("journeys.timeline")}</summary><ol className="timeline">{journey.events.map((item) => <li key={item.id}><span /><div><strong>{t(viewerEventKey(item.type))}</strong><small>{formatDateTime(item.createdAt, state.user.locale, state.user.dateFormat)}</small></div></li>)}</ol></details>
        <p className="viewer-limit"><AlertTriangle size={17} />{t("journey.backgroundLimit")} {t("journey.noAutomaticAlerts")}</p>
      </Card>
    </main>
  </ViewerShell>;
}

function viewerEventKey(type: string): Parameters<ReturnType<typeof useApp>["t"]>[0] {
  const keys: Record<string, Parameters<ReturnType<typeof useApp>["t"]>[0]> = {
    journey_started: "status.journeyStarted",
    sharing_enabled: "status.onRoute",
    sharing_revoked: "status.connectionLost",
    safe_check_in: "status.safeCheckIn",
    safety_check_started: "status.safetyCheckRequested",
    safety_check_extended: "status.safetyCheckExtended",
    safety_check_expired: "status.prototypeEscalated",
    help_requested: "status.helpRequested",
    arrived_safely: "status.arrivedSafely",
    journey_ended: "status.endedManually",
  };
  return keys[type] ?? "status.onRoute";
}

function ViewerShell({ children }: { children: React.ReactNode }) {
  const { t } = useApp();
  return <div className="viewer-page"><header className="viewer-header"><Logo /><CompactLanguageSwitcher /></header>{children}<footer><p><LockKeyhole size={15} />{t("viewer.noPublicSharing")}</p><p>{t("disclaimer")}</p></footer></div>;
}
