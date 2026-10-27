"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Check, ChevronLeft, ChevronRight, Globe2, LocateFixed, PartyPopper, Plus, ShieldCheck, Sparkles, Trash2, UserRound, UsersRound } from "lucide-react";
import { ContactEditor, createBlankContact } from "@/components/app/ContactEditor";
import { useApp } from "@/components/app/AppProvider";
import { Avatar, Button, Card, Dialog, LanguageSelector, TextInput, ThemeSelector } from "@/components/ui/Primitives";
import { Logo } from "@/components/ui/Logo";
import type { TrustedContact } from "@/lib/types";

export function OnboardingFlow() {
  const { state, t, updateState, saveContact, removeContact, showToast } = useApp();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(state.user.name);
  const [permissionState, setPermissionState] = useState<"idle" | "success" | "error">("idle");
  const [editing, setEditing] = useState<TrustedContact | null>(null);
  const [error, setError] = useState("");
  const [confirmedNoContacts, setConfirmedNoContacts] = useState(false);
  const total = 8;

  const steps = [
    { icon: Sparkles, title: t("onboarding.welcomeTitle"), text: t("onboarding.welcomeText"), content: <div className="welcome-visual"><div className="large-logo"><Logo compact /></div><div className="welcome-route"><span /><span /><span /></div></div> },
    { icon: Globe2, title: t("onboarding.languageTitle"), text: t("onboarding.languageText"), content: <LanguageSelector /> },
    { icon: ShieldCheck, title: t("onboarding.themeTitle"), text: t("onboarding.themeText"), content: <ThemeSelector /> },
    { icon: UserRound, title: t("onboarding.nameTitle"), text: t("onboarding.nameText"), content: <label className="field"><span className="field-label">{t("onboarding.nameLabel")}</span><TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder={t("onboarding.namePlaceholder")} autoComplete="name" /></label> },
    { icon: UsersRound, title: t("onboarding.contactsTitle"), text: t("onboarding.contactsText"), content: <div className="onboarding-contact-editor"><Button variant="secondary" onClick={() => setEditing(createBlankContact(state.contacts.length))}><Plus size={18} />{t("circle.add")}</Button>{state.contacts.length === 0 ? <div className="onboarding-empty-contacts"><UsersRound size={25} /><p>{t("onboarding.contactsEmpty")}</p></div> : <div className="onboarding-contacts">{state.contacts.map((contact) => <div key={contact.id}><Avatar initials={contact.initials} color={contact.color} /><span><strong>{contact.name}</strong><small>{contact.phone}</small></span><button type="button" onClick={() => setEditing(contact)}>{t("common.edit")}</button><button type="button" onClick={() => removeContact(contact.id)} aria-label={`${t("common.remove")} ${contact.name}`}><Trash2 size={17} /></button></div>)}</div>}{confirmedNoContacts && state.contacts.length === 0 && <p className="form-warning" role="alert">{t("onboarding.noContactsWarning")}</p>}</div> },
    { icon: LocateFixed, title: t("onboarding.locationTitle"), text: t("onboarding.locationText"), content: <PermissionAction type="location" status={permissionState} setStatus={setPermissionState} /> },
    { icon: BellRing, title: t("onboarding.notificationsTitle"), text: t("onboarding.notificationsText"), content: <PermissionAction type="notifications" status={permissionState} setStatus={setPermissionState} /> },
    { icon: PartyPopper, title: t("onboarding.readyTitle"), text: t("onboarding.readyText"), content: <div className="ready-summary"><span><Check size={18} />{t("settings.language")}: {t(`language.${state.user.language}` as Parameters<typeof t>[0])}</span><span><Check size={18} />{t("settings.theme")}: {t(`theme.${state.user.theme}` as Parameters<typeof t>[0])}</span><span><Check size={18} />{state.contacts.filter((contact) => contact.active).length} {t("onboarding.contactsCount")}</span></div> },
  ];
  const current = steps[step];
  const Icon = current.icon;

  function next() {
    setError("");
    if (step === 3) {
      const trimmedName = name.trim();
      if (!trimmedName) { setError(t("onboarding.nameRequired")); return; }
      updateState((currentState) => ({ ...currentState, user: { ...currentState.user, name: trimmedName } }));
    }
    if (step === 4 && state.contacts.length === 0 && !confirmedNoContacts) {
      setConfirmedNoContacts(true);
      return;
    }
    setPermissionState("idle");
    if (step < total - 1) setStep((currentStep) => currentStep + 1);
    else {
      updateState((currentState) => ({ ...currentState, user: { ...currentState.user, name: name.trim(), onboardingComplete: true } }));
      showToast(t("onboarding.completeToast"));
      router.push("/home");
    }
  }

  return (
    <main className="onboarding-page">
      <header className="onboarding-header"><Logo /><span>{t("onboarding.progress", { current: step + 1, total })}</span></header>
      <div className="onboarding-progress" role="progressbar" aria-label={t("onboarding.progress", { current: step + 1, total })} aria-valuemin={1} aria-valuemax={total} aria-valuenow={step + 1}><span style={{ width: `${((step + 1) / total) * 100}%` }} /></div>
      <section className="onboarding-shell">
        <Card className="onboarding-card">
          <div className="onboarding-icon"><Icon size={24} /></div>
          <div className="onboarding-heading"><h1>{current.title}</h1><p>{current.text}</p></div>
          <div className="onboarding-content">{current.content}</div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="onboarding-actions">
            {step > 0 ? <Button variant="ghost" onClick={() => { setStep((currentStep) => currentStep - 1); setPermissionState("idle"); setError(""); }}><ChevronLeft size={18} />{t("common.back")}</Button> : <span />}
            <div>{(step === 5 || step === 6) && <Button variant="ghost" onClick={next}>{t("common.skip")}</Button>}<Button size="lg" onClick={next}>{step === total - 1 ? t("onboarding.finish") : t("common.continue")}<ChevronRight size={18} /></Button></div>
          </div>
        </Card>
      </section>
      <Dialog open={Boolean(editing)} title={editing && state.contacts.some((contact) => contact.id === editing.id) ? t("circle.editTitle") : t("circle.addTitle")} onClose={() => setEditing(null)}>{editing && <ContactEditor key={editing.id} contact={editing} onCancel={() => setEditing(null)} onSave={(contact) => { saveContact(contact); setEditing(null); setConfirmedNoContacts(false); }} />}</Dialog>
    </main>
  );
}

function PermissionAction({ type, status, setStatus }: { type: "location" | "notifications"; status: "idle" | "success" | "error"; setStatus: (status: "idle" | "success" | "error") => void }) {
  const { t, updateState } = useApp();
  async function requestPermission() {
    if (type === "location") {
      if (!navigator.geolocation) { setStatus("error"); return; }
      navigator.geolocation.getCurrentPosition(
        () => { setStatus("success"); updateState((state) => ({ ...state, privacy: { ...state.privacy, locationWhileActive: true } })); },
        () => setStatus("error"),
        { timeout: 7000 },
      );
    } else {
      if (!("Notification" in window)) { setStatus("error"); return; }
      const result = await Notification.requestPermission();
      if (result === "granted") { setStatus("success"); updateState((state) => ({ ...state, privacy: { ...state.privacy, notifications: true } })); }
      else setStatus("error");
    }
  }
  const Icon = type === "location" ? LocateFixed : BellRing;
  return <div className={`permission-card ${status}`}><span className="permission-art"><Icon size={32} /></span>{status === "idle" && <Button size="lg" onClick={requestPermission}>{type === "location" ? t("onboarding.allowLocation") : t("onboarding.enableNotifications")}</Button>}{status === "success" && <p><Check size={20} />{type === "location" ? t("onboarding.locationAllowed") : t("onboarding.notificationsEnabled")}</p>}{status === "error" && <><p>{type === "location" ? t("onboarding.locationDenied") : t("onboarding.notificationsDenied")}</p><Button variant="secondary" onClick={requestPermission}>{type === "location" ? t("onboarding.allowLocation") : t("onboarding.enableNotifications")}</Button></>}</div>;
}
