"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, CalendarDays, ChevronRight, Clock3, History, ShieldCheck, Trash2 } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { TransportIcon } from "@/components/app/TransportIcon";
import { Button, Card, Dialog, EmptyState, StatusBadge } from "@/components/ui/Primitives";
import { formatDateTime, formatDuration } from "@/lib/i18n/format";
import { deleteVehicleImage } from "@/lib/storage/vehicle-images";

export function JourneysView() {
  const { state, t, updateState, showToast } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);
  async function clearHistory() {
    await Promise.all(state.history.map((journey) => journey.vehicleImageId ? deleteVehicleImage(journey.vehicleImageId).catch(() => undefined) : Promise.resolve()));
    updateState((current) => ({ ...current, history: [] }));
    setConfirmDelete(false);
    showToast(t("journeys.deleted"));
  }
  return <div className="view-stack">
    <header className="view-heading"><div><p className="eyebrow"><History size={15} />{t("nav.journeys")}</p><h1>{t("journeys.title")}</h1><p>{t("journeys.subtitle")}</p></div>{state.history.length > 0 && <Button variant="ghost" onClick={() => setConfirmDelete(true)}><Trash2 size={17} />{t("journeys.deleteHistory")}</Button>}</header>
    {state.history.length === 0 ? <Card><EmptyState icon={<History size={28} />} title={t("journeys.emptyTitle")} text={t("journeys.emptyText")} action={<Link href="/start" className="button button-primary button-md">{t("home.startJourney")}</Link>} /></Card> : <div className="history-list">{state.history.map((journey) => <Link href={`/journeys/${journey.id}`} key={journey.id} className="history-card"><span className="journey-icon"><TransportIcon type={journey.travelType} /></span><div className="history-main"><div><h2>{journey.destination}</h2><StatusBadge status={journey.status} /></div><p>{journey.origin} → {journey.destination}</p><div className="history-meta"><span><CalendarDays size={15} />{formatDateTime(journey.startedAt, state.user.locale, state.user.dateFormat)}</span><span><Clock3 size={15} />{formatDuration(journey.durationMinutes, state.user.locale, { hours: t("common.hours"), minutes: t("common.minutes") })}</span><span><TransportIcon type={journey.travelType} size={14} />{t(`travel.${journey.travelType}` as Parameters<typeof t>[0])}</span></div><div className="history-signals">{journey.safetyCheckOccurred && <span><ShieldCheck size={14} />{t("journeys.safetyCheck")}</span>}{journey.prototypeEscalationTriggered && <span className="warning"><AlertTriangle size={14} />{t("journeys.prototypeEscalation")}</span>}</div></div><ChevronRight size={19} /></Link>)}</div>}
    <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title={t("journeys.deleteTitle")} description={t("journeys.deleteText")}><div className="dialog-actions"><Button variant="ghost" onClick={() => setConfirmDelete(false)}>{t("common.cancel")}</Button><Button variant="danger" onClick={() => void clearHistory()}>{t("common.delete")}</Button></div></Dialog>
  </div>;
}
