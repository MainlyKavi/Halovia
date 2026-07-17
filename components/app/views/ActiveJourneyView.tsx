"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, BatteryCharging, BellRing, Check, Clock3, ExternalLink, Radio, Route, ShieldAlert, ShieldCheck, Signal, SignalZero, TimerReset, UsersRound } from "lucide-react";
import { EndJourneyDialog } from "@/components/app/EndJourneyDialog";
import { useApp } from "@/components/app/AppProvider";
import { RouteMap } from "@/components/app/RouteMap";
import { SafetyCheckModal } from "@/components/app/SafetyCheckModal";
import { VehicleImagePreview } from "@/components/app/VehicleImagePreview";
import { Avatar, Button, Card, Progress, StatusBadge } from "@/components/ui/Primitives";
import { formatDateTime, formatTime } from "@/lib/i18n/format";

export function ActiveJourneyView() {
  const {
    state, t, completeJourney, recordSafeCheckIn, triggerSafetyCheck,
    requestHelp, setConnectionStatus, showToast,
  } = useApp();
  const journey = state.activeJourney;
  const [endOpen, setEndOpen] = useState(false);

  if (!journey) return <div className="view-stack narrow-view"><Card className="empty-active"><span className="empty-icon"><Route size={28} /></span><h1>{t("home.noActiveTitle")}</h1><p>{t("home.noActiveText")}</p><Link href="/start" className="button button-primary button-lg">{t("home.startJourney")}</Link></Card></div>;
  const selectedContacts = state.contacts.filter((contact) => journey.contactIds.includes(contact.id));

  function safeCheckIn() {
    recordSafeCheckIn();
    showToast(t("safety.safeRecorded"));
  }

  function simulate(reason: "routeChanged" | "extendedStop" | "manualDemo") {
    triggerSafetyCheck(reason);
    showToast(t("active.unusualToast"));
  }

  return <div className="view-stack active-view">
    <header className="view-heading"><div><p className="eyebrow"><Radio size={15} />{t("home.activeEyebrow")}</p><h1>{t("active.title")}</h1></div><StatusBadge status={journey.status} /></header>
    <Card className="live-journey-card">
      <div className="live-route-heading"><div><small>{t("home.destination")}</small><h2>{journey.destination}</h2></div><div className="eta-box"><Clock3 size={17} /><span><small>{t("home.eta")}</small><strong>{formatTime(journey.eta, state.user.locale)}</strong></span></div></div>

      <RouteMap journey={journey} />
      <Progress value={journey.progress} label={t("active.estimatedProgress")} />

      <div className={`safety-status-card safety-status-${journey.emergencyState}`}><span className="safety-state-icon">{journey.emergencyState === "none" ? <ShieldCheck size={25} /> : <AlertTriangle size={25} />}</span><div><small>{t("active.safetyStatus")}</small><h2>{t(`status.${journey.status}` as Parameters<typeof t>[0])}</h2><p>{journey.emergencyState === "helpRequested" ? t("active.helpLocalState") : journey.emergencyState === "prototypeEscalated" ? t("active.escalationLocalState") : journey.lastCheckInAt ? t("active.lastSafeAt", { time: formatTime(journey.lastCheckInAt, state.user.locale) }) : t("active.statusPrototypeCopy")}</p></div></div>

      <div className="viewer-panel"><div><UsersRound size={18} /><span><strong>{t("active.selectedContacts")}</strong><small>{t("active.contactsNoAccess")}</small></span></div>{selectedContacts.length ? <div className="viewer-list">{selectedContacts.map((contact) => <span key={contact.id}><Avatar initials={contact.initials} color={contact.color} size="sm" /><small>{contact.name}</small><Check size={13} /></span>)}</div> : <p className="empty-inline">{t("active.noSelectedContacts")}</p>}{state.mode === "demo" && state.demoViewerToken && <Link className="viewer-demo-link" href={`/viewer/${state.demoViewerToken}`}><ExternalLink size={16} />{t("viewer.open")}</Link>}</div>

      <Button variant="safe" size="lg" className="primary-safe-action" onClick={safeCheckIn}><ShieldCheck size={22} />{t("home.imSafe")}</Button>

      <div className="live-actions-secondary"><Link href="/emergency" className="button button-danger button-lg"><ShieldAlert size={21} />{t("nav.emergency")}</Link><Button variant="secondary" size="lg" onClick={() => setEndOpen(true)}>{t("home.endJourney")}</Button></div>

      <div className="journey-health-grid secondary-health"><div><span className="health-icon"><BatteryCharging size={19} /></span><span><small>{t("active.battery")}</small><strong>{t("active.mockBattery")}</strong></span></div><div><span className={`health-icon ${journey.connectionStatus === "online" ? "" : "warn"}`}>{journey.connectionStatus === "online" ? <Signal size={19} /> : <SignalZero size={19} />}</span><span><small>{t("active.connection")}</small><strong>{journey.connectionStatus === "online" ? t("common.network") : t("common.offline")}</strong></span></div><div><span className="health-icon"><Clock3 size={19} /></span><span><small>{t("active.lastLocation")}</small><strong>{formatDateTime(journey.lastLocationUpdateAt, state.user.locale, state.user.dateFormat)}</strong></span></div></div>

      {(journey.driverName || journey.vehicleNumber || journey.vehicleDescription || journey.vehicleImageId) && <details className="active-vehicle"><summary>{t("start.vehicleTitle")}</summary><dl>{journey.driverName && <div><dt>{t("start.driverName")}</dt><dd>{journey.driverName}</dd></div>}{journey.vehicleNumber && <div><dt>{t("start.vehicleNumber")}</dt><dd>{journey.vehicleNumber}</dd></div>}{journey.vehicleDescription && <div><dt>{t("start.vehicleDescription")}</dt><dd>{journey.vehicleDescription}</dd></div>}</dl><VehicleImagePreview imageId={journey.vehicleImageId} name={journey.vehicleImageName} alt={t("start.imagePreviewAlt")} /></details>}

      <details className="active-timeline"><summary>{t("journeys.timeline")}</summary><ol className="timeline">{journey.events.map((item) => <li key={item.id}><span /><div><strong>{t(`status.${item.type}` as Parameters<typeof t>[0])}</strong><small>{formatTime(item.timestamp, state.user.locale)}</small></div></li>)}</ol></details>
    </Card>

    {state.mode === "demo" && <details className="demo-panel"><summary><span><AlertTriangle size={18} />{t("active.demoPanel")}</span><small>{t("common.demoData")}</small></summary><p>{t("active.demoText")}</p><div className="demo-grid"><Button variant="secondary" onClick={() => simulate("routeChanged")}><Route size={18} />{t("active.routeDeviation")}</Button><Button variant="secondary" onClick={() => simulate("extendedStop")}><TimerReset size={18} />{t("active.extendedStop")}</Button><Button variant="secondary" onClick={() => { setConnectionStatus(false); showToast(t("active.connectionLost")); }}><SignalZero size={18} />{t("active.lostConnection")}</Button><Button variant="secondary" onClick={() => simulate("manualDemo")}><BellRing size={18} />{t("active.safetyCheck")}</Button><Button variant="secondary" onClick={() => { requestHelp(); showToast(t("safety.helpRecorded")); }}><ShieldAlert size={18} />{t("active.localEmergencyState")}</Button><Button variant="secondary" onClick={() => { completeJourney("arrivedSafely"); showToast(t("active.arrivedToast")); }}><Check size={18} />{t("active.safeArrival")}</Button></div></details>}
    <SafetyCheckModal />
    <EndJourneyDialog open={endOpen} onClose={() => setEndOpen(false)} />
  </div>;
}
