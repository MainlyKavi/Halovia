"use client";

import Link from "next/link";
import { AlertTriangle, Home, MapPinned, Settings, ShieldAlert, UsersRound } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { LoadingSkeleton, Toast } from "@/components/ui/Primitives";
import { useApp } from "@/components/app/AppProvider";

const nav = [
  { href: "/home", key: "nav.home", icon: Home },
  { href: "/journeys", key: "nav.journeys", icon: MapPinned },
  { href: "/circle", key: "nav.circle", icon: UsersRound },
  { href: "/settings", key: "nav.settings", icon: Settings },
] as const;

export function AppShell({ route, children }: { route: string; children: React.ReactNode }) {
  const { t, ready } = useApp();
  if (!ready) return <main className="centered-loading"><LoadingSkeleton /></main>;
  return (
    <div className="app-frame">
      <aside className="desktop-sidebar">
        <Logo href="/home" />
        <nav aria-label="Primary navigation">
          {nav.map(({ href, key, icon: Icon }) => {
            const active = route === href || (href === "/journeys" && route.startsWith("/journeys/"));
            return <Link key={href} href={href} className={`side-nav-link ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}><Icon size={20} /><span>{t(key)}</span></Link>;
          })}
        </nav>
        <div className="sidebar-spacer" />
        <Link href="/emergency" className="sidebar-emergency"><ShieldAlert size={20} /><span>{t("nav.emergency")}</span></Link>
        <p className="sidebar-disclaimer"><AlertTriangle size={14} />{t("disclaimer")}</p>
      </aside>

      <main className="app-main">
        <header className="mobile-app-header">
          <Logo href="/home" />
          <Link href="/emergency" className="header-emergency" aria-label={t("nav.emergency")}><ShieldAlert size={20} /></Link>
        </header>
        <div className="view-container">{children}</div>
        <p className="mobile-disclaimer">{t("disclaimer")}</p>
      </main>

      <nav className="bottom-nav" aria-label="Primary navigation">
        {nav.map(({ href, key, icon: Icon }) => {
          const active = route === href || (href === "/journeys" && route.startsWith("/journeys/"));
          return <Link key={href} href={href} className={`bottom-nav-link ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}><Icon size={21} /><span>{t(key)}</span></Link>;
        })}
      </nav>
      <Toast />
    </div>
  );
}
