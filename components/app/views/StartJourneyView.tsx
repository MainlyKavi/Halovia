"use client";

import { useState } from "react";
import Link from "next/link";
import { Camera, CarFront, Check, ChevronLeft, ChevronRight, Clock3, FileImage, MapPin, Navigation, ShieldCheck, UsersRound } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { Avatar, Button, Card, Field, SelectInput, TextArea, TextInput } from "@/components/ui/Primitives";
import type { Journey, TravelType } from "@/lib/types";

export function StartJourneyView() {
  const { state, t, setActiveJourney, showToast } = useApp();
  const [step, setStep] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [imageName, setImageName] = useState("");
  const [form, setForm] = useState({
    origin: "Home · Indiranagar", destination: "", eta: "2026-07-16T20:00", travelType: "cab" as TravelType,
    vehicleNumber: "", driverName: "", note: "", contactIds: state.contacts.filter((c) => c.active && c.defaultForJourneys).map((c) => c.id),
  });
  const titles = [t("start.stepRoute"), t("start.stepDetails"), t("start.stepPeople")];

  function next() {
    setError("");
    if (step === 0 && (!form.origin.trim() || !form.destination.trim())) { setError(t("start.required")); return; }
    if (step < 2) setStep(step + 1);
  }
  function start() {
    if (!form.contactIds.length) { setError(t("start.chooseOne")); return; }
    const now = new Date();
    const eta = new Date(form.eta);
    const journey: Journey = {
      id: `journey-${Date.now()}`, origin: form.origin, destination: form.destination, startedAt: now.toISOString(), eta: eta.toISOString(),
      durationMinutes: Math.max(10, Math.round((eta.getTime() - now.getTime()) / 60_000)), travelType: form.travelType, status: "journeyStarted",
      contactIds: form.contactIds, safetyCheckOccurred: false, alertTriggered: false, progress: 4, vehicleNumber: form.vehicleNumber || undefined,
      driverName: form.driverName || undefined, note: form.note || undefined, events: [{ id: `event-${Date.now()}`, type: "journeyStarted", timestamp: now.toISOString() }],
    };
    setActiveJourney(journey); setConfirmed(true); showToast(t("status.journeyStarted"));
  }

  if (confirmed) {
    const selected = state.contacts.filter((c) => form.contactIds.includes(c.id));
    return <div className="view-stack narrow-view"><Card className="journey-confirmation"><span className="success-orbit"><ShieldCheck size={34} /></span><h1>{t("start.confirmTitle")}</h1><p>{t("start.confirmText")}</p><div className="confirmation-people">{selected.map((contact) => <div key={contact.id}><Avatar initials={contact.initials} color={contact.color} /><span><strong>{contact.name}</strong><small>{contact.relationship}</small></span><Check size={18} /></div>)}</div><div className="privacy-note"><ShieldCheck size={18} />{t("start.privacy")}</div><Link href="/active" className="button button-primary button-lg">{t("start.goLive")}<ChevronRight size={18} /></Link></Card></div>;
  }

  return <div className="view-stack narrow-view">
    <header className="view-heading"><div><p className="eyebrow"><Navigation size={15} />{t("home.startJourney")}</p><h1>{t("start.title")}</h1><p>{t("start.subtitle")}</p></div></header>
    <div className="setup-progress">{titles.map((title, index) => <div key={title} className={index <= step ? "active" : ""}><span>{index < step ? <Check size={14} /> : index + 1}</span><small>{title}</small></div>)}</div>
    <Card className="setup-card">
      {step === 0 && <div className="form-grid">
        <Field label={t("start.currentLocation")}><div className="input-icon-wrap"><MapPin size={18} /><TextInput value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} placeholder={t("start.currentPlaceholder")} /></div></Field>
        <Field label={t("start.destination")}><div className="input-icon-wrap"><Navigation size={18} /><TextInput value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} placeholder={t("start.destinationPlaceholder")} /></div></Field>
        <Field label={t("start.eta")}><div className="input-icon-wrap"><Clock3 size={18} /><TextInput type="datetime-local" value={form.eta} onChange={(e) => setForm({ ...form, eta: e.target.value })} /></div></Field>
        <Field label={t("start.travelType")}><SelectInput value={form.travelType} onChange={(e) => setForm({ ...form, travelType: e.target.value as TravelType })}>{(["cab", "walking", "publicTransport", "driving", "other"] as TravelType[]).map((type) => <option key={type} value={type}>{t(`travel.${type}` as Parameters<typeof t>[0])}</option>)}</SelectInput></Field>
      </div>}
      {step === 1 && <div className="details-step"><div className="section-inline-heading"><span className="feature-icon"><CarFront size={22} /></span><div><h2>{t("start.vehicleTitle")} <small>{t("common.optional")}</small></h2><p>{t("start.vehicleText")}</p></div></div><div className="form-grid two-col"><Field label={t("start.vehicleNumber")}><TextInput value={form.vehicleNumber} onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })} /></Field><Field label={t("start.driverName")}><TextInput value={form.driverName} onChange={(e) => setForm({ ...form, driverName: e.target.value })} /></Field></div><Field label={t("start.note")}><TextArea rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={t("start.notePlaceholder")} /></Field><label className="upload-card"><input type="file" accept="image/*" onChange={(e) => setImageName(e.target.files?.[0]?.name ?? "")} /><span>{imageName ? <FileImage size={25} /> : <Camera size={25} />}</span><div><strong>{imageName || t("start.upload")}</strong><small>{imageName ? t("start.imageReady") : t("start.vehicleText")}</small></div></label></div>}
      {step === 2 && <div className="people-step"><div className="section-inline-heading"><span className="feature-icon"><UsersRound size={22} /></span><div><h2>{t("start.selectContacts")}</h2><p>{t("start.privacy")}</p></div></div><div className="select-contact-list">{state.contacts.filter((c) => c.active).map((contact) => { const checked = form.contactIds.includes(contact.id); return <label key={contact.id} className={checked ? "checked" : ""}><input type="checkbox" checked={checked} onChange={(e) => setForm({ ...form, contactIds: e.target.checked ? [...form.contactIds, contact.id] : form.contactIds.filter((id) => id !== contact.id) })} /><Avatar initials={contact.initials} color={contact.color} /><span><strong>{contact.name}</strong><small>{contact.relationship}</small></span><span className="round-check">{checked && <Check size={15} />}</span></label>; })}</div></div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="setup-actions">{step > 0 ? <Button variant="ghost" onClick={() => { setStep(step - 1); setError(""); }}><ChevronLeft size={18} />{t("common.back")}</Button> : <Link href="/home" className="button button-ghost button-md">{t("common.cancel")}</Link>}{step < 2 ? <Button size="lg" onClick={next}>{t("common.continue")}<ChevronRight size={18} /></Button> : <Button size="lg" onClick={start}><ShieldCheck size={19} />{t("start.final")}</Button>}</div>
    </Card>
  </div>;
}
