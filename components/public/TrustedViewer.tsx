"use client";

import Link from "next/link";
import { AlertTriangle, CalendarClock, Clock3, MapPin, ShieldCheck, UserRound, Wifi } from "lucide-react";
import { RouteMap } from "@/components/app/RouteMap";
import { TransportIcon } from "@/components/app/TransportIcon";
import { VehicleImagePreview } from "@/components/app/VehicleImagePreview";
import { useApp } from "@/components/app/AppProvider";
import { Card, CompactLanguageSwitcher, EmptyState, Progress, StatusBadge } from "@/components/ui/Primitives";
import { Logo } from "@/components/ui/Logo";
import { formatDateTime, formatTime } from "@/lib/i18n/format";

export function TrustedViewer({ token }: { token: string }) {
  const { state, ready, t } = useApp();
  if (!ready) return null;
  const allowed = state.mode === "demo" && Boolean(state.demoViewerToken) && token === state.demoViewerToken;
  const journey = state.activeJourney ?? state.history[0] ?? null;
  if (!allowed || !journey) return <main className="viewer-page shell-width"><Card><EmptyState icon={<ShieldCheck size={30} />} title={t("viewer.unavailableTitle")} text={t("viewer.unavailableText")} action={<Link href="/" className="button button-primary button-md">{t("common.backHome")}</Link>} /></Card></main>;
  return <div className="viewer-page">
    <header className="viewer-header shell-width"><Logo /><CompactLanguageSwitcher /></header>
    <main className="viewer-shell shell-width">
      <div className="demo-banner viewer-demo"><AlertTriangle size={18} /><strong>{t("common.demoData")}</strong><span>{t("viewer.localOnly")}</span></div>
      <header className="viewer-heading"><div><p className="eyebrow"><UserRound size={15} />{t("viewer.sharedBy")}</p><h1>{state.user.name}</h1><p>{t("viewer.prototypeIdentity")}</p></div><StatusBadge status={journey.status} /></header>
      <Card className="viewer-journey"><div className="live-route-heading"><div><small>{t("home.destination")}</small><h2>{journey.destination}</h2></div><div className="eta-box"><Clock3 size={17} /><span><small>{t("home.eta")}</small><strong>{formatTime(journey.eta, state.user.locale)}</strong></span></div></div><RouteMap journey={journey} /><Progress value={journey.progress} label={t("active.estimatedProgress")} /></Card>
      <div className="viewer-grid"><Card><h2>{t("viewer.currentStatus")}</h2><div className="viewer-facts"><span><TransportIcon type={journey.travelType} size={18} /><div><small>{t("start.travelType")}</small><strong>{t(`travel.${journey.travelType}` as Parameters<typeof t>[0])}</strong></div></span><span><MapPin size={18} /><div><small>{t("viewer.location")}</small><strong>{t("viewer.simulatedLocation")}</strong></div></span><span><CalendarClock size={18} /><div><small>{t("active.lastLocation")}</small><strong>{formatDateTime(journey.lastLocationUpdateAt, state.user.locale, state.user.dateFormat)}</strong></div></span><span><Wifi size={18} /><div><small>{t("active.connection")}</small><strong>{journey.connectionStatus === "online" ? t("common.network") : t("common.offline")}</strong></div></span><span><ShieldCheck size={18} /><div><small>{t("viewer.ended")}</small><strong>{journey.endedAt ? t("common.yes") : t("common.no")}</strong></div></span></div></Card><Card><h2>{t("journeys.timeline")}</h2><ol className="timeline">{journey.events.map((item) => <li key={item.id}><span /><div><strong>{t(`status.${item.type}` as Parameters<typeof t>[0])}</strong><small>{formatTime(item.timestamp, state.user.locale)}</small></div></li>)}</ol></Card></div>
      {(journey.vehicleNumber || journey.driverName || journey.vehicleDescription || journey.vehicleImageId) && <Card className="viewer-vehicle"><h2>{t("start.vehicleTitle")}</h2><dl>{journey.driverName && <div><dt>{t("start.driverName")}</dt><dd>{journey.driverName}</dd></div>}{journey.vehicleNumber && <div><dt>{t("start.vehicleNumber")}</dt><dd>{journey.vehicleNumber}</dd></div>}{journey.vehicleDescription && <div><dt>{t("start.vehicleDescription")}</dt><dd>{journey.vehicleDescription}</dd></div>}</dl><VehicleImagePreview imageId={journey.vehicleImageId} name={journey.vehicleImageName} alt={t("start.imagePreviewAlt")} /></Card>}
      {journey.emergencyState !== "none" && <Card className="emergency-state-banner"><AlertTriangle size={21} /><div><h2>{t("viewer.emergencyStatus")}</h2><p>{journey.emergencyState === "helpRequested" ? t("viewer.helpRequested") : t("viewer.prototypeEscalated")}</p></div></Card>}
      <p className="viewer-disclaimer">{t("viewer.noPublicSharing")}</p>
    </main>
  </div>;
}
