"use client";

import { useState } from "react";
import { UserRoundPlus } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { Button, Field, SelectInput, TextInput } from "@/components/ui/Primitives";
import { createId } from "@/lib/state/app-state";
import type { NotificationPreference, TrustedContact } from "@/lib/types";

const colors = ["#7c6ee6", "#ce6685", "#4f9f8f", "#d18745"];

export function createBlankContact(index = 0): TrustedContact {
  return {
    id: createId("contact"),
    name: "",
    relationship: "",
    phone: "",
    initials: "",
    color: colors[index % colors.length],
    preference: "all",
    active: true,
    defaultForJourneys: false,
    emergencyAlerts: true,
  };
}

export function ContactEditor({ contact, onCancel, onSave }: { contact: TrustedContact; onCancel: () => void; onSave: (contact: TrustedContact) => void }) {
  const { t } = useApp();
  const [draft, setDraft] = useState(contact);
  const [error, setError] = useState("");

  function update(values: Partial<TrustedContact>) {
    setDraft((current) => ({ ...current, ...values }));
  }

  function submit() {
    const name = draft.name.trim();
    const phone = draft.phone.trim();
    if (!name || phone.length < 3) {
      setError(t("circle.validation"));
      return;
    }
    const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
    onSave({ ...draft, name, phone, relationship: draft.relationship.trim(), initials });
  }

  return <div className="contact-editor">
    <div className="form-grid">
      <Field label={t("circle.name")}><TextInput value={draft.name} onChange={(event) => update({ name: event.target.value })} autoComplete="name" /></Field>
      <Field label={t("circle.relationship")}><TextInput value={draft.relationship} onChange={(event) => update({ relationship: event.target.value })} /></Field>
      <Field label={t("circle.phone")} hint={t("circle.contactHint")}><TextInput value={draft.phone} onChange={(event) => update({ phone: event.target.value })} autoComplete="tel" /></Field>
      <Field label={t("circle.preference")}><SelectInput value={draft.preference} onChange={(event) => update({ preference: event.target.value as NotificationPreference })}><option value="all">{t("circle.allUpdates")}</option><option value="emergency">{t("circle.emergencyOnly")}</option><option value="none">{t("circle.none")}</option></SelectInput></Field>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <p className="prototype-note">{t("circle.noInvitation")}</p>
    <div className="dialog-actions"><Button variant="ghost" onClick={onCancel}>{t("common.cancel")}</Button><Button onClick={submit}><UserRoundPlus size={18} />{t("common.save")}</Button></div>
  </div>;
}
