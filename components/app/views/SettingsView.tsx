"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellRing, ChevronRight, Clock3, Database, Globe2, HeartHandshake, Info, Languages, LocateFixed, MoonStar, Palette, ShieldCheck, Trash2, UserRound, UsersRound, Volume2 } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { Button, Card, Dialog, Field, LanguageSelector, SelectInput, TextInput, ThemeSelector, Toggle } from "@/components/ui/Primitives";
import { countryOptions, localeOptions } from "@/lib/i18n/config";
import { formatCountry } from "@/lib/i18n/format";
import type { CountryCode, DateFormatPreference, Locale } from "@/lib/types";

export function SettingsView() {
  const { state, t, updateState, updateRetention, resetState, showToast } = useApp();
  const router = useRouter();
  const [name, setName] = useState(state.user.name);
  const [number, setNumber] = useState(state.emergency.number);
  const [clearOpen, setClearOpen] = useState(false);

  function save() {
    updateState((current) => ({ ...current, user: { ...current.user, name: name.trim() }, emergency: { ...current.emergency, number: number.trim() || current.emergency.number } }));
    showToast(t("settings.saved"));
  }

  function clearData() {
    resetState();
    setClearOpen(false);
    router.push("/");
  }

  return <div className="view-stack settings-view">
    <header className="view-heading"><div><p className="eyebrow"><HeartHandshake size={15} />Halovia</p><h1>{t("settings.title")}</h1><p>{t("settings.subtitle")}</p></div><Button onClick={save}>{t("common.save")}</Button></header>
    <div className="settings-grid">
      <Card className="settings-card"><h2><UserRound size={20} />{t("settings.profile")}</h2><Field label={t("settings.name")}><TextInput value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label={t("settings.emergency")} hint={t("settings.emergencyHint")}><TextInput inputMode="tel" value={number} onChange={(event) => setNumber(event.target.value)} /></Field></Card>
      <Card className="settings-card"><h2><Languages size={20} />{t("settings.language")}</h2><LanguageSelector /></Card>
      <Card className="settings-card wide-setting"><h2><Palette size={20} />{t("settings.theme")}</h2><ThemeSelector /></Card>
      <Card className="settings-card"><h2><Globe2 size={20} />{t("settings.regionFormat")}</h2><Field label={t("settings.country")}><SelectInput value={state.user.country} onChange={(event) => updateState((current) => ({ ...current, user: { ...current.user, country: event.target.value as CountryCode } }))}>{countryOptions.map((country) => <option key={country} value={country}>{country === "OTHER" ? t("settings.countryOther") : formatCountry(country, state.user.locale)}</option>)}</SelectInput></Field><Field label={t("settings.locale")} hint={t("settings.localeHint")}><SelectInput value={state.user.locale} onChange={(event) => updateState((current) => ({ ...current, user: { ...current.user, locale: event.target.value as Locale } }))}>{localeOptions.map((locale) => <option key={locale} value={locale}>{locale}</option>)}</SelectInput></Field><Field label={t("settings.dateFormat")}><SelectInput value={state.user.dateFormat} onChange={(event) => updateState((current) => ({ ...current, user: { ...current.user, dateFormat: event.target.value as DateFormatPreference } }))}><option value="locale">{t("settings.dateLocale")}</option><option value="dayFirst">{t("settings.dateDayFirst")}</option><option value="monthFirst">{t("settings.dateMonthFirst")}</option></SelectInput></Field></Card>
      <Card className="settings-card"><h2><BellRing size={20} />{t("settings.notifications")}</h2><Toggle checked={state.privacy.notifications} onChange={(value) => updateState((current) => ({ ...current, privacy: { ...current.privacy, notifications: value } }))} label={t("settings.notifyToggle")} description={t("settings.notifyDescription")} /></Card>
      <Card className="settings-card"><h2><LocateFixed size={20} />{t("settings.location")}</h2><Toggle checked={state.privacy.locationWhileActive} onChange={(value) => updateState((current) => ({ ...current, privacy: { ...current.privacy, locationWhileActive: value } }))} label={t("settings.locationToggle")} description={t("settings.locationDescription")} /></Card>
      <Card className="settings-card wide-setting"><h2><ShieldCheck size={20} />{t("settings.privacy")}</h2><Field label={t("settings.history")} hint={t(`settings.retention.${state.privacy.historyRetention}.description` as Parameters<typeof t>[0])}><SelectInput value={state.privacy.historyRetention} onChange={(event) => updateRetention(event.target.value as typeof state.privacy.historyRetention)}><option value="auto">{t("settings.retentionAuto")}</option><option value="7">{t("settings.retention7")}</option><option value="30">{t("settings.retention30")}</option><option value="manual">{t("settings.retentionManual")}</option></SelectInput></Field><div className="settings-links"><Link href="/privacy">{t("footer.privacy")}<ChevronRight size={17} /></Link><Link href="/safety-limitations">{t("footer.safety")}<ChevronRight size={17} /></Link></div></Card>
      <Card className="settings-card"><h2><Clock3 size={20} />{t("settings.safetyCheck")}</h2><Field label={t("settings.responsePeriod")}><SelectInput value={state.privacy.safetyResponseSeconds} onChange={(event) => updateState((current) => ({ ...current, privacy: { ...current.privacy, safetyResponseSeconds: Number(event.target.value) as 30 | 45 | 60 } }))}><option value="30">30 {t("common.seconds")}</option><option value="45">45 {t("common.seconds")}</option><option value="60">60 {t("common.seconds")}</option></SelectInput></Field><p className="field-hint">{t("settings.responseDescription")}</p></Card>
      <Card className="settings-card"><h2><Volume2 size={20} />{t("settings.alertCues")}</h2><Toggle checked={state.privacy.soundEnabled} onChange={(value) => updateState((current) => ({ ...current, privacy: { ...current.privacy, soundEnabled: value } }))} label={t("settings.sound")} description={t("settings.soundDescription")} /><Toggle checked={state.privacy.vibrationEnabled} onChange={(value) => updateState((current) => ({ ...current, privacy: { ...current.privacy, vibrationEnabled: value } }))} label={t("settings.vibration")} description={t("settings.vibrationDescription")} /></Card>
      <Card className="settings-card"><h2><MoonStar size={20} />{t("settings.accessibility")}</h2><Toggle checked={state.privacy.reducedMotion} onChange={(value) => updateState((current) => ({ ...current, privacy: { ...current.privacy, reducedMotion: value } }))} label={t("settings.reducedMotion")} /></Card>
      <Card className="settings-card"><h2><UsersRound size={20} />{t("settings.contacts")}</h2><Link href="/circle" className="settings-link"><span>{state.contacts.filter((contact) => contact.active).length} {t("common.active")}</span><ChevronRight size={18} /></Link></Card>
      <Card className="settings-card"><h2><Database size={20} />{t("settings.data")}</h2><p className="field-hint">{t("settings.storageDisclosure")}</p><Button variant="danger" onClick={() => setClearOpen(true)}><Trash2 size={17} />{t("settings.clearData")}</Button></Card>
      <Card className="settings-card about-card"><h2><Info size={20} />{t("settings.about")}</h2><p>{t("settings.aboutText")}</p><small>{t("settings.version")}</small><p className="about-disclaimer">{t("disclaimer")}</p></Card>
    </div>
    <Dialog open={clearOpen} onClose={() => setClearOpen(false)} title={t("settings.clearTitle")} description={t("settings.clearText")}><div className="dialog-actions"><Button variant="ghost" onClick={() => setClearOpen(false)}>{t("common.cancel")}</Button><Button variant="danger" onClick={clearData}>{t("settings.clearData")}</Button></div></Dialog>
  </div>;
}
