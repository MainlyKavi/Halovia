"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, PhoneCall, ShieldCheck } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { Button } from "@/components/ui/Primitives";

export function SafetyCheckModal({ open, onClose, onNeedHelp }: { open: boolean; onClose: () => void; onNeedHelp: () => void }) {
  const { t } = useApp();
  const [seconds, setSeconds] = useState(15);
  const alerted = seconds <= 0;
  useEffect(() => {
    if (!open || seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [open, seconds]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.classList.add("dialog-open");
    return () => { document.removeEventListener("keydown", onKey); document.body.classList.remove("dialog-open"); };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(<div className="safety-screen" role="dialog" aria-modal="true" aria-labelledby="safety-title">
    <div className="safety-panel">
      <div className={`countdown-ring ${alerted ? "alerted" : ""}`} style={{ "--countdown": `${seconds / 15}` } as React.CSSProperties}><span>{alerted ? <AlertTriangle size={31} /> : seconds}</span></div>
      <span className="demo-pill">{t("common.demo")}</span>
      <h1 id="safety-title">{t("safety.title")}</h1>
      <p>{alerted ? t("safety.alerted") : t("safety.text")}</p>
      {!alerted && <strong className="countdown-label">{t("safety.countdown", { seconds })}</strong>}
      <p className="prototype-note"><AlertTriangle size={16} />{t("safety.prototype")}</p>
      <div className="safety-actions">{alerted ? <Button size="lg" onClick={onClose}>{t("common.close")}</Button> : <><Button variant="safe" size="lg" onClick={onClose}><ShieldCheck size={22} />{t("safety.safe")}</Button><Button variant="danger" size="lg" onClick={onNeedHelp}><PhoneCall size={22} />{t("safety.help")}</Button></>}</div>
    </div>
  </div>, document.body);
}
