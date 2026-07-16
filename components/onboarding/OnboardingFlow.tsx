"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Check, ChevronLeft, ChevronRight, Globe2, LocateFixed, PartyPopper, ShieldCheck, Sparkles, UserRound, UsersRound } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { Avatar, Button, Card, LanguageSelector, TextInput, ThemeSelector } from "@/components/ui/Primitives";
import { Logo } from "@/components/ui/Logo";

export function OnboardingFlow() {
  const { state, t, updateState, showToast } = useApp();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(state.user.name);
  const [permissionState, setPermissionState] = useState<"idle" | "success" | "error">("idle");
  const total = 8;

  const steps = [
    { icon: Sparkles, title: t("onboarding.welcomeTitle"), text: t("onboarding.welcomeText"), content: <div className="welcome-visual"><div className="large-logo"><Logo compact /></div><div className="welcome-route"><span /><span /><span /></div></div> },
    { icon: Globe2, title: t("onboarding.languageTitle"), text: t("onboarding.languageText"), content: <LanguageSelector /> },
    { icon: ShieldCheck, title: t("onboarding.themeTitle"), text: t("onboarding.themeText"), content: <ThemeSelector /> },
    { icon: UserRound, title: t("onboarding.nameTitle"), text: t("onboarding.nameText"), content: <label className="field"><span className="field-label">{t("onboarding.nameLabel")}</span><TextInput value={name} onChange={(event) => setName(event.target.value)} placeholder={t("onboarding.namePlaceholder")} autoFocus /></label> },
    { icon: UsersRound, title: t("onboarding.contactsTitle"), text: t("onboarding.contactsText"), content: <div className="onboarding-contacts">{state.contacts.slice(0, 3).map((contact) => <div key={contact.id}><Avatar initials={contact.initials} color={contact.color} /><span><strong>{contact.name}</strong><small>{contact.relationship}</small></span><Check size={18} /></div>)}</div> },
    { icon: LocateFixed, title: t("onboarding.locationTitle"), text: t("onboarding.locationText"), content: <PermissionAction type="location" status={permissionState} setStatus={setPermissionState} /> },
    { icon: BellRing, title: t("onboarding.notificationsTitle"), text: t("onboarding.notificationsText"), content: <PermissionAction type="notifications" status={permissionState} setStatus={setPermissionState} /> },
    { icon: PartyPopper, title: t("onboarding.readyTitle"), text: t("onboarding.readyText"), content: <div className="ready-summary"><span><Check size={18} />{t("settings.language")}: {t(`language.${state.user.language}` as Parameters<typeof t>[0])}</span><span><Check size={18} />{t("settings.theme")}: {t(`theme.${state.user.theme}` as Parameters<typeof t>[0])}</span><span><Check size={18} />{state.contacts.filter((c) => c.active).length} {t("nav.circle")}</span></div> },
  ];
  const current = steps[step];
  const Icon = current.icon;

  function next() {
    if (step === 3) updateState((s) => ({ ...s, user: { ...s.user, name: name.trim() || s.user.name } }));
    setPermissionState("idle");
    if (step < total - 1) setStep(step + 1);
    else {
      updateState((s) => ({ ...s, user: { ...s.user, name: name.trim() || s.user.name, onboardingComplete: true } }));
      showToast(t("onboarding.readyText"));
      router.push("/home");
    }
  }

  return (
    <main className="onboarding-page">
      <header className="onboarding-header"><Logo /><span>{t("onboarding.progress", { current: step + 1, total })}</span></header>
      <div className="onboarding-progress" aria-hidden="true"><span style={{ width: `${((step + 1) / total) * 100}%` }} /></div>
      <section className="onboarding-shell">
        <Card className="onboarding-card">
          <div className="onboarding-icon"><Icon size={24} /></div>
          <div className="onboarding-heading"><h1>{current.title}</h1><p>{current.text}</p></div>
          <div className="onboarding-content">{current.content}</div>
          <div className="onboarding-actions">
            {step > 0 ? <Button variant="ghost" onClick={() => { setStep(step - 1); setPermissionState("idle"); }}><ChevronLeft size={18} />{t("common.back")}</Button> : <span />}
            <div>{(step === 5 || step === 6) && <Button variant="ghost" onClick={next}>{t("common.skip")}</Button>}<Button size="lg" onClick={next}>{step === total - 1 ? t("onboarding.finish") : t("common.continue")}<ChevronRight size={18} /></Button></div>
          </div>
        </Card>
      </section>
    </main>
  );
}

function PermissionAction({ type, status, setStatus }: { type: "location" | "notifications"; status: "idle" | "success" | "error"; setStatus: (status: "idle" | "success" | "error") => void }) {
  const { t, updateState } = useApp();
  async function requestPermission() {
    if (type === "location") {
      if (!navigator.geolocation) { setStatus("error"); return; }
      navigator.geolocation.getCurrentPosition(
        () => { setStatus("success"); updateState((s) => ({ ...s, privacy: { ...s.privacy, locationWhileActive: true } })); },
        () => setStatus("error"),
        { timeout: 7000 }
      );
    } else {
      if (!("Notification" in window)) { setStatus("error"); return; }
      const result = await Notification.requestPermission();
      if (result === "granted") { setStatus("success"); updateState((s) => ({ ...s, privacy: { ...s.privacy, notifications: true } })); }
      else setStatus("error");
    }
  }
  const Icon = type === "location" ? LocateFixed : BellRing;
  return <div className={`permission-card ${status}`}><span className="permission-art"><Icon size={32} /></span>{status === "idle" && <Button size="lg" onClick={requestPermission}>{type === "location" ? t("onboarding.allowLocation") : t("onboarding.enableNotifications")}</Button>}{status === "success" && <p><Check size={20} />{type === "location" ? t("onboarding.locationAllowed") : t("onboarding.notificationsEnabled")}</p>}{status === "error" && <><p>{type === "location" ? t("onboarding.locationDenied") : t("onboarding.notificationsDenied")}</p><Button variant="secondary" onClick={requestPermission}>{type === "location" ? t("onboarding.allowLocation") : t("onboarding.enableNotifications")}</Button></>}</div>;
}
