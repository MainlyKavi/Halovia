"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Clock3, PhoneCall, ShieldCheck } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { Button } from "@/components/ui/Primitives";

export function SafetyCheckModal() {
  const {
    state, t, recordSafeCheckIn, extendSafetyCheck, requestHelp,
    triggerPrototypeEscalation, clearSafetyCheck, showToast,
  } = useApp();
  const safetyCheck = state.safetyCheck;
  const safetyId = safetyCheck?.id ?? null;
  const safetyEscalated = safetyCheck?.escalated ?? false;
  const [now, setNow] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const alertedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!safetyId || safetyEscalated) return;
    const update = () => setNow(Date.now());
    const frame = window.requestAnimationFrame(update);
    const timer = window.setInterval(update, 1000);
    return () => { window.cancelAnimationFrame(frame); window.clearInterval(timer); };
  }, [safetyEscalated, safetyId]);

  useEffect(() => {
    if (!safetyId || safetyEscalated || alertedRef.current === safetyId) return;
    alertedRef.current = safetyId;
    if (state.privacy.soundEnabled) {
      try {
        const context = new AudioContext();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = 620;
        gain.gain.setValueAtTime(0.04, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.35);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + 0.35);
      } catch {
        // Sound support varies by browser and user gesture policy.
      }
    }
    if (state.privacy.vibrationEnabled) navigator.vibrate?.([180, 120, 180]);
  }, [safetyEscalated, safetyId, state.privacy.soundEnabled, state.privacy.vibrationEnabled]);

  const initialTimestamp = safetyCheck
    ? new Date(safetyCheck.deadlineAt).getTime() - (safetyCheck.responseSeconds + (safetyCheck.extensionUsed ? 120 : 0)) * 1000
    : 0;
  const seconds = safetyCheck ? Math.max(0, Math.ceil((new Date(safetyCheck.deadlineAt).getTime() - (now || initialTimestamp)) / 1000)) : 0;

  useEffect(() => {
    if (safetyId && !safetyEscalated && seconds <= 0) triggerPrototypeEscalation();
  }, [safetyEscalated, safetyId, seconds, triggerPrototypeEscalation]);

  useEffect(() => {
    if (!safetyId) return;
    const panel = panelRef.current;
    const selector = "button:not([disabled]), [tabindex]:not([tabindex='-1'])";
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    queueMicrotask(() => panel?.querySelector<HTMLElement>("[data-autofocus]")?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(selector));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("dialog-open");
    return () => { document.removeEventListener("keydown", onKey); document.body.classList.remove("dialog-open"); previous?.focus(); };
  }, [safetyId]);

  if (!safetyCheck) return null;
  const alerted = safetyCheck.escalated;
  const totalSeconds = safetyCheck.responseSeconds + (safetyCheck.extensionUsed ? 120 : 0);
  const ratio = alerted ? 0 : Math.max(0, Math.min(1, seconds / totalSeconds));
  const reasonKey = `safety.reason.${safetyCheck.reason}` as Parameters<typeof t>[0];
  const announce = alerted || seconds <= 5 || seconds % 10 === 0;

  return createPortal(<div className="safety-screen" role="presentation">
    <div ref={panelRef} className="safety-panel" role="dialog" aria-modal="true" aria-labelledby="safety-title" aria-describedby="safety-description">
      <div className={`countdown-ring ${alerted ? "alerted" : ""}`} style={{ "--countdown": `${ratio}` } as React.CSSProperties}><span role="timer" aria-label={t("safety.secondsRemaining", { seconds })}>{alerted ? <AlertTriangle size={31} /> : seconds}</span></div>
      <span className="demo-pill">{t("common.prototype")}</span>
      <h1 id="safety-title">{t("safety.title")}</h1>
      <p id="safety-description">{alerted ? t("safety.alerted") : t("safety.text")}</p>
      {!alerted && <strong className="countdown-label">{t("safety.countdown", { seconds })}</strong>}
      <span className="sr-only" aria-live="polite">{announce ? (alerted ? t("safety.alerted") : t("safety.countdown", { seconds })) : ""}</span>
      <div className="safety-explanation"><h2>{t("safety.whyTitle")}</h2><p>{t(reasonKey)}</p><ul><li>{t("safety.explainSafe")}</li><li>{t("safety.explainHelp")}</li><li>{t("safety.explainExtend")}</li><li>{t("safety.explainTimeout")}</li></ul></div>
      <p className="prototype-note"><AlertTriangle size={16} />{t("safety.prototype")}</p>
      <div className="safety-actions">{alerted ? <Button data-autofocus size="lg" onClick={clearSafetyCheck}>{t("common.close")}</Button> : <><Button data-autofocus variant="safe" size="lg" onClick={() => { recordSafeCheckIn(); showToast(t("safety.safeRecorded")); }}><ShieldCheck size={22} />{t("safety.safe")}</Button><Button variant="danger" size="lg" onClick={() => { requestHelp(); showToast(t("safety.helpRecorded")); }}><PhoneCall size={22} />{t("safety.help")}</Button><Button variant="secondary" size="lg" disabled={safetyCheck.extensionUsed} onClick={() => { extendSafetyCheck(); showToast(t("safety.extended")); }}><Clock3 size={21} />{safetyCheck.extensionUsed ? t("safety.extensionUsed") : t("safety.extend")}</Button></>}</div>
    </div>
  </div>, document.body);
}
