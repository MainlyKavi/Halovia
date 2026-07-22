"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Camera, CarFront, Check, ChevronLeft, ChevronRight, Clock3, FileImage, LocateFixed, Navigation, ShieldCheck, Trash2, UsersRound } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { DestinationSearch, type DestinationSelection } from "@/components/app/DestinationSearch";
import { JourneyMap } from "@/components/app/JourneyMap";
import { selectableTravelTypes, TransportIcon } from "@/components/app/TransportIcon";
import { Avatar, Button, Card, EmptyState, Field, TextArea, TextInput } from "@/components/ui/Primitives";
import { formatDistance, formatNumber, formatTime, toDateTimeLocalValue } from "@/lib/i18n/format";
import { createDefaultEta } from "@/lib/state/app-state";
import { validateVehicleImage } from "@/lib/storage/vehicle-images";
import { getCurrentDeviceCoordinate } from "@/lib/geolocation";
import type { DeviceCoordinate } from "@/lib/api-types";
import type { TravelType } from "@/lib/types";

interface LocalImagePreview { name: string; url: string; file: File }

export function StartJourneyView() {
  const { state, backendJourney, backendStatus, t, createBackendJourney, showToast } = useApp();
  const [step, setStep] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [starting, setStarting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [image, setImage] = useState<LocalImagePreview | null>(null);
  const [origin, setOrigin] = useState<DeviceCoordinate | null>(null);
  const [destination, setDestination] = useState<DestinationSelection | null>(null);
  const [routeMetrics, setRouteMetrics] = useState<{ routeEta: string; remainingDistanceMetres: number; durationMinutes: number } | null>(null);
  const [form, setForm] = useState(() => ({
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

  if ((state.activeJourney || backendJourney) && !confirmed) {
    return <div className="view-stack narrow-view"><EmptyState icon={<Navigation size={26} />} title={t("start.activeJourneyTitle")} text={t("start.activeJourneyText")} action={<Link href="/active" className="button button-primary button-md">{t("start.activeJourneyAction")}</Link>} /></div>;
  }

  async function locate() {
    setError("");
    setLocating(true);
    try {
      const coordinate = await getCurrentDeviceCoordinate();
      setOrigin(coordinate);
    } catch (locationError) {
      const code = typeof locationError === "object" && locationError && "code" in locationError ? Number((locationError as { code: number }).code) : 0;
      setError(code === 1 ? t("tracking.permissionRequired") : t("tracking.unavailable"));
    } finally {
      setLocating(false);
    }
  }

  function next() {
    setError("");
    if (step === 0) {
      if (!origin) { setError(t("journey.realLocationRequired")); return; }
      if (!destination) { setError(t("start.required")); return; }
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
    if (backendStatus !== "ready") { setError(t("journey.serverError")); return; }
    if (!origin || !destination) { setStep(0); setError(t("journey.realLocationRequired")); return; }
    const eta = new Date(form.eta);
    if (!Number.isFinite(eta.getTime()) || eta.getTime() <= Date.now()) { setStep(0); setError(t("start.etaFuture")); return; }
    setStarting(true);
    try {
      await createBackendJourney({
        originName: t("start.currentLocation"),
        origin,
        destinationName: destination.name,
        destination,
        safetyEta: eta.toISOString(),
        transportType: form.travelType,
        vehicleNumber: form.vehicleNumber,
        driverName: form.driverName,
        vehicleDescription: form.vehicleDescription,
        notes: form.note,
        contactIds: form.contactIds,
      }, image?.file);
      setConfirmed(true);
      showToast(t("status.journeyStarted"));
    } catch {
      setError(t("journey.serverError"));
    } finally {
      setStarting(false);
    }
  }

  if (confirmed) {
    const selected = state.contacts.filter((contact) => form.contactIds.includes(contact.id));
    return <div className="view-stack narrow-view"><Card className="journey-confirmation"><span className="success-orbit"><ShieldCheck size={34} /></span><h1>{t("start.confirmTitle")}</h1><p>{selected.length ? t("start.confirmText") : t("start.confirmNoContacts")}</p>{selected.length > 0 && <div className="confirmation-people">{selected.map((contact) => <div key={contact.id}><Avatar initials={contact.initials} color={contact.color} /><span><strong>{contact.name}</strong><small>{contact.relationship || t("circle.relationshipUnknown")}</small></span><Check size={18} /></div>)}</div>}<Link href="/active" className="button button-primary button-lg">{t("start.goLive")}<ChevronRight size={18} /></Link></Card></div>;
  }

  return <div className="view-stack narrow-view">
    <header className="view-heading"><div><p className="eyebrow"><Navigation size={15} />{t("home.startJourney")}</p><h1>{t("start.title")}</h1><p>{t("start.subtitle")}</p></div></header>
    <div className="setup-progress">{titles.map((title, index) => <div key={title} className={index <= step ? "active" : ""}><span>{index < step ? <Check size={14} /> : index + 1}</span><small>{title}</small></div>)}</div>
    <Card className="setup-card">
      {step === 0 && <div className="form-grid">
        <Field label={t("start.currentLocation")} hint={t("start.currentHint")}>
          <div className={`current-location-card ${origin ? "confirmed" : ""}`}><LocateFixed size={21} /><span>{origin ? t("start.locationReady", { accuracy: formatNumber(Math.round(origin.accuracy), state.user.locale) }) : t("start.locationNeeded")}</span><Button variant="secondary" size="sm" disabled={locating} onClick={() => void locate()}>{locating ? t("tracking.finding") : origin ? t("map.recenter") : t("onboarding.allowLocation")}</Button></div>
        </Field>
        <Field label={t("start.destination")}><DestinationSearch value={destination} onChange={(selection) => { setDestination(selection); setRouteMetrics(null); }} bias={origin} /></Field>
        {origin && destination && <div className="route-preview-card">
          <JourneyMap compact origin={origin} destination={destination} latest={origin} travelType={form.travelType} onRouteMetrics={setRouteMetrics} />
          {routeMetrics && <div className="route-preview-metrics"><span><small>{t("active.remainingDistance")}</small><strong>{formatDistance(routeMetrics.remainingDistanceMetres, state.user.locale)}</strong></span><span><small>{t("active.routeEta")}</small><strong>{formatTime(routeMetrics.routeEta, state.user.locale)}</strong></span><span><small>{t("home.duration")}</small><strong>{formatNumber(routeMetrics.durationMinutes, state.user.locale)} {t("common.minutes")}</strong></span></div>}
        </div>}
        <Field label={t("start.eta")} hint={t("start.etaHint")}><div className="input-icon-wrap"><Clock3 size={18} /><TextInput type="datetime-local" value={form.eta} min={toDateTimeLocalValue(new Date())} onChange={(event) => setForm({ ...form, eta: event.target.value })} /></div></Field>
        <fieldset className="field transport-fieldset"><legend className="field-label">{t("start.travelType")}</legend><div className="transport-grid">{selectableTravelTypes.map((type) => { const selected = form.travelType === type; return <button key={type} type="button" className={selected ? "selected" : ""} aria-pressed={selected} onClick={() => setForm({ ...form, travelType: type })}><span className="transport-icon"><TransportIcon type={type} size={22} /></span><span>{t(`travel.${type}` as Parameters<typeof t>[0])}</span>{selected && <Check className="transport-check" size={16} />}</button>; })}</div></fieldset>
      </div>}
      {step === 1 && <div className="details-step"><div className="section-inline-heading"><span className="feature-icon"><CarFront size={22} /></span><div><h2>{t("start.vehicleTitle")} <small>{t("common.optional")}</small></h2><p>{t("start.vehicleText")}</p></div></div><div className="form-grid two-col"><Field label={t("start.vehicleNumber")}><TextInput value={form.vehicleNumber} onChange={(event) => setForm({ ...form, vehicleNumber: event.target.value })} /></Field><Field label={t("start.driverName")}><TextInput value={form.driverName} onChange={(event) => setForm({ ...form, driverName: event.target.value })} /></Field></div><Field label={t("start.vehicleDescription")}><TextInput value={form.vehicleDescription} onChange={(event) => setForm({ ...form, vehicleDescription: event.target.value })} placeholder={t("start.vehicleDescriptionPlaceholder")} /></Field><Field label={t("start.note")}><TextArea rows={3} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder={t("start.notePlaceholder")} /></Field>{image ? <div className="image-preview-card"><Image unoptimized width={640} height={360} src={image.url} alt={t("start.imagePreviewAlt")} /><div><FileImage size={22} /><span><strong>{image.name}</strong><small>{t("common.selected")}</small></span></div><div><label className="button button-secondary button-sm"><input type="file" accept="image/*" onChange={(event) => selectImage(event.target.files?.[0])} />{t("start.replaceImage")}</label><Button variant="ghost" size="sm" onClick={removeImage}><Trash2 size={17} />{t("common.remove")}</Button></div></div> : <label className="upload-card"><input type="file" accept="image/*" onChange={(event) => selectImage(event.target.files?.[0])} /><span><Camera size={25} /></span><div><strong>{t("start.upload")}</strong><small>{t("start.imageRules")}</small></div></label>}<p className="field-hint">{t("start.imageLocalDisclosure")}</p></div>}
      {step === 2 && <div className="people-step"><div className="section-inline-heading"><span className="feature-icon"><UsersRound size={22} /></span><div><h2>{t("start.selectContacts")}</h2><p>{t("sharing.manualNote")}</p></div></div>{state.contacts.filter((contact) => contact.active).length === 0 ? <EmptyState icon={<UsersRound size={26} />} title={t("circle.emptyTitle")} text={t("start.noContactsWarning")} action={<Link href="/circle" className="button button-secondary button-md">{t("circle.add")}</Link>} /> : <div className="select-contact-list">{state.contacts.filter((contact) => contact.active).map((contact) => { const checked = form.contactIds.includes(contact.id); return <label key={contact.id} className={checked ? "checked" : ""}><input type="checkbox" checked={checked} onChange={(event) => setForm({ ...form, contactIds: event.target.checked ? [...form.contactIds, contact.id] : form.contactIds.filter((id) => id !== contact.id) })} /><Avatar initials={contact.initials} color={contact.color} /><span><strong>{contact.name}</strong><small>{contact.relationship || t("circle.relationshipUnknown")}</small></span><span className="round-check">{checked && <Check size={15} />}</span></label>; })}</div>}{form.contactIds.length === 0 && <p className="form-warning">{t("start.noContactsWarning")}</p>}</div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="setup-actions">{step > 0 ? <Button variant="ghost" onClick={() => { setStep((current) => current - 1); setError(""); }}><ChevronLeft size={18} />{t("common.back")}</Button> : <Link href="/home" className="button button-ghost button-md">{t("common.cancel")}</Link>}{step < 2 ? <Button size="lg" onClick={next}>{t("common.continue")}<ChevronRight size={18} /></Button> : <Button size="lg" disabled={starting} onClick={() => void start()}><ShieldCheck size={19} />{starting ? t("journey.starting") : t("start.final")}</Button>}</div>
    </Card>
  </div>;
}
