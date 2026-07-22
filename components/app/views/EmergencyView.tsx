"use client";

import { useState } from "react";
import { AlertOctagon, AlertTriangle, BellRing, Info, MapPinned, PhoneCall, Siren } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { Button, Card, Dialog } from "@/components/ui/Primitives";
import { formatCountry } from "@/lib/i18n/format";

type EmergencyAction = "dialer" | "contacts" | "location" | "alarm" | "info";

export function EmergencyView() {
  const { state, t, showToast, recordJourneyEvent } = useApp();
  const [action, setAction] = useState<EmergencyAction | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const actions: Array<{ kind: EmergencyAction; icon: typeof PhoneCall; title: string; text: string; tone: string; working: boolean }> = [
    { kind: "dialer", icon: PhoneCall, title: t("emergency.dialer"), text: t("emergency.dialerText", { number: state.emergency.number }), tone: "call", working: true },
    { kind: "contacts", icon: BellRing, title: t("emergency.alert"), text: t("emergency.alertText"), tone: "alert", working: false },
    { kind: "location", icon: MapPinned, title: t("emergency.location"), text: t("emergency.locationText"), tone: "location", working: true },
    { kind: "alarm", icon: Siren, title: t("emergency.alarm"), text: t("emergency.alarmText"), tone: "alarm", working: true },
    { kind: "info", icon: Info, title: t("emergency.info"), text: t("emergency.infoText"), tone: "info", working: true },
  ];
  const selected = actions.find((item) => item.kind === action);

  async function perform() {
    const selectedAction = action;
    setAction(null);
    if (!selectedAction) return;
    if (selectedAction === "dialer") {
      window.location.href = `tel:${state.emergency.number.replace(/[^+\d]/g, "")}`;
      showToast(t("emergency.dialerOpened"));
      return;
    }
    if (selectedAction === "contacts") {
      recordJourneyEvent("emergencyActionPreview", "contacts");
      showToast(t("emergency.noMessageSent"));
      return;
    }
    if (selectedAction === "location") {
      const summary = state.activeJourney
        ? `Halovia · ${state.activeJourney.origin} → ${state.activeJourney.destination}. ${t("emergency.noLiveCoordinates")}`
        : t("emergency.noSavedJourney");
      try { await navigator.clipboard.writeText(summary); showToast(t("emergency.locationCopied")); }
      catch { showToast(t("emergency.copyFailed")); }
      recordJourneyEvent("emergencyActionPreview", "location");
      return;
    }
    if (selectedAction === "alarm") {
      try {
        const context = new AudioContext();
        [0, 0.28, 0.56].forEach((offset) => {
          const oscillator = context.createOscillator();
          const gain = context.createGain();
          oscillator.frequency.value = 820;
          gain.gain.setValueAtTime(0.08, context.currentTime + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + offset + 0.2);
          oscillator.connect(gain).connect(context.destination);
          oscillator.start(context.currentTime + offset);
          oscillator.stop(context.currentTime + offset + 0.2);
        });
        showToast(t("emergency.alarmPlayed"));
      } catch { showToast(t("emergency.alarmFailed")); }
      recordJourneyEvent("emergencyActionPreview", "alarm");
      return;
    }
    setInfoOpen(true);
  }

  return <div className="view-stack emergency-view">
    <header className="view-heading"><div><p className="eyebrow"><AlertOctagon size={15} />{t("nav.emergency")}</p><h1>{t("emergency.title")}</h1><p>{t("emergency.subtitle")}</p></div></header>
    <Card className="emergency-reality-check"><AlertTriangle size={22} /><div><strong>{t("emergency.prototypeTitle")}</strong><p>{t("emergency.prototypeText")}</p></div></Card>
    <div className="emergency-grid">{actions.map(({ kind, icon: Icon, title, text, tone, working }) => <button key={kind} type="button" className={`emergency-action emergency-action-${tone}`} onClick={() => setAction(kind)}><span><Icon size={24} /></span><div><strong>{title}</strong><p>{text}</p><small>{working ? t("emergency.deviceAction") : t("emergency.simulationOnly")}</small></div></button>)}</div>
    <Card className="network-notice"><AlertTriangle size={21} /><p>{t("emergency.networkCopy")}</p></Card>
    <Dialog open={Boolean(action)} onClose={() => setAction(null)} title={t("emergency.confirmTitle")} description={selected ? t("emergency.confirmText", { action: selected.title }) : undefined}><div className="prototype-note"><AlertTriangle size={16} />{selected?.kind === "dialer" ? t("emergency.dialerConfirm") : selected?.working ? t("emergency.localActionConfirm") : t("emergency.simulationConfirm")}</div><div className="dialog-actions"><Button variant="ghost" onClick={() => setAction(null)}>{t("common.cancel")}</Button><Button variant="danger" onClick={perform}>{t("common.confirm")}</Button></div></Dialog>
    <Dialog open={infoOpen} onClose={() => setInfoOpen(false)} title={t("emergency.infoTitle")} description={t("emergency.infoDescription")}><dl className="emergency-info-list"><div><dt>{t("settings.emergency")}</dt><dd>{state.emergency.number}</dd></div><div><dt>{t("settings.country")}</dt><dd>{state.emergency.country === "OTHER" ? t("settings.countryOther") : formatCountry(state.emergency.country, state.user.locale)}</dd></div><div><dt>{t("emergency.journeyStored")}</dt><dd>{state.activeJourney ? t("common.yes") : t("common.no")}</dd></div></dl><div className="dialog-actions"><Button onClick={() => setInfoOpen(false)}>{t("common.close")}</Button></div></Dialog>
  </div>;
}
