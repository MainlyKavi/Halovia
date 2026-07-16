"use client";

import { useState } from "react";
import { Bell, Edit3, Plus, ShieldCheck, Trash2, UserRoundPlus, UsersRound } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { Avatar, Button, Card, Dialog, Field, SelectInput, TextInput, Toggle } from "@/components/ui/Primitives";
import type { NotificationPreference, TrustedContact } from "@/lib/types";

const colors = ["#7c6ee6", "#e07b8f", "#4f9f8f", "#d18745"];

export function CircleView() {
  const { state, t, saveContact, removeContact, showToast } = useApp();
  const [editing, setEditing] = useState<TrustedContact | null>(null);
  const [removing, setRemoving] = useState<TrustedContact | null>(null);
  function newContact() {
    setEditing({ id: `contact-${Date.now()}`, name: "", relationship: "", phone: "", initials: "", color: colors[state.contacts.length % colors.length], preference: "all", active: true, defaultForJourneys: false, emergencyAlerts: true });
  }
  function updateContact(contact: TrustedContact, update: Partial<TrustedContact>) { saveContact({ ...contact, ...update }); }
  return <div className="view-stack">
    <header className="view-heading"><div><p className="eyebrow"><UsersRound size={15} />{t("home.peopleTrust")}</p><h1>{t("circle.title")}</h1><p>{t("circle.subtitle")}</p></div><Button onClick={newContact}><Plus size={18} />{t("circle.add")}</Button></header>
    <Card className="privacy-banner"><ShieldCheck size={21} /><p>{t("circle.privacy")}</p></Card>
    <div className="contact-card-list">{state.contacts.map((contact) => <Card key={contact.id} className={`contact-card ${!contact.active ? "muted" : ""}`}>
      <div className="contact-main"><Avatar initials={contact.initials} color={contact.color} size="lg" /><div><div className="contact-title"><h2>{contact.name}</h2><span className={`state-pill ${contact.active ? "active" : ""}`}>{contact.active ? t("common.active") : t("common.inactive")}</span></div><p>{contact.relationship} · {contact.phone}</p><span className="preference-pill"><Bell size={14} />{contact.preference === "all" ? t("circle.allUpdates") : contact.preference === "emergency" ? t("circle.emergencyOnly") : t("circle.none")}</span></div><div className="contact-actions"><button onClick={() => setEditing(contact)} aria-label={`${t("common.edit")} ${contact.name}`}><Edit3 size={18} /></button><button onClick={() => setRemoving(contact)} aria-label={`${t("common.remove")} ${contact.name}`}><Trash2 size={18} /></button></div></div>
      <div className="contact-toggles"><Toggle checked={contact.active} onChange={(value) => updateContact(contact, { active: value })} label={contact.active ? t("common.active") : t("common.inactive")} /><Toggle checked={contact.defaultForJourneys} onChange={(value) => updateContact(contact, { defaultForJourneys: value })} label={t("circle.default")} /><Toggle checked={contact.emergencyAlerts} onChange={(value) => updateContact(contact, { emergencyAlerts: value })} label={t("circle.emergency")} /></div>
    </Card>)}</div>
    <ContactDialog contact={editing} onClose={() => setEditing(null)} onSave={(contact) => { saveContact(contact); setEditing(null); showToast(t("circle.saved")); }} />
    <Dialog open={Boolean(removing)} onClose={() => setRemoving(null)} title={t("circle.removeTitle")} description={t("circle.removeText")}><div className="dialog-actions"><Button variant="ghost" onClick={() => setRemoving(null)}>{t("common.cancel")}</Button><Button variant="danger" onClick={() => { if (removing) removeContact(removing.id); setRemoving(null); showToast(t("circle.removed")); }}>{t("common.remove")}</Button></div></Dialog>
  </div>;
}

function ContactDialog({ contact, onClose, onSave }: { contact: TrustedContact | null; onClose: () => void; onSave: (contact: TrustedContact) => void }) {
  const { t, state } = useApp();
  const [draft, setDraft] = useState<TrustedContact | null>(null);
  const activeDraft = contact && draft?.id === contact.id ? draft : contact;
  if (!contact || !activeDraft) return null;
  const base: TrustedContact = activeDraft;
  function update(update: Partial<TrustedContact>) { setDraft({ ...base, ...update }); }
  const existing = state.contacts.some((item) => item.id === contact.id);
  return <Dialog open title={existing ? t("circle.editTitle") : t("circle.addTitle")} onClose={onClose}><div className="form-grid"><Field label={t("circle.name")}><TextInput value={base.name} onChange={(e) => { const name = e.target.value; update({ name, initials: name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") }); }} /></Field><Field label={t("circle.relationship")}><TextInput value={base.relationship} onChange={(e) => update({ relationship: e.target.value })} /></Field><Field label={t("circle.phone")}><TextInput type="tel" value={base.phone} onChange={(e) => update({ phone: e.target.value })} /></Field><Field label={t("circle.preference")}><SelectInput value={base.preference} onChange={(e) => update({ preference: e.target.value as NotificationPreference })}><option value="all">{t("circle.allUpdates")}</option><option value="emergency">{t("circle.emergencyOnly")}</option><option value="none">{t("circle.none")}</option></SelectInput></Field></div><div className="dialog-actions"><Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button><Button onClick={() => base.name.trim() && base.phone.trim() && onSave(base)}><UserRoundPlus size={18} />{t("common.save")}</Button></div></Dialog>;
}
