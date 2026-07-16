"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock3, MapPin, ShieldCheck, UsersRound } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { Avatar, Card, EmptyState, StatusBadge } from "@/components/ui/Primitives";
import { RouteMap } from "@/components/app/RouteMap";

export function JourneyDetailView({ id }: { id: string }) {
  const { state, t } = useApp();
  const journey = state.history.find((item) => item.id === id) ?? (state.activeJourney?.id === id ? state.activeJourney : null);
  if (!journey) return <Card><EmptyState icon={<MapPin size={28} />} title={t("journeys.emptyTitle")} text={t("journeys.emptyText")} action={<Link href="/journeys" className="button button-primary button-md">{t("common.back")}</Link>} /></Card>;
  const contacts = state.contacts.filter((contact) => journey.contactIds.includes(contact.id));
  return <div className="view-stack detail-view"><Link href="/journeys" className="back-link"><ArrowLeft size={17} />{t("common.back")}</Link><header className="view-heading"><div><p className="eyebrow"><MapPin size={15} />{t("journeys.details")}</p><h1>{journey.destination}</h1><p>{journey.origin} → {journey.destination}</p></div><StatusBadge status={journey.status} /></header><Card className="detail-route"><RouteMap compact progress={journey.progress} /><div className="detail-stats"><span><CalendarDays size={17} /><small>{t("journeys.details")}</small><strong>{new Intl.DateTimeFormat(state.user.language, { dateStyle: "medium" }).format(new Date(journey.startedAt))}</strong></span><span><Clock3 size={17} /><small>{t("home.duration")}</small><strong>{journey.durationMinutes} {t("common.minutes")}</strong></span><span><ShieldCheck size={17} /><small>{t("journeys.safetyCheck")}</small><strong>{journey.safetyCheckOccurred ? t("common.yes") : t("common.no")}</strong></span></div></Card><div className="detail-grid"><Card><h2><UsersRound size={19} />{t("journeys.contacts")}</h2><div className="confirmation-people">{contacts.map((contact) => <div key={contact.id}><Avatar initials={contact.initials} color={contact.color} /><span><strong>{contact.name}</strong><small>{contact.relationship}</small></span></div>)}</div></Card><Card><h2><Clock3 size={19} />{t("journeys.timeline")}</h2><ol className="timeline">{journey.events.map((event) => <li key={event.id}><span /><div><strong>{t(`status.${event.type}` as Parameters<typeof t>[0])}</strong><small>{new Intl.DateTimeFormat(state.user.language, { hour: "numeric", minute: "2-digit" }).format(new Date(event.timestamp))}</small></div></li>)}</ol></Card></div></div>;
}
