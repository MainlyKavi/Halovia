"use client";

import { LockKeyhole, MapPinned, ShieldCheck } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { Card, CompactLanguageSwitcher } from "@/components/ui/Primitives";
import { Logo } from "@/components/ui/Logo";

export function SignInRequired({ returnTo }: { returnTo: string }) {
  const { t } = useApp();
  const signInUrl = `/signin-with-chatgpt?return_to=${encodeURIComponent(returnTo.startsWith("/") ? returnTo : "/home")}`;
  return (
    <main className="auth-page">
      <header className="public-header"><Logo /><CompactLanguageSwitcher /></header>
      <Card className="auth-card">
        <span className="auth-icon"><LockKeyhole size={28} /></span>
        <p className="eyebrow"><ShieldCheck size={15} />Halovia</p>
        <h1>{t("auth.requiredTitle")}</h1>
        <p>{t("auth.requiredText")}</p>
        <a className="button button-primary button-lg" href={signInUrl}><MapPinned size={18} />{t("auth.signIn")}</a>
        <small>{t("auth.setupNote")}</small>
      </Card>
    </main>
  );
}
