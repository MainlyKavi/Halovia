"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Bell, Clock3, Lightbulb, MapPin, Navigation, PhoneCall, ShieldCheck, UsersRound } from "lucide-react";
import { EndJourneyDialog } from "@/components/app/EndJourneyDialog";
import { useApp } from "@/components/app/AppProvider";
import { RouteMap } from "@/components/app/RouteMap";
import { TransportIcon } from "@/components/app/TransportIcon";
import { Avatar, Button, Card, EmptyState, Progress, StatusBadge } from "@/components/ui/Primitives";
import { formatDate, formatTime } from "@/lib/i18n/format";

export function HomeView() {
  const { state, t, recordSafeCheckIn, showToast } = useApp();
  const [endOpen, setEndOpen] = useState(false);
  const active = state.activeJourney;
  const selectedContacts = active ? state.contacts.filter((contact) => active.contactIds.includes(contact.id)) : state.contacts.filter((contact) => contact.active);
  const greeting = state.user.name ? t("home.hello", { name: state.user.name }) : t("home.helloGeneric");

  function safeCheckIn() {
    recordSafeCheckIn();
    showToast(t("safety.safeRecorded"));
  }

  return (
    <div className="view-stack">
      <header className="view-heading"><div><p className="eyebrow">{active ? t("home.activeEyebrow") : t("home.calm")}</p><h1>{greeting}</h1></div>{active && <StatusBadge status={active.status} />}</header>

      {active ? (
        <Card className="active-home-card">
          <div className="active-home-top"><span className="destination-icon"><Navigation size={20} /></span><div><small>{t("home.destination")}</small><h2>{active.destination}</h2></div></div>
          <RouteMap compact journey={active} />
          <Progress value={active.progress} label={t("active.estimatedProgress")} />
          <div className="active-meta"><span><Clock3 size={18} /><small>{t("home.eta")}</small><strong>{formatTime(active.eta, state.user.locale)}</strong></span><span><ShieldCheck size={18} /><small>{t("active.safetyStatus")}</small><strong>{t(`status.${active.status}` as Parameters<typeof t>[0])}</strong></span><span><UsersRound size={18} /><small>{t("active.selectedContacts")}</small><strong>{selectedContacts.length}</strong></span></div>
          <div className="active-actions"><Button variant="safe" size="lg" onClick={safeCheckIn}><ShieldCheck size={20} />{t("home.imSafe")}</Button><Link href="/active" className="button button-primary button-lg">{t("home.openJourney")}<ArrowRight size={18} /></Link><Button variant="ghost" onClick={() => setEndOpen(true)}>{t("home.endJourney")}</Button></div>
        </Card>
      ) : (
        <Card className="start-home-card"><div className="start-visual"><span className="start-halo"><MapPin size={26} /></span><span className="route-dots" /></div><div><h2>{t("home.noActiveTitle")}</h2><p>{t("home.noActiveText")}</p><Link href="/start" className="button button-primary button-lg">{t("home.startJourney")}<ArrowRight size={18} /></Link></div></Card>
      )}

      <div className="dashboard-grid">
        <Card className="circle-summary">
          <div className="card-heading"><div><span className="eyebrow"><UsersRound size={15} />{t("home.peopleTrust")}</span><h2>{t("nav.circle")}</h2></div><Link href="/circle" aria-label={t("nav.circle")}><ArrowRight size={19} /></Link></div>
          <p>{t("home.contactsLocalCopy")}</p>
          {selectedContacts.length ? <div className="contact-strip">{selectedContacts.map((contact) => <div key={contact.id}><Avatar initials={contact.initials} color={contact.color} /><span><strong>{contact.name}</strong><small>{contact.relationship || t("circle.relationshipUnknown")}</small></span><span className="contact-state"><Bell size={14} />{active ? t("common.selected") : t("common.active")}</span></div>)}</div> : <EmptyState icon={<UsersRound size={24} />} title={t("circle.emptyTitle")} text={t("home.noContactsText")} action={<Link href="/circle" className="button button-secondary button-md">{t("circle.add")}</Link>} />}
        </Card>
        <Card className="emergency-summary"><span className="emergency-soft-icon"><PhoneCall size={23} /></span><h2>{t("home.quickEmergency")}</h2><p>{t("home.quickEmergencyText")}</p><Link href="/emergency" className="button button-secondary button-md">{t("home.openEmergency")}<ArrowRight size={17} /></Link></Card>
      </div>

      <Card className="recent-section">
        <div className="card-heading"><div><span className="eyebrow"><Clock3 size={15} />{t("home.recent")}</span><h2>{t("home.recent")}</h2></div>{state.history.length > 0 && <Link href="/journeys">{t("home.viewAll")}<ArrowRight size={16} /></Link>}</div>
        {state.history.length === 0 ? <EmptyState icon={<Clock3 size={24} />} title={t("journeys.emptyTitle")} text={t("journeys.emptyText")} /> : <div className="journey-mini-list">{state.history.slice(0, 2).map((journey) => <Link href={`/journeys/${journey.id}`} key={journey.id}><span className="journey-icon"><TransportIcon type={journey.travelType} size={18} /></span><span><strong>{journey.destination}</strong><small>{formatDate(journey.startedAt, state.user.locale, state.user.dateFormat)} · {t(`travel.${journey.travelType}` as Parameters<typeof t>[0])}</small></span><StatusBadge status={journey.status} /></Link>)}</div>}
      </Card>

      <div className="tip-card"><Lightbulb size={21} /><div><strong>{t("home.tipTitle")}</strong><p>{t("home.tipText")}</p></div></div>
      <EndJourneyDialog open={endOpen} onClose={() => setEndOpen(false)} />
    </div>
  );
}
