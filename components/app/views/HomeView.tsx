"use client";

import Link from "next/link";
import { ArrowRight, BatteryCharging, Bell, Clock3, Lightbulb, MapPin, Navigation, PhoneCall, ShieldCheck, UsersRound } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { RouteMap } from "@/components/app/RouteMap";
import { Avatar, Button, Card, Progress, StatusBadge } from "@/components/ui/Primitives";

function formatTime(value: string, language: string) {
  return new Intl.DateTimeFormat(language, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function HomeView() {
  const { state, t, completeJourney, showToast } = useApp();
  const active = state.activeJourney;
  const viewers = active ? state.contacts.filter((contact) => active.contactIds.includes(contact.id)) : state.contacts.filter((contact) => contact.defaultForJourneys);
  return (
    <div className="view-stack">
      <header className="view-heading"><div><p className="eyebrow">{active ? t("home.activeEyebrow") : t("home.calm")}</p><h1>{t("home.hello", { name: state.user.name })}</h1></div>{active && <StatusBadge status={active.status} />}</header>

      {active ? (
        <Card className="active-home-card">
          <div className="active-home-top"><span className="destination-icon"><Navigation size={20} /></span><div><small>{t("home.destination")}</small><h2>{active.destination}</h2></div></div>
          <RouteMap compact progress={active.progress} />
          <Progress value={active.progress} label={t("active.progress")} />
          <div className="active-meta"><span><Clock3 size={18} /><small>{t("home.eta")}</small><strong>{formatTime(active.eta, state.user.language)}</strong></span><span><BatteryCharging size={18} /><small>{t("active.battery")}</small><strong>72%</strong></span><span><UsersRound size={18} /><small>{t("active.viewing")}</small><strong>{viewers.length}</strong></span></div>
          <div className="active-actions"><Button variant="safe" size="lg" onClick={() => showToast(t("safety.safe"))}><ShieldCheck size={20} />{t("home.imSafe")}</Button><Link href="/active" className="button button-primary button-lg">{t("home.openJourney")}<ArrowRight size={18} /></Link><Button variant="ghost" onClick={() => { completeJourney("endedManually"); showToast(t("active.endedToast")); }}>{t("home.endJourney")}</Button></div>
        </Card>
      ) : (
        <Card className="start-home-card"><div className="start-visual"><span className="start-halo"><MapPin size={26} /></span><span className="route-dots" /></div><div><h2>{t("home.noActiveTitle")}</h2><p>{t("home.noActiveText")}</p><Link href="/start" className="button button-primary button-lg">{t("home.startJourney")}<ArrowRight size={18} /></Link></div></Card>
      )}

      <div className="dashboard-grid">
        <Card className="circle-summary">
          <div className="card-heading"><div><span className="eyebrow"><UsersRound size={15} />{t("home.peopleTrust")}</span><h2>{t("nav.circle")}</h2></div><Link href="/circle" aria-label={t("nav.circle")}><ArrowRight size={19} /></Link></div>
          <p>{t("home.notified")}</p>
          <div className="contact-strip">{viewers.map((contact) => <div key={contact.id}><Avatar initials={contact.initials} color={contact.color} /><span><strong>{contact.name}</strong><small>{contact.relationship}</small></span><span className="contact-state"><Bell size={14} />{t("common.active")}</span></div>)}</div>
        </Card>
        <Card className="emergency-summary"><span className="emergency-soft-icon"><PhoneCall size={23} /></span><h2>{t("home.quickEmergency")}</h2><p>{t("home.quickEmergencyText")}</p><Link href="/emergency" className="button button-secondary button-md">{t("home.openEmergency")}<ArrowRight size={17} /></Link></Card>
      </div>

      <Card className="recent-section">
        <div className="card-heading"><div><span className="eyebrow"><Clock3 size={15} />{t("home.recent")}</span><h2>{t("home.recent")}</h2></div><Link href="/journeys">{t("home.viewAll")}<ArrowRight size={16} /></Link></div>
        <div className="journey-mini-list">{state.history.slice(0, 2).map((journey) => <Link href={`/journeys/${journey.id}`} key={journey.id}><span className="journey-icon"><MapPin size={18} /></span><span><strong>{journey.destination}</strong><small>{new Intl.DateTimeFormat(state.user.language, { dateStyle: "medium" }).format(new Date(journey.startedAt))} · {t(`travel.${journey.travelType}` as Parameters<typeof t>[0])}</small></span><StatusBadge status={journey.status} /></Link>)}</div>
      </Card>

      <div className="tip-card"><Lightbulb size={21} /><div><strong>{t("home.tipTitle")}</strong><p>{t("home.tipText")}</p></div></div>
    </div>
  );
}
