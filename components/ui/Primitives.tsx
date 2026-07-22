"use client";

import { AlertTriangle, Check, ChevronRight, Globe2, LoaderCircle, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useApp } from "@/components/app/AppProvider";
import { languageOptions } from "@/lib/i18n/config";
import type { JourneyStatus, Language, Theme } from "@/lib/types";

export function Button({
  children, variant = "primary", size = "md", className = "", type, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" | "safe"; size?: "sm" | "md" | "lg" }) {
  return <button type={type ?? "button"} className={`button button-${variant} button-${size} ${className}`} {...props}>{children}</button>;
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
  const warning = ["slightDelay", "routeChanged", "safetyCheckRequested", "helpRequested", "prototypeEscalated"].includes(status);
  return <span className={`status-badge ${warning ? "status-warning" : "status-calm"}`}>{warning ? <AlertTriangle size={14} /> : <Check size={14} />}{t(`status.${status}` as Parameters<typeof t>[0])}</span>;
}

export function Avatar({ initials, color, size = "md" }: { initials: string; color: string; size?: "sm" | "md" | "lg" }) {
  return <span className={`avatar avatar-${size}`} style={{ "--avatar": color } as React.CSSProperties}>{initials}</span>;
}

export function ThemeSelector({ previews = false }: { previews?: boolean }) {
  const { state, setTheme, t } = useApp();
  const themes: Theme[] = ["pink", "light", "dark"];
  return <div className={`choice-grid theme-grid ${previews ? "theme-grid-previews" : ""}`}>{themes.map((theme) => (
    <button key={theme} type="button" className={`choice-card theme-choice theme-choice-${theme} ${state.user.theme === theme ? "selected" : ""}`} onClick={() => setTheme(theme)} aria-pressed={state.user.theme === theme}>
      {previews ? <span className="theme-preview" aria-hidden="true"><span className="theme-preview-top"><i /><i /></span><span className="theme-preview-map"><i /><i /><i /></span><span className="theme-preview-sheet"><i /><i /></span></span> : <span className="theme-swatch"><span /><span /><span /></span>}
      <strong>{t(`theme.${theme}` as Parameters<typeof t>[0])}</strong>
      <small>{t(`theme.${theme}Desc` as Parameters<typeof t>[0])}</small>
      {state.user.theme === theme && <span className="choice-check"><Check size={14} /></span>}
    </button>
  ))}</div>;
}

export function LanguageSelector() {
  const { state, setLanguage } = useApp();
  return <div className="choice-grid language-grid">{languageOptions.map(({ value, nativeLabel }) => (
    <button key={value} type="button" lang={value} dir={value === "ar" || value === "ur" ? "rtl" : "ltr"} className={`choice-card language-choice ${state.user.language === value ? "selected" : ""}`} onClick={() => setLanguage(value)} aria-pressed={state.user.language === value}>
      <span className="language-code">{value.toUpperCase()}</span>
      <strong>{nativeLabel}</strong>
      {state.user.language === value && <span className="choice-check"><Check size={14} /></span>}
    </button>
  ))}</div>;
}

export function CompactLanguageSwitcher({ className = "" }: { className?: string }) {
  const { state, setLanguage, t } = useApp();
  return <label className={`compact-language ${className}`}><Globe2 size={16} aria-hidden="true" /><span className="sr-only">{t("settings.language")}</span><select value={state.user.language} onChange={(event) => setLanguage(event.target.value as Language)} aria-label={t("settings.language")}>{languageOptions.map(({ value, nativeLabel }) => <option key={value} value={value}>{nativeLabel}</option>)}</select></label>;
}

export function Progress({ value, label }: { value: number; label?: string }) {
  const { state } = useApp();
  const safeValue = Math.max(0, Math.min(100, Math.round(value)));
  const formattedValue = new Intl.NumberFormat(state.user.locale, { style: "percent", maximumFractionDigits: 0 }).format(safeValue / 100);
  return <div className="progress-wrap">{label && <div className="progress-label"><span>{label}</span><strong>{formattedValue}</strong></div>}<div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeValue} aria-label={label}><span style={{ width: `${safeValue}%` }} /></div></div>;
}

export function Dialog({ open, title, description, children, onClose }: { open: boolean; title: string; description?: string; children: React.ReactNode; onClose: () => void }) {
  const { t } = useApp();
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const focusableSelector = "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
    queueMicrotask(() => {
      const target = panel?.querySelector<HTMLElement>("[data-autofocus]") ?? panel?.querySelector<HTMLElement>(focusableSelector);
      target?.focus();
    });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("dialog-open");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("dialog-open");
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(<div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section ref={panelRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}><button data-autofocus className="icon-button dialog-close" onClick={onClose} aria-label={t("common.close")}><X size={20} /></button><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}<div className="dialog-content">{children}</div></section></div>, document.body);
}

export function Toast() {
  const { toast, clearToast, t } = useApp();
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(clearToast, 3600); return () => window.clearTimeout(timer); }, [toast, clearToast]);
  if (!toast) return null;
  return <div className="toast" role="status"><Check size={18} /><span>{toast.text}</span><button type="button" onClick={clearToast} aria-label={t("common.close")}><X size={16} /></button></div>;
}

export function EmptyState({ icon, title, text, action }: { icon: React.ReactNode; title: string; text: string; action?: React.ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{text}</p>{action}</div>;
}

export function LoadingSkeleton() {
  const { t } = useApp();
  return <div className="loading-shell" role="status" aria-label={t("common.loading")}><LoaderCircle className="spin" size={30} /><div><span /><span /></div></div>;
}

export function RowLink({ icon, title, text, href }: { icon: React.ReactNode; title: string; text?: string; href: string }) {
  return <a href={href} className="row-link"><span className="row-icon">{icon}</span><span><strong>{title}</strong>{text && <small>{text}</small>}</span><ChevronRight size={18} /></a>;
}
