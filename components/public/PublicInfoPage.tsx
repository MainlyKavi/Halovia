"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, Check, Clipboard, FileText, LockKeyhole, MessageSquareText, ShieldAlert, WifiOff } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { Button, Card, CompactLanguageSwitcher, TextArea } from "@/components/ui/Primitives";
import { Logo } from "@/components/ui/Logo";

export type PublicPageKind = "privacy" | "terms" | "safety" | "feedback" | "report" | "offline";

const sectionCounts: Record<Exclude<PublicPageKind, "feedback" | "report" | "offline">, number> = {
  privacy: 5,
  terms: 4,
  safety: 5,
};

const icons = {
  privacy: LockKeyhole,
  terms: FileText,
  safety: ShieldAlert,
  feedback: MessageSquareText,
  report: AlertTriangle,
  offline: WifiOff,
};

export function PublicInfoPage({ kind }: { kind: PublicPageKind }) {
  const { t } = useApp();
  const Icon = icons[kind];
  const form = kind === "feedback" || kind === "report";
  const offline = kind === "offline";
  return <div className="public-page">
    <header className="public-header shell-width"><Logo /><div><CompactLanguageSwitcher /><Link href="/" className="button button-ghost button-sm"><ArrowLeft size={16} />{t("common.backHome")}</Link></div></header>
    <main className="public-shell shell-width">
      <header className="public-heading"><span className="feature-icon"><Icon size={24} /></span><p className="eyebrow">Halovia</p><h1>{t(`page.${kind}.title` as Parameters<typeof t>[0])}</h1><p>{t(`page.${kind}.intro` as Parameters<typeof t>[0])}</p></header>
      {form ? <FeedbackForm kind={kind} /> : offline ? <OfflineContent /> : <div className="public-section-list">{Array.from({ length: sectionCounts[kind] }, (_, index) => index + 1).map((index) => <Card as="section" key={index}><h2>{t(`page.${kind}.section${index}Title` as Parameters<typeof t>[0])}</h2><p>{t(`page.${kind}.section${index}Text` as Parameters<typeof t>[0])}</p></Card>)}</div>}
      {kind === "safety" && <Card className="future-security"><h2>{t("security.title")}</h2><p>{t("security.intro")}</p><ul>{Array.from({ length: 11 }, (_, index) => <li key={index}><Check size={16} />{t(`security.item${index + 1}` as Parameters<typeof t>[0])}</li>)}</ul></Card>}
      <Card className="public-disclaimer"><AlertTriangle size={20} /><p>{t("disclaimer")}</p></Card>
    </main>
  </div>;
}

function FeedbackForm({ kind }: { kind: "feedback" | "report" }) {
  const { t } = useApp();
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  async function copyDraft() {
    if (!text.trim()) { setStatus("error"); return; }
    try {
      await navigator.clipboard.writeText(text.trim());
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  return <Card className="feedback-card"><p className="prototype-note"><AlertTriangle size={16} />{t("page.form.localOnly")}</p><label className="field"><span className="field-label">{t(`page.${kind}.label` as Parameters<typeof t>[0])}</span><TextArea rows={8} value={text} onChange={(event) => { setText(event.target.value); setStatus("idle"); }} placeholder={t(`page.${kind}.placeholder` as Parameters<typeof t>[0])} /></label><Button onClick={copyDraft}><Clipboard size={18} />{t("page.form.copy")}</Button><p className="form-status" role="status">{status === "copied" ? t("page.form.copied") : status === "error" ? t("page.form.error") : t("page.form.guidance")}</p></Card>;
}

function OfflineContent() {
  const { t } = useApp();
  return <Card className="offline-card"><WifiOff size={38} /><ul><li>{t("offline.cached")}</li><li>{t("offline.location")}</li><li>{t("offline.alerts")}</li><li>{t("offline.emergency")}</li><li>{t("offline.phone")}</li></ul><Button onClick={() => window.location.reload()}>{t("offline.retry")}</Button></Card>;
}
