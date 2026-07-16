"use client";

import { useState } from "react";
import Link from "next/link";
import { BellRing, ChevronRight, Database, HeartHandshake, Info, Languages, LocateFixed, MoonStar, Palette, ShieldCheck, Trash2, UserRound, UsersRound } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { Button, Card, Dialog, Field, LanguageSelector, SelectInput, TextInput, ThemeSelector, Toggle } from "@/components/ui/Primitives";

export function SettingsView() {
  const { state, t, updateState, resetState, showToast } = useApp();
  const [name, setName] = useState(state.user.name);
  const [number, setNumber] = useState(state.emergency.number);
  const [clearOpen, setClearOpen] = useState(false);
  function save() {
    updateState((s) => ({ ...s, user: { ...s.user, name: name.trim() || s.user.name }, emergency: { ...s.emergency, number: number.trim() || s.emergency.number } })); showToast(t("settings.saved"));
  }
  return <div className="view-stack settings-view">
    <header className="view-heading"><div><p className="eyebrow"><HeartHandshake size={15} />Halovia</p><h1>{t("settings.title")}</h1><p>{t("settings.subtitle")}</p></div><Button onClick={save}>{t("common.save")}</Button></header>
    <div className="settings-grid">
      <Card className="settings-card"><h2><UserRound size={20} />{t("settings.profile")}</h2><Field label={t("settings.name")}><TextInput value={name} onChange={(e) => setName(e.target.value)} /></Field><Field label={t("settings.emergency")}><TextInput inputMode="tel" value={number} onChange={(e) => setNumber(e.target.value)} /></Field></Card>
      <Card className="settings-card"><h2><Languages size={20} />{t("settings.language")}</h2><LanguageSelector /></Card>
      <Card className="settings-card wide-setting"><h2><Palette size={20} />{t("settings.theme")}</h2><ThemeSelector /></Card>
      <Card className="settings-card"><h2><BellRing size={20} />{t("settings.notifications")}</h2><Toggle checked={state.privacy.notifications} onChange={(value) => updateState((s) => ({ ...s, privacy: { ...s.privacy, notifications: value } }))} label={t("settings.notifyToggle")} /></Card>
      <Card className="settings-card"><h2><LocateFixed size={20} />{t("settings.location")}</h2><Toggle checked={state.privacy.locationWhileActive} onChange={(value) => updateState((s) => ({ ...s, privacy: { ...s.privacy, locationWhileActive: value } }))} label={t("settings.locationToggle")} /></Card>
      <Card className="settings-card wide-setting"><h2><ShieldCheck size={20} />{t("settings.privacy")}</h2><Field label={t("settings.history")}><SelectInput value={state.privacy.historyRetention} onChange={(e) => updateState((s) => ({ ...s, privacy: { ...s.privacy, historyRetention: e.target.value as typeof s.privacy.historyRetention } }))}><option value="auto">{t("settings.retentionAuto")}</option><option value="7">{t("settings.retention7")}</option><option value="30">{t("settings.retention30")}</option><option value="manual">{t("settings.retentionManual")}</option></SelectInput></Field></Card>
      <Card className="settings-card"><h2><MoonStar size={20} />{t("settings.accessibility")}</h2><Toggle checked={state.privacy.reducedMotion} onChange={(value) => updateState((s) => ({ ...s, privacy: { ...s.privacy, reducedMotion: value } }))} label={t("settings.reducedMotion")} /></Card>
      <Card className="settings-card"><h2><UsersRound size={20} />{t("settings.contacts")}</h2><Link href="/circle" className="settings-link"><span>{state.contacts.filter((c) => c.active).length} {t("common.active")}</span><ChevronRight size={18} /></Link></Card>
      <Card className="settings-card"><h2><Database size={20} />{t("settings.data")}</h2><Button variant="danger" onClick={() => setClearOpen(true)}><Trash2 size={17} />{t("settings.clearData")}</Button></Card>
      <Card className="settings-card about-card"><h2><Info size={20} />{t("settings.about")}</h2><p>{t("settings.aboutText")}</p><small>{t("settings.version")}</small><p className="about-disclaimer">{t("disclaimer")}</p></Card>
    </div>
    <Dialog open={clearOpen} onClose={() => setClearOpen(false)} title={t("settings.clearTitle")} description={t("settings.clearText")}><div className="dialog-actions"><Button variant="ghost" onClick={() => setClearOpen(false)}>{t("common.cancel")}</Button><Button variant="danger" onClick={() => { resetState(); setClearOpen(false); showToast(t("settings.saved")); }}>{t("settings.clearData")}</Button></div></Dialog>
  </div>;
}
