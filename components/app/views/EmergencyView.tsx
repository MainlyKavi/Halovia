"use client";

import { useState } from "react";
import { AlertOctagon, AlertTriangle, BellRing, Info, MapPinned, PhoneCall, Siren } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { Button, Card, Dialog } from "@/components/ui/Primitives";

export function EmergencyView() {
  const { state, t, showToast } = useApp();
  const [action, setAction] = useState("");
  const actions = [
    { icon: PhoneCall, title: t("emergency.call"), text: t("emergency.callText", { number: state.emergency.number, region: state.emergency.region }), tone: "call" },
    { icon: BellRing, title: t("emergency.alert"), text: t("emergency.alertText"), tone: "alert" },
    { icon: MapPinned, title: t("emergency.location"), text: t("emergency.locationText"), tone: "location" },
    { icon: Siren, title: t("emergency.alarm"), text: t("emergency.alarmText"), tone: "alarm" },
    { icon: Info, title: t("emergency.info"), text: t("emergency.infoText"), tone: "info" },
  ];
  return <div className="view-stack emergency-view">
    <header className="view-heading"><div><p className="eyebrow"><AlertOctagon size={15} />{t("nav.emergency")}</p><h1>{t("emergency.title")}</h1><p>{t("emergency.subtitle")}</p></div></header>
    <div className="emergency-number"><span><PhoneCall size={26} /></span><div><small>{t("emergency.call")}</small><strong>{state.emergency.number}</strong><p>{state.emergency.region}</p></div><Button variant="danger" size="lg" onClick={() => setAction(t("emergency.call"))}>{t("common.continue")}</Button></div>
    <div className="emergency-grid">{actions.slice(1).map(({ icon: Icon, title, text, tone }) => <button key={title} type="button" className={`emergency-action emergency-action-${tone}`} onClick={() => setAction(title)}><span><Icon size={24} /></span><div><strong>{title}</strong><p>{text}</p></div></button>)}</div>
    <Card className="network-notice"><AlertTriangle size={21} /><p>{t("emergency.networkCopy")}</p></Card>
    <Dialog open={Boolean(action)} onClose={() => setAction("")} title={t("emergency.confirmTitle")} description={t("emergency.confirmText", { action })}><div className="prototype-note"><AlertTriangle size={16} />{t("safety.prototype")}</div><div className="dialog-actions"><Button variant="ghost" onClick={() => setAction("")}>{t("common.cancel")}</Button><Button variant="danger" onClick={() => { setAction(""); showToast(t("emergency.simulated")); }}>{t("common.confirm")}</Button></div></Dialog>
  </div>;
}
