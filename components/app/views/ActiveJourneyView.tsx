"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, BatteryCharging, BellRing, Check, Clock3, Radio, Route, ShieldAlert, ShieldCheck, Signal, SignalZero, TimerReset, UsersRound } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { RouteMap } from "@/components/app/RouteMap";
import { SafetyCheckModal } from "@/components/app/SafetyCheckModal";
import { Avatar, Button, Card, Dialog, Progress, StatusBadge } from "@/components/ui/Primitives";

export function ActiveJourneyView() {
  const { state, t, setActiveJourney, completeJourney, showToast } = useApp();
  const journey = state.activeJourney;
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [connected, setConnected] = useState(true);
  if (!journey) return <div className="view-stack narrow-view"><Card className="empty-active"><span className="empty-icon"><Route size={28} /></span><h1>{t("home.noActiveTitle")}</h1><p>{t("home.noActiveText")}</p><Link href="/start" className="button button-primary button-lg">{t("home.startJourney")}</Link></Card></div>;
  const currentJourney = journey;
  const viewers = state.contacts.filter((contact) => currentJourney.contactIds.includes(contact.id));
  function unusual(status: "routeChanged" | "slightDelay" | "safetyCheckRequested") {
    setActiveJourney({ ...currentJourney, status, safetyCheckOccurred: true, events: [...currentJourney.events, { id: `event-${Date.now()}`, type: status, timestamp: new Date().toISOString() }] });
    setSafetyOpen(true); showToast(t("active.unusualToast"));
  }
  function alertContacts() {
    setSafetyOpen(false); setActiveJourney({ ...currentJourney, status: "contactAlerted", alertTriggered: true, safetyCheckOccurred: true, events: [...currentJourney.events, { id: `event-${Date.now()}`, type: "contactAlerted", timestamp: new Date().toISOString() }] }); showToast(t("active.alertToast"));
  }
  return <div className="view-stack active-view">
    <header className="view-heading"><div><p className="eyebrow"><Radio size={15} />{t("home.activeEyebrow")}</p><h1>{t("active.title")}</h1></div><StatusBadge status={journey.status} /></header>
    <Card className="live-journey-card">
      <div className="live-route-heading"><div><small>{t("home.destination")}</small><h2>{journey.destination}</h2></div><div className="eta-box"><Clock3 size={17} /><span><small>{t("home.eta")}</small><strong>{new Intl.DateTimeFormat(state.user.language, { hour: "numeric", minute: "2-digit" }).format(new Date(journey.eta))}</strong></span></div></div>
      <RouteMap progress={journey.progress} />
      <Progress value={journey.progress} label={t("active.progress")} />
      <div className="journey-health-grid"><div><span className="health-icon"><BatteryCharging size={19} /></span><span><small>{t("active.battery")}</small><strong>72%</strong></span></div><div><span className={`health-icon ${connected ? "" : "warn"}`}>{connected ? <Signal size={19} /> : <SignalZero size={19} />}</span><span><small>{t("active.connection")}</small><strong>{connected ? t("common.network") : t("common.offline")}</strong></span></div><div><span className="health-icon"><Clock3 size={19} /></span><span><small>{t("active.lastLocation")}</small><strong>{t("active.now")}</strong></span></div></div>
      <div className="viewer-panel"><div><UsersRound size={18} /><span><strong>{t("active.viewing")}</strong><small>{t("home.notified")}</small></span></div><div className="viewer-list">{viewers.map((contact) => <span key={contact.id}><Avatar initials={contact.initials} color={contact.color} size="sm" /><small>{contact.name}</small><Check size={13} /></span>)}</div></div>
      <div className="live-actions"><Button variant="safe" size="lg" onClick={() => showToast(t("safety.safe"))}><ShieldCheck size={21} />{t("home.imSafe")}</Button><Button variant="secondary" size="lg" onClick={() => setEndOpen(true)}>{t("home.endJourney")}</Button><Link href="/emergency" className="button button-danger button-lg"><ShieldAlert size={21} />{t("nav.emergency")}</Link></div>
    </Card>
    <details className="demo-panel"><summary><span><AlertTriangle size={18} />{t("active.demoPanel")}</span><small>{t("common.demo")}</small></summary><p>{t("active.demoText")}</p><div className="demo-grid"><Button variant="secondary" onClick={() => unusual("routeChanged")}><Route size={18} />{t("active.routeDeviation")}</Button><Button variant="secondary" onClick={() => unusual("slightDelay")}><TimerReset size={18} />{t("active.extendedStop")}</Button><Button variant="secondary" onClick={() => { setConnected(false); showToast(t("active.connectionLost")); }}><SignalZero size={18} />{t("active.lostConnection")}</Button><Button variant="secondary" onClick={() => unusual("safetyCheckRequested")}><BellRing size={18} />{t("active.safetyCheck")}</Button><Button variant="secondary" onClick={alertContacts}><ShieldAlert size={18} />{t("active.emergencyAlert")}</Button><Button variant="secondary" onClick={() => { completeJourney("arrivedSafely"); showToast(t("active.arrivedToast")); }}><Check size={18} />{t("active.safeArrival")}</Button></div></details>
    {safetyOpen && <SafetyCheckModal open onClose={() => { setSafetyOpen(false); setActiveJourney({ ...journey, status: "onRoute", safetyCheckOccurred: true, events: [...journey.events, { id: `event-${Date.now()}`, type: "onRoute", timestamp: new Date().toISOString() }] }); showToast(t("safety.safe")); }} onNeedHelp={alertContacts} />}
    <Dialog open={endOpen} onClose={() => setEndOpen(false)} title={t("home.endJourney")} description={t("home.notified")}><div className="dialog-actions"><Button variant="ghost" onClick={() => setEndOpen(false)}>{t("common.cancel")}</Button><Button variant="danger" onClick={() => { completeJourney("endedManually"); setEndOpen(false); showToast(t("active.endedToast")); }}>{t("home.endJourney")}</Button></div></Dialog>
  </div>;
}
