"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Home, LogOut, MapPinned, Settings, ShieldAlert, UsersRound } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { CompactLanguageSwitcher, LoadingSkeleton, Toast } from "@/components/ui/Primitives";
import { useApp } from "@/components/app/AppProvider";

const nav = [
  { href: "/home", key: "nav.home", icon: Home },
  { href: "/journeys", key: "nav.journeys", icon: MapPinned },
  { href: "/circle", key: "nav.circle", icon: UsersRound },
  { href: "/settings", key: "nav.settings", icon: Settings },
] as const;

export function AppShell({ route, children }: { route: string; children: React.ReactNode }) {
  const { state, t, ready, beginCleanSetup } = useApp();
  const router = useRouter();
  useEffect(() => {
    if (ready && state.mode === "clean" && !state.user.onboardingComplete) router.replace("/onboarding");
  }, [ready, router, state.mode, state.user.onboardingComplete]);
  if (!ready || (state.mode === "clean" && !state.user.onboardingComplete)) return <main className="centered-loading"><LoadingSkeleton /></main>;
  function exitDemo() {
    beginCleanSetup();
    router.push("/onboarding");
  }
  return (
    <div className="app-frame">
      <aside className="desktop-sidebar">
        <Logo href="/home" />
        <CompactLanguageSwitcher className="sidebar-language" />
        <nav aria-label={t("landing.navigationLabel")}>
          {nav.map(({ href, key, icon: Icon }) => {
            const active = route === href || (href === "/journeys" && route.startsWith("/journeys/"));
            return <Link key={href} href={href} className={`side-nav-link ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}><Icon size={20} /><span>{t(key)}</span></Link>;
          })}
        </nav>
        <div className="sidebar-spacer" />
        {state.mode === "demo" && <button type="button" className="sidebar-exit-demo" onClick={exitDemo}><LogOut size={18} /><span>{t("demo.exit")}</span></button>}
        <Link href="/emergency" className="sidebar-emergency"><ShieldAlert size={20} /><span>{t("nav.emergency")}</span></Link>
        <p className="sidebar-disclaimer"><AlertTriangle size={14} />{t("disclaimer")}</p>
      </aside>

      <main className="app-main">
        {state.mode === "demo" && <div className="demo-banner"><AlertTriangle size={17} /><strong>{t("common.demoData")}</strong><span>{t("demo.banner")}</span><button type="button" onClick={exitDemo}>{t("demo.startClean")}</button></div>}
        <header className="mobile-app-header">
          <Logo href="/home" />
          <div className="mobile-header-actions"><CompactLanguageSwitcher /><Link href="/emergency" className="header-emergency" aria-label={t("nav.emergency")}><ShieldAlert size={20} /></Link></div>
        </header>
        <div className="view-container">{children}</div>
        <p className="mobile-disclaimer">{t("disclaimer")}</p>
      </main>

      <nav className="bottom-nav" aria-label={t("landing.navigationLabel")}>
        {nav.map(({ href, key, icon: Icon }) => {
          const active = route === href || (href === "/journeys" && route.startsWith("/journeys/"));
          return <Link key={href} href={href} className={`bottom-nav-link ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}><Icon size={21} /><span>{t(key)}</span></Link>;
        })}
      </nav>
      <Toast />
    </div>
  );
}
