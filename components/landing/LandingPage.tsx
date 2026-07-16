"use client";

import Link from "next/link";
import { ArrowRight, BellRing, Check, ChevronRight, Globe2, LockKeyhole, MapPin, Navigation, PhoneCall, Route, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { Avatar, Button, Card, Progress } from "@/components/ui/Primitives";
import { Logo } from "@/components/ui/Logo";

export function LandingPage() {
  const { t } = useApp();
  const steps = [
    { icon: MapPin, title: t("landing.step1Title"), text: t("landing.step1Text") },
    { icon: UsersRound, title: t("landing.step2Title"), text: t("landing.step2Text") },
    { icon: BellRing, title: t("landing.step3Title"), text: t("landing.step3Text") },
  ];
  const features = [
    { icon: Route, title: t("landing.feature1Title"), text: t("landing.feature1Text") },
    { icon: ShieldCheck, title: t("landing.feature2Title"), text: t("landing.feature2Text") },
    { icon: PhoneCall, title: t("landing.feature3Title"), text: t("landing.feature3Text") },
  ];
  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="landing-nav shell-width">
          <Logo />
          <nav aria-label="Landing navigation">
            <a href="#features">{t("landing.features")}</a>
            <a href="#how">{t("landing.how")}</a>
            <a href="#privacy">{t("landing.privacy")}</a>
          </nav>
          <Link href="/onboarding" className="button button-secondary button-sm">{t("common.openApp")}<ArrowRight size={16} /></Link>
        </div>
      </header>

      <main>
        <section className="hero shell-width">
          <div className="hero-copy">
            <span className="eyebrow"><Sparkles size={15} />{t("landing.eyebrow")}</span>
            <h1>{t("landing.heroTitle")}</h1>
            <p>{t("landing.heroText")}</p>
            <div className="hero-actions">
              <Link href="/onboarding" className="button button-primary button-lg">{t("landing.start")}<ArrowRight size={18} /></Link>
              <a href="#how" className="button button-ghost button-lg">{t("landing.seeHow")}<ChevronRight size={18} /></a>
            </div>
            <div className="trust-note"><span className="mini-avatar-stack"><Avatar initials="AR" color="#7c6ee6" size="sm" /><Avatar initials="KM" color="#e07b8f" size="sm" /><Avatar initials="MR" color="#4f9f8f" size="sm" /></span><span>{t("landing.viewing")}</span></div>
          </div>

          <div className="hero-visual" aria-label={t("landing.liveJourney")}>
            <div className="halo-orbit orbit-one" /><div className="halo-orbit orbit-two" />
            <Card className="phone-preview">
              <div className="preview-top"><Logo compact /><div className="preview-live"><span />{t("landing.liveJourney")}</div></div>
              <div className="preview-destination"><span className="destination-icon"><Navigation size={18} /></span><div><small>{t("home.destination")}</small><strong>{t("landing.onRoute")}</strong></div></div>
              <div className="mini-map">
                <span className="mini-road r1" /><span className="mini-road r2" />
                <span className="mini-route mr1" /><span className="mini-route mr2" /><span className="mini-route mr3" />
                <span className="mini-pin mini-pin-start"><Navigation size={12} /></span><span className="mini-pin mini-pin-end"><MapPin size={13} /></span>
              </div>
              <Progress value={58} label={t("active.progress")} />
              <div className="preview-stats"><span><small>{t("home.eta")}</small><strong>8:42 PM</strong></span><span><small>{t("home.duration")}</small><strong>26 {t("common.minutes")}</strong></span></div>
              <div className="preview-viewers"><span className="mini-avatar-stack"><Avatar initials="AR" color="#7c6ee6" size="sm" /><Avatar initials="KM" color="#e07b8f" size="sm" /></span><span>{t("landing.viewing")}</span><Check size={16} /></div>
              <Button size="lg" className="preview-safe"><ShieldCheck size={19} />{t("home.imSafe")}</Button>
            </Card>
            <div className="floating-card floating-status"><span className="pulse-dot" /><div><small>{t("status.onRoute")}</small><strong>{t("common.lastUpdated")}</strong></div></div>
            <div className="floating-card floating-privacy"><LockKeyhole size={18} /><span>{t("landing.localFirst")}</span></div>
          </div>
        </section>

        <section id="how" className="section shell-width how-section">
          <div className="section-heading"><span className="eyebrow">01 · {t("landing.how")}</span><h2>{t("landing.howTitle")}</h2><p>{t("landing.howText")}</p></div>
          <div className="three-grid">{steps.map(({ icon: Icon, title, text }, index) => <Card key={title} className="step-card"><span className="card-number">0{index + 1}</span><span className="feature-icon"><Icon size={22} /></span><h3>{title}</h3><p>{text}</p></Card>)}</div>
        </section>

        <section id="features" className="section section-tint">
          <div className="shell-width"><div className="section-heading"><span className="eyebrow">02 · {t("landing.features")}</span><h2>{t("landing.featuresTitle")}</h2></div><div className="three-grid">{features.map(({ icon: Icon, title, text }) => <Card key={title} className="feature-card"><span className="feature-icon"><Icon size={22} /></span><h3>{title}</h3><p>{text}</p></Card>)}</div></div>
        </section>

        <section id="privacy" className="section shell-width privacy-section">
          <div className="privacy-visual"><div className="privacy-halo"><LockKeyhole size={34} /><span className="privacy-dot dot-a" /><span className="privacy-dot dot-b" /><span className="privacy-dot dot-c" /></div></div>
          <div className="privacy-copy"><span className="eyebrow">03 · {t("landing.privacy")}</span><h2>{t("landing.privacyTitle")}</h2><p>{t("landing.privacyText")}</p><ul><li><Check size={17} />{t("landing.localFirst")}</li><li><Check size={17} />{t("landing.noAds")}</li><li><Check size={17} />{t("landing.endAnytime")}</li></ul></div>
        </section>

        <section className="section shell-width themes-language">
          <Card className="showcase-card"><div><span className="eyebrow"><Sparkles size={15} />{t("settings.theme")}</span><h2>{t("landing.themesTitle")}</h2><p>{t("landing.themesText")}</p></div><div className="theme-fan"><span className="fan-light"><i /><i /></span><span className="fan-dark"><i /><i /></span><span className="fan-pink"><i /><i /></span></div></Card>
          <Card className="showcase-card language-showcase"><div><span className="eyebrow"><Globe2 size={15} />{t("settings.language")}</span><h2>{t("landing.languagesTitle")}</h2><p>{t("landing.languagesText")}</p></div><div className="language-pills"><span>English</span><span>हिन्दी</span><span>Español</span></div></Card>
        </section>

        <section className="final-cta shell-width"><div><span className="eyebrow"><ShieldCheck size={15} />Halovia</span><h2>{t("landing.ctaTitle")}</h2><p>{t("landing.ctaText")}</p></div><Link href="/onboarding" className="button button-primary button-lg">{t("landing.start")}<ArrowRight size={18} /></Link></section>
      </main>

      <footer className="landing-footer"><div className="shell-width"><Logo /><p>{t("landing.footerText")}</p><p>{t("disclaimer")}</p></div></footer>
    </div>
  );
}
