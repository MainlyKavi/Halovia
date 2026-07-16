"use client";

import { AlertTriangle, Check, ChevronRight, LoaderCircle, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useApp } from "@/components/app/AppProvider";
import type { JourneyStatus, Language, Theme } from "@/lib/types";

export function Button({
  children, variant = "primary", size = "md", className = "", ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" | "safe"; size?: "sm" | "md" | "lg" }) {
  return <button className={`button button-${variant} button-${size} ${className}`} {...props}>{children}</button>;
}

export function Card({ children, className = "", as = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "section" | "article" }) {
  const Component = as;
  return <Component className={`card ${className}`}>{children}</Component>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="field"><span className="field-label">{label}</span>{children}{hint && <span className="field-hint">{hint}</span>}</label>;
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="input textarea" {...props} />;
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="input select-input" {...props} />;
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (value: boolean) => void; label: string; description?: string }) {
  return (
    <label className="toggle-row">
      <span><span className="toggle-title">{label}</span>{description && <span className="toggle-description">{description}</span>}</span>
      <input className="sr-only" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className={`toggle ${checked ? "toggle-on" : ""}`} aria-hidden="true"><span /></span>
    </label>
  );
}

export function StatusBadge({ status }: { status: JourneyStatus }) {
  const { t } = useApp();
  const warning = ["slightDelay", "routeChanged", "safetyCheckRequested", "contactAlerted"].includes(status);
  return <span className={`status-badge ${warning ? "status-warning" : "status-calm"}`}>{warning ? <AlertTriangle size={14} /> : <Check size={14} />}{t(`status.${status}` as Parameters<typeof t>[0])}</span>;
}

export function Avatar({ initials, color, size = "md" }: { initials: string; color: string; size?: "sm" | "md" | "lg" }) {
  return <span className={`avatar avatar-${size}`} style={{ "--avatar": color } as React.CSSProperties}>{initials}</span>;
}

export function ThemeSelector() {
  const { state, setTheme, t } = useApp();
  const themes: Theme[] = ["light", "dark", "pink"];
  return <div className="choice-grid theme-grid">{themes.map((theme) => (
    <button key={theme} type="button" className={`choice-card theme-choice theme-choice-${theme} ${state.user.theme === theme ? "selected" : ""}`} onClick={() => setTheme(theme)} aria-pressed={state.user.theme === theme}>
      <span className="theme-swatch"><span /><span /><span /></span>
      <strong>{t(`theme.${theme}` as Parameters<typeof t>[0])}</strong>
      <small>{t(`theme.${theme}Desc` as Parameters<typeof t>[0])}</small>
      {state.user.theme === theme && <span className="choice-check"><Check size={14} /></span>}
    </button>
  ))}</div>;
}

export function LanguageSelector() {
  const { state, setLanguage, t } = useApp();
  const languages: Language[] = ["en", "hi", "es"];
  return <div className="choice-grid language-grid">{languages.map((language) => (
    <button key={language} type="button" className={`choice-card language-choice ${state.user.language === language ? "selected" : ""}`} onClick={() => setLanguage(language)} aria-pressed={state.user.language === language}>
      <span className="language-code">{language.toUpperCase()}</span>
      <strong>{t(`language.${language}` as Parameters<typeof t>[0])}</strong>
      {state.user.language === language && <span className="choice-check"><Check size={14} /></span>}
    </button>
  ))}</div>;
}

export function Progress({ value, label }: { value: number; label?: string }) {
  return <div className="progress-wrap">{label && <div className="progress-label"><span>{label}</span><strong>{value}%</strong></div>}<div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}><span style={{ width: `${value}%` }} /></div></div>;
}

export function Dialog({ open, title, description, children, onClose }: { open: boolean; title: string; description?: string; children: React.ReactNode; onClose: () => void }) {
  const { t } = useApp();
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.classList.add("dialog-open");
    return () => { document.removeEventListener("keydown", onKey); document.body.classList.remove("dialog-open"); };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(<div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><button className="icon-button dialog-close" onClick={onClose} aria-label={t("common.close")}><X size={20} /></button><h2 id="dialog-title">{title}</h2>{description && <p>{description}</p>}<div className="dialog-content">{children}</div></section></div>, document.body);
}

export function Toast() {
  const { toast, clearToast } = useApp();
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(clearToast, 3600); return () => window.clearTimeout(timer); }, [toast, clearToast]);
  if (!toast) return null;
  return <div className="toast" role="status"><Check size={18} /><span>{toast.text}</span><button onClick={clearToast} aria-label="Close"><X size={16} /></button></div>;
}

export function EmptyState({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{text}</p>{action}</div>;
}

export function LoadingSkeleton() {
  return <div className="loading-shell" aria-label="Loading"><LoaderCircle className="spin" size={30} /><div><span /><span /></div></div>;
}

export function RowLink({ icon, title, text, href }: { icon: React.ReactNode; title: string; text?: string; href: string }) {
  return <a href={href} className="row-link"><span className="row-icon">{icon}</span><span><strong>{title}</strong>{text && <small>{text}</small>}</span><ChevronRight size={18} /></a>;
}
