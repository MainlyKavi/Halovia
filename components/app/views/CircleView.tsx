"use client";

import { useState } from "react";
import { Bell, Edit3, Plus, ShieldCheck, Trash2, UsersRound } from "lucide-react";
import { ContactEditor, createBlankContact } from "@/components/app/ContactEditor";
import { useApp } from "@/components/app/AppProvider";
import { Avatar, Button, Card, Dialog, EmptyState, Toggle } from "@/components/ui/Primitives";
import type { TrustedContact } from "@/lib/types";

export function CircleView() {
  const { state, t, saveContact, removeContact, showToast } = useApp();
  const [editing, setEditing] = useState<TrustedContact | null>(null);
  const [removing, setRemoving] = useState<TrustedContact | null>(null);

  function updateContact(contact: TrustedContact, update: Partial<TrustedContact>) {
    saveContact({ ...contact, ...update });
  }

  return <div className="view-stack">
    <header className="view-heading"><div><p className="eyebrow"><UsersRound size={15} />{t("home.peopleTrust")}</p><h1>{t("circle.title")}</h1><p>{t("circle.subtitle")}</p></div><Button onClick={() => setEditing(createBlankContact(state.contacts.length))}><Plus size={18} />{t("circle.add")}</Button></header>
    <Card className="privacy-banner"><ShieldCheck size={21} /><p>{t("circle.privacy")}</p></Card>
    {state.contacts.length === 0 ? <Card><EmptyState icon={<UsersRound size={28} />} title={t("circle.emptyTitle")} text={t("circle.emptyText")} action={<Button onClick={() => setEditing(createBlankContact())}><Plus size={18} />{t("circle.add")}</Button>} /></Card> : <div className="contact-card-list">{state.contacts.map((contact) => <Card key={contact.id} className={`contact-card ${!contact.active ? "muted" : ""}`}>
      <div className="contact-main"><Avatar initials={contact.initials} color={contact.color} size="lg" /><div><div className="contact-title"><h2>{contact.name}</h2><span className={`state-pill ${contact.active ? "active" : ""}`}>{contact.active ? t("common.active") : t("common.inactive")}</span></div><p>{contact.relationship || t("circle.relationshipUnknown")} · {contact.phone}</p><span className="preference-pill"><Bell size={14} />{contact.preference === "all" ? t("circle.allUpdates") : contact.preference === "emergency" ? t("circle.emergencyOnly") : t("circle.none")}</span></div><div className="contact-actions"><button type="button" onClick={() => setEditing(contact)} aria-label={`${t("common.edit")} ${contact.name}`}><Edit3 size={18} /></button><button type="button" onClick={() => setRemoving(contact)} aria-label={`${t("common.remove")} ${contact.name}`}><Trash2 size={18} /></button></div></div>
      <div className="contact-toggles"><Toggle checked={contact.active} onChange={(value) => updateContact(contact, { active: value })} label={contact.active ? t("common.active") : t("common.inactive")} /><Toggle checked={contact.defaultForJourneys} onChange={(value) => updateContact(contact, { defaultForJourneys: value })} label={t("circle.default")} /><Toggle checked={contact.emergencyAlerts} onChange={(value) => updateContact(contact, { emergencyAlerts: value })} label={t("circle.emergency")} /></div>
    </Card>)}</div>}
    <Dialog open={Boolean(editing)} title={editing && state.contacts.some((item) => item.id === editing.id) ? t("circle.editTitle") : t("circle.addTitle")} onClose={() => setEditing(null)}>{editing && <ContactEditor key={editing.id} contact={editing} onCancel={() => setEditing(null)} onSave={(contact) => { saveContact(contact); setEditing(null); showToast(t("circle.saved")); }} />}</Dialog>
    <Dialog open={Boolean(removing)} onClose={() => setRemoving(null)} title={t("circle.removeTitle")} description={t("circle.removeText")}><div className="dialog-actions"><Button variant="ghost" onClick={() => setRemoving(null)}>{t("common.cancel")}</Button><Button variant="danger" onClick={() => { if (removing) removeContact(removing.id); setRemoving(null); showToast(t("circle.removed")); }}>{t("common.remove")}</Button></div></Dialog>
  </div>;
}
