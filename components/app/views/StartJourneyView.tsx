"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Camera, CarFront, Check, ChevronLeft, ChevronRight, Clock3, FileImage, MapPin, Navigation, ShieldCheck, Trash2, UsersRound } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { selectableTravelTypes, TransportIcon } from "@/components/app/TransportIcon";
import { Avatar, Button, Card, EmptyState, Field, TextArea, TextInput } from "@/components/ui/Primitives";
import { toDateTimeLocalValue } from "@/lib/i18n/format";
import { createDefaultEta, createId } from "@/lib/state/app-state";
import { saveVehicleImage, validateVehicleImage } from "@/lib/storage/vehicle-images";
import type { Journey, TravelType } from "@/lib/types";

interface LocalImagePreview {
  name: string;
  url: string;
  file: File;
}

export function StartJourneyView() {
  const { state, t, setActiveJourney, showToast } = useApp();
  const [step, setStep] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [image, setImage] = useState<LocalImagePreview | null>(null);
  const [form, setForm] = useState(() => ({
    origin: "",
    destination: "",
    eta: toDateTimeLocalValue(new Date(createDefaultEta())),
    travelType: "cab" as TravelType,
    vehicleNumber: "",
    driverName: "",
    vehicleDescription: "",
    note: "",
    contactIds: state.contacts.filter((contact) => contact.active && contact.defaultForJourneys).map((contact) => contact.id),
  }));
  const titles = [t("start.stepRoute"), t("start.stepDetails"), t("start.stepPeople")];

  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url); }, [image]);

  if (state.activeJourney && !confirmed) {
    return <div className="view-stack narrow-view"><EmptyState icon={<Navigation size={26} />} title={t("start.activeJourneyTitle")} text={t("start.activeJourneyText")} action={<Link href="/active" className="button button-primary button-md">{t("start.activeJourneyAction")}</Link>} /></div>;
  }

  function next() {
    setError("");
    if (step === 0) {
      if (!form.origin.trim() || !form.destination.trim()) { setError(t("start.required")); return; }
      const eta = new Date(form.eta);
      if (!Number.isFinite(eta.getTime()) || eta.getTime() <= Date.now()) { setError(t("start.etaFuture")); return; }
    }
    if (step < 2) setStep((current) => current + 1);
  }

  function selectImage(file: File | undefined) {
    setError("");
    if (!file) return;
    const validationError = validateVehicleImage(file);
    if (validationError === "type") { setError(t("start.imageTypeError")); return; }
    if (validationError === "size") { setError(t("start.imageSizeError")); return; }
    if (image) URL.revokeObjectURL(image.url);
    setImage({ name: file.name, url: URL.createObjectURL(file), file });
  }

  function removeImage() {
    if (image) URL.revokeObjectURL(image.url);
    setImage(null);
  }

  async function start() {
    setError("");
    const now = new Date();
    const eta = new Date(form.eta);
    if (!Number.isFinite(eta.getTime()) || eta.getTime() <= now.getTime()) { setStep(0); setError(t("start.etaFuture")); return; }
    const journeyId = createId("journey");
    const timestamp = now.toISOString();
    if (image) {
      try {
        await saveVehicleImage(journeyId, image.file);
      } catch {
        setError(t("start.imageStorageError"));
        return;
      }
    }
    const journey: Journey = {
      id: journeyId,
      origin: form.origin.trim(),
      destination: form.destination.trim(),
      startedAt: timestamp,
      eta: eta.toISOString(),
      durationMinutes: Math.max(1, Math.round((eta.getTime() - now.getTime()) / 60_000)),
      travelType: form.travelType,
      status: "journeyStarted",
      contactIds: form.contactIds,
      safetyCheckOccurred: false,
      prototypeEscalationTriggered: false,
      progress: 0,
      vehicleNumber: form.vehicleNumber.trim() || undefined,
      driverName: form.driverName.trim() || undefined,
      vehicleDescription: form.vehicleDescription.trim() || undefined,
      note: form.note.trim() || undefined,
      vehicleImageId: image ? journeyId : undefined,
      vehicleImageName: image?.name,
      lastLocationUpdateAt: timestamp,
      connectionStatus: "online",
      emergencyState: "none",
      events: [{ id: createId("event"), type: "journeyStarted", timestamp }],
    };
    setActiveJourney(journey);
    setConfirmed(true);
    showToast(t("status.journeyStarted"));
  }

  if (confirmed) {
    const selected = state.contacts.filter((contact) => form.contactIds.includes(contact.id));
    return <div className="view-stack narrow-view"><Card className="journey-confirmation"><span className="success-orbit"><ShieldCheck size={34} /></span><h1>{t("start.confirmTitle")}</h1><p>{selected.length ? t("start.confirmText") : t("start.confirmNoContacts")}</p>{selected.length > 0 && <div className="confirmation-people">{selected.map((contact) => <div key={contact.id}><Avatar initials={contact.initials} color={contact.color} /><span><strong>{contact.name}</strong><small>{contact.relationship || t("circle.relationshipUnknown")}</small></span><Check size={18} /></div>)}</div>}<div className="privacy-note"><ShieldCheck size={18} />{t("start.confirmPrototype")}</div><Link href="/active" className="button button-primary button-lg">{t("start.goLive")}<ChevronRight size={18} /></Link></Card></div>;
  }

  return <div className="view-stack narrow-view">
    <header className="view-heading"><div><p className="eyebrow"><Navigation size={15} />{t("home.startJourney")}</p><h1>{t("start.title")}</h1><p>{t("start.subtitle")}</p></div></header>
    <div className="setup-progress">{titles.map((title, index) => <div key={title} className={index <= step ? "active" : ""}><span>{index < step ? <Check size={14} /> : index + 1}</span><small>{title}</small></div>)}</div>
    <Card className="setup-card">
      {step === 0 && <div className="form-grid">
        <Field label={t("start.currentLocation")} hint={t("start.currentHint")}><div className="input-icon-wrap"><MapPin size={18} /><TextInput value={form.origin} onChange={(event) => setForm({ ...form, origin: event.target.value })} placeholder={t("start.currentPlaceholder")} /></div></Field>
        <Field label={t("start.destination")}><div className="input-icon-wrap"><Navigation size={18} /><TextInput value={form.destination} onChange={(event) => setForm({ ...form, destination: event.target.value })} placeholder={t("start.destinationPlaceholder")} /></div></Field>
        <Field label={t("start.eta")} hint={t("start.etaHint")}><div className="input-icon-wrap"><Clock3 size={18} /><TextInput type="datetime-local" value={form.eta} min={toDateTimeLocalValue(new Date())} onChange={(event) => setForm({ ...form, eta: event.target.value })} /></div></Field>
        <fieldset className="field transport-fieldset"><legend className="field-label">{t("start.travelType")}</legend><div className="transport-grid">{selectableTravelTypes.map((type) => { const selected = form.travelType === type; return <button key={type} type="button" className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => setForm({ ...form, travelType: type })}><span className="transport-icon"><TransportIcon type={type} size={22} /></span><span>{t(`travel.${type}` as Parameters<typeof t>[0])}</span>{selected && <Check className="transport-check" size={16} />}</button>; })}</div></fieldset>
      </div>}
      {step === 1 && <div className="details-step"><div className="section-inline-heading"><span className="feature-icon"><CarFront size={22} /></span><div><h2>{t("start.vehicleTitle")} <small>{t("common.optional")}</small></h2><p>{t("start.vehicleText")}</p></div></div><div className="form-grid two-col"><Field label={t("start.vehicleNumber")}><TextInput value={form.vehicleNumber} onChange={(event) => setForm({ ...form, vehicleNumber: event.target.value })} /></Field><Field label={t("start.driverName")}><TextInput value={form.driverName} onChange={(event) => setForm({ ...form, driverName: event.target.value })} /></Field></div><Field label={t("start.vehicleDescription")}><TextInput value={form.vehicleDescription} onChange={(event) => setForm({ ...form, vehicleDescription: event.target.value })} placeholder={t("start.vehicleDescriptionPlaceholder")} /></Field><Field label={t("start.note")}><TextArea rows={3} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder={t("start.notePlaceholder")} /></Field>{image ? <div className="image-preview-card"><Image unoptimized width={640} height={360} src={image.url} alt={t("start.imagePreviewAlt")} /><div><FileImage size={22} /><span><strong>{image.name}</strong><small>{t("start.imageStoredLocally")}</small></span></div><div><label className="button button-secondary button-sm"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectImage(event.target.files?.[0])} />{t("start.replaceImage")}</label><Button variant="ghost" size="sm" onClick={removeImage}><Trash2 size={17} />{t("common.remove")}</Button></div></div> : <label className="upload-card"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectImage(event.target.files?.[0])} /><span><Camera size={25} /></span><div><strong>{t("start.upload")}</strong><small>{t("start.imageRules")}</small></div></label>}<p className="field-hint">{t("start.imageLocalDisclosure")}</p><p className="field-hint">{t("start.noOcr")}</p></div>}
      {step === 2 && <div className="people-step"><div className="section-inline-heading"><span className="feature-icon"><UsersRound size={22} /></span><div><h2>{t("start.selectContacts")}</h2><p>{t("start.privacy")}</p></div></div>{state.contacts.filter((contact) => contact.active).length === 0 ? <EmptyState icon={<UsersRound size={26} />} title={t("circle.emptyTitle")} text={t("start.noContactsWarning")} action={<Link href="/circle" className="button button-secondary button-md">{t("circle.add")}</Link>} /> : <div className="select-contact-list">{state.contacts.filter((contact) => contact.active).map((contact) => { const checked = form.contactIds.includes(contact.id); return <label key={contact.id} className={checked ? "checked" : ""}><input type="checkbox" checked={checked} onChange={(event) => setForm({ ...form, contactIds: event.target.checked ? [...form.contactIds, contact.id] : form.contactIds.filter((id) => id !== contact.id) })} /><Avatar initials={contact.initials} color={contact.color} /><span><strong>{contact.name}</strong><small>{contact.relationship || t("circle.relationshipUnknown")}</small></span><span className="round-check">{checked && <Check size={15} />}</span></label>; })}</div>}{form.contactIds.length === 0 && <p className="form-warning">{t("start.noContactsWarning")}</p>}</div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="setup-actions">{step > 0 ? <Button variant="ghost" onClick={() => { setStep((current) => current - 1); setError(""); }}><ChevronLeft size={18} />{t("common.back")}</Button> : <Link href="/home" className="button button-ghost button-md">{t("common.cancel")}</Link>}{step < 2 ? <Button size="lg" onClick={next}>{t("common.continue")}<ChevronRight size={18} /></Button> : <Button size="lg" onClick={() => void start()}><ShieldCheck size={19} />{t("start.final")}</Button>}</div>
    </Card>
  </div>;
}
