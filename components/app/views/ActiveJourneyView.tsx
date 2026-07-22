"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, BellRing, Check, Clock3, Copy, ExternalLink, Radio, Route, Share2, ShieldAlert, ShieldCheck, Signal, SignalZero, TimerReset, Unlink, UsersRound } from "lucide-react";
import { EndJourneyDialog } from "@/components/app/EndJourneyDialog";
import { useApp } from "@/components/app/AppProvider";
import { JourneyMap } from "@/components/app/JourneyMap";
import { SafetyCheckModal } from "@/components/app/SafetyCheckModal";
import { TransportIcon } from "@/components/app/TransportIcon";
import { Avatar, Button, Card, StatusBadge } from "@/components/ui/Primitives";
import { formatDateTime, formatDistance, formatNumber, formatTime } from "@/lib/i18n/format";
import { locationUpdateAge } from "@/lib/map-policy";
import { haloviaApi } from "@/lib/api-client";
import type { TrackingStatus } from "@/lib/api-types";

const trackingKeys: Record<TrackingStatus, Parameters<ReturnType<typeof useApp>["t"]>[0]> = {
  idle: "tracking.paused",
  permission_required: "tracking.permissionRequired",
  finding: "tracking.finding",
  updating: "tracking.updating",
  live: "tracking.live",
  accuracy_limited: "tracking.accuracyLimited",
  stale: "tracking.stale",
  offline: "tracking.offline",
  paused: "tracking.paused",
  unavailable: "tracking.unavailable",
  ended: "tracking.ended",
  sharing_disabled: "tracking.sharingDisabled",
};

export function ActiveJourneyView() {
  const {
    state, backendJourney, tracking, shareSessions, viewerUrl, t, completeJourney,
    recordSafeCheckIn, triggerSafetyCheck, requestHelp, createShare, revokeShare, showToast,
  } = useApp();
  const journey = state.activeJourney;
  const [endOpen, setEndOpen] = useState(false);
  const [sharingBusy, setSharingBusy] = useState(false);
  const [clock, setClock] = useState(() => Date.now());
  const [routeMetrics, setRouteMetrics] = useState<{ routeEta: string; remainingDistanceMetres: number } | null>(null);

  const updateRoute = useCallback((metrics: { routeEta: string; remainingDistanceMetres: number }) => {
    setRouteMetrics(metrics);
    if (backendJourney) void haloviaApi.updateRoute(backendJourney.id, metrics.routeEta, metrics.remainingDistanceMetres).catch(() => undefined);
  }, [backendJourney]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  if (!journey || !backendJourney || !journey.originCoordinate || !journey.destinationCoordinate) {
    return <div className="view-stack narrow-view"><Card className="empty-active"><span className="empty-icon"><Route size={28} /></span><h1>{t("home.noActiveTitle")}</h1><p>{t("home.noActiveText")}</p><Link href="/start" className="button button-primary button-lg">{t("home.startJourney")}</Link></Card></div>;
  }
  const activeBackendJourney = backendJourney;

  const selectedContacts = state.contacts.filter((contact) => contact.active);
  const effectiveRouteEta = routeMetrics?.routeEta ?? journey.routeEta;
  const effectiveDistance = routeMetrics?.remainingDistanceMetres ?? journey.remainingDistanceMetres;
  const newestCoordinate = tracking.coordinate ?? backendJourney.latestLocation;
  const activeShares = shareSessions.filter((session) => !session.revokedAt && new Date(session.expiresAt).getTime() > clock);
  const updateAge = locationUpdateAge(tracking.lastServerUpdateAt, clock);
  const updateAgeText = updateAge.kind === "justNow" ? t("tracking.updatedJustNow")
    : updateAge.kind === "seconds" ? t("tracking.updatedSeconds", { count: formatNumber(updateAge.value, state.user.locale) })
    : updateAge.kind === "minutes" ? t("tracking.updatedMinutes", { count: formatNumber(updateAge.value, state.user.locale) })
    : t("tracking.updateUnavailable");

  async function makeShare() {
    setSharingBusy(true);
    try {
      const url = await createShare();
      showToast(t("sharing.createdNotSent"));
      if (navigator.share) {
        try { await navigator.share({ title: `Halovia · ${activeBackendJourney.destinationName}`, text: t("sharing.manualNote"), url }); } catch (error) {
          if (!(error instanceof DOMException && error.name === "AbortError")) showToast(t("sharing.createdNotSent"));
        }
      }
    } catch {
      showToast(t("journey.serverError"));
    } finally { setSharingBusy(false); }
  }

  async function copyShare() {
    if (!viewerUrl) return;
    try { await navigator.clipboard.writeText(viewerUrl); showToast(t("sharing.copied")); }
    catch { showToast(t("sharing.createdNotSent")); }
  }

  async function stopSharing() {
    setSharingBusy(true);
    try { await revokeShare(); showToast(t("tracking.sharingDisabled")); }
    catch { showToast(t("journey.serverError")); }
    finally { setSharingBusy(false); }
  }

  return <div className="view-stack active-view active-map-layout">
    <header className="view-heading active-heading"><div><p className="eyebrow"><Radio size={15} />{t("home.activeEyebrow")}</p><h1>{journey.destination}</h1></div><StatusBadge status={journey.status} /></header>
    <div className="journey-map-stage">
      <JourneyMap
        origin={journey.originCoordinate}
        destination={journey.destinationCoordinate}
        latest={newestCoordinate}
        travelType={journey.travelType}
        stale={["stale", "offline", "paused", "sharing_disabled"].includes(tracking.status)}
        onRouteMetrics={updateRoute}
      />
      <div className={`tracking-pill tracking-${tracking.status}`} role="status"><span className="status-symbol" aria-hidden="true">{tracking.status === "live" ? "✓" : tracking.status === "offline" ? "!" : "•"}</span>{t(trackingKeys[tracking.status])}</div>
      {["permission_required", "unavailable", "paused"].includes(tracking.status) && <button type="button" className="map-tracking-retry" onClick={tracking.retry}>{t("common.retry")}</button>}
    </div>

    <Card className="live-journey-card journey-bottom-sheet">
      <div className="sheet-handle" aria-hidden="true" />
      <div className="live-route-heading"><div><small>{t("home.destination")}</small><h2>{journey.destination}</h2><span className="transport-label"><TransportIcon type={journey.travelType} size={17} />{t(`travel.${journey.travelType}` as Parameters<typeof t>[0])}</span></div><div className="eta-box"><Clock3 size={17} /><span><small>{t("active.routeEta")}</small><strong>{effectiveRouteEta ? formatTime(effectiveRouteEta, state.user.locale) : "—"}</strong></span></div></div>

      <div className="journey-stat-row">
        <div><small>{t("active.remainingDistance")}</small><strong>{typeof effectiveDistance === "number" ? formatDistance(effectiveDistance, state.user.locale) : "—"}</strong></div>
        <div><small>{t("active.safetyEta")}</small><strong>{formatTime(journey.eta, state.user.locale)}</strong></div>
        <div><small>{t("active.locationAccuracy")}</small><strong>{tracking.accuracy !== null ? `±${formatDistance(Math.round(tracking.accuracy), state.user.locale)}` : "—"}</strong></div>
      </div>

      {journey.travelType === "autoRickshaw" && <p className="route-approximation"><AlertTriangle size={16} />{t("active.routeApproximation")}</p>}

      <div className={`safety-status-card safety-status-${journey.emergencyState}`}><span className="safety-state-icon">{journey.emergencyState === "none" ? <ShieldCheck size={25} /> : <AlertTriangle size={25} />}</span><div><small>{t("active.safetyStatus")}</small><h2>{journey.backendSafetyStatus === "safe" ? t("status.safeCheckIn") : t(`status.${journey.status}` as Parameters<typeof t>[0])}</h2>{journey.emergencyState !== "none" && <p>{t("active.noExternalDelivery")}</p>}</div></div>

      <section className="viewer-panel" aria-labelledby="sharing-title">
        <div><UsersRound size={18} /><span><strong id="sharing-title">{t("active.selectedContacts")}</strong><small>{activeShares.length ? t("sharing.active") : t("sharing.manualNote")}</small></span></div>
        {selectedContacts.length ? <div className="viewer-list">{selectedContacts.map((contact) => <span key={contact.id}><Avatar initials={contact.initials} color={contact.color} size="sm" /><small>{contact.name}</small><Check size={13} /></span>)}</div> : <p className="empty-inline">{t("active.noSelectedContacts")}</p>}
        {activeShares.map((session) => <div className="share-session" key={session.id}><span><ExternalLink size={15} /><small>{t("sharing.expiry", { time: formatDateTime(session.expiresAt, state.user.locale, state.user.dateFormat) })}</small></span><Button variant="ghost" size="sm" onClick={() => void revokeShare(session.id)}><Unlink size={15} />{t("sharing.revoke")}</Button></div>)}
        <div className="share-actions">
          {!activeShares.length && <Button variant="secondary" disabled={sharingBusy} onClick={() => void makeShare()}><Share2 size={17} />{t("sharing.create")}</Button>}
          {viewerUrl && <Button variant="secondary" onClick={() => void copyShare()}><Copy size={17} />{t("sharing.copy")}</Button>}
          {activeShares.length > 0 && <Button variant="ghost" disabled={sharingBusy} onClick={() => void stopSharing()}><Unlink size={17} />{t("active.stopSharing")}</Button>}
        </div>
      </section>

      <Button variant="safe" size="lg" className="primary-safe-action" onClick={recordSafeCheckIn}><ShieldCheck size={22} />{t("home.imSafe")}</Button>
      <Button variant="secondary" size="lg" onClick={() => triggerSafetyCheck("manualDemo")}><BellRing size={20} />{t("active.safetyCheck")}</Button>
      <div className="live-actions-secondary"><Button variant="danger" size="lg" onClick={requestHelp}><ShieldAlert size={21} />{t("safety.help")}</Button><Button variant="secondary" size="lg" onClick={() => setEndOpen(true)}>{t("home.endJourney")}</Button></div>

      <div className="journey-health-grid secondary-health">
        <div><span className={`health-icon ${tracking.online ? "" : "warn"}`}>{tracking.online ? <Signal size={19} /> : <SignalZero size={19} />}</span><span><small>{t("active.connection")}</small><strong>{tracking.online ? t("common.network") : t("common.offline")}</strong></span></div>
        <div><span className="health-icon"><Clock3 size={19} /></span><span><small>{t("active.lastServerUpdate")}</small><strong>{updateAgeText}</strong></span></div>
      </div>

      {(journey.driverName || journey.vehicleNumber || journey.vehicleDescription || backendJourney.hasVehicleImage) && <details className="active-vehicle"><summary>{t("start.vehicleTitle")}</summary><dl>{journey.driverName && <div><dt>{t("start.driverName")}</dt><dd>{journey.driverName}</dd></div>}{journey.vehicleNumber && <div><dt>{t("start.vehicleNumber")}</dt><dd>{journey.vehicleNumber}</dd></div>}{journey.vehicleDescription && <div><dt>{t("start.vehicleDescription")}</dt><dd>{journey.vehicleDescription}</dd></div>}</dl>{backendJourney.hasVehicleImage && <Image unoptimized width={960} height={540} className="vehicle-backend-image" src={`/api/journeys/${journey.id}/vehicle-image`} alt={t("start.imagePreviewAlt")} />}</details>}

      <details className="active-timeline"><summary>{t("journeys.timeline")}</summary><ol className="timeline">{journey.events.map((item) => <li key={item.id}><span /><div><strong>{t(`status.${item.type}` as Parameters<typeof t>[0])}</strong><small>{formatTime(item.timestamp, state.user.locale)}</small></div></li>)}</ol></details>
    </Card>

    {state.mode === "demo" && import.meta.env.DEV && <details className="demo-panel"><summary><span><AlertTriangle size={18} />{t("active.demoPanel")}</span><small>{t("common.demoData")}</small></summary><div className="demo-grid"><Button variant="secondary" onClick={() => triggerSafetyCheck("routeChanged")}><Route size={18} />{t("active.routeDeviation")}</Button><Button variant="secondary" onClick={() => triggerSafetyCheck("extendedStop")}><TimerReset size={18} />{t("active.extendedStop")}</Button><Button variant="secondary" onClick={() => completeJourney("arrivedSafely")}><Check size={18} />{t("active.safeArrival")}</Button></div></details>}
    <SafetyCheckModal />
    <EndJourneyDialog open={endOpen} onClose={() => setEndOpen(false)} />
  </div>;
}
