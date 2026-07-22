"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BellRing, CarFront, Check, LockKeyhole, MapPin, Navigation, PhoneCall, ShieldCheck, UsersRound } from "lucide-react";
import Lenis from "lenis";
import { useApp } from "@/components/app/AppProvider";
import { Avatar, Button, Card, CompactLanguageSwitcher, Progress, ThemeSelector } from "@/components/ui/Primitives";
import { Logo } from "@/components/ui/Logo";
import { formatNumber, formatTime } from "@/lib/i18n/format";

const faqIds = ["liveLocation", "permission", "phoneLocked", "offline", "sharingStops", "services", "messages", "askHelp", "regions", "free", "mapConnection"] as const;

export function LandingPage() {
  const { t, state, beginCleanSetup } = useApp();
  const router = useRouter();
  const [previewSafe, setPreviewSafe] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (state.privacy.reducedMotion || prefersReducedMotion.matches) return;

    const lenis = new Lenis({ autoRaf: true });

    return () => lenis.destroy();
  }, [state.privacy.reducedMotion]);

  const steps = [
    { icon: MapPin, title: t("landing.step1Title"), text: t("landing.step1Text") },
    { icon: UsersRound, title: t("landing.step2Title"), text: t("landing.step2Text") },
    { icon: BellRing, title: t("landing.step3Title"), text: t("landing.step3Text") },
  ];
  const helpFeatures = [
    { icon: PhoneCall, title: t("landing.emergencyDialerTitle"), text: t("landing.emergencyDialerText") },
    { icon: BellRing, title: t("landing.emergencyContactTitle"), text: t("landing.emergencyContactText") },
    { icon: Navigation, title: t("landing.emergencyLocationTitle"), text: t("landing.emergencyLocationText") },
  ];
  const demoDistance = `${formatNumber(7.4, state.user.locale, { maximumFractionDigits: 1 })} km`;
  const demoUpdatedAt = formatTime(new Date(2026, 0, 15, 20, 42), state.user.locale);
  const demoDuration = formatNumber(26, state.user.locale);

  function startSetup() {
    beginCleanSetup();
    router.push("/onboarding");
  }

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="landing-nav shell-width">
          <Logo />
          <nav aria-label={t("landing.navigationLabel")}><a href="#how">{t("landing.how")}</a><a href="#help">{t("landing.getHelp")}</a><a href="#privacy">{t("landing.privacy")}</a><a href="#faq">{t("landing.faq")}</a></nav>
          <div className="landing-nav-actions"><CompactLanguageSwitcher /><Link href="/launch" className="button button-secondary button-sm">{t("common.openHalovia")}<ArrowRight size={16} /></Link></div>
        </div>
      </header>

      <main>
        <section className="hero shell-width">
          <div className="hero-copy">
            <h1>{t("landing.heroTitle")}</h1>
            <p>{t("landing.heroText")}</p>
            <div className="hero-actions">
              <Button size="lg" onClick={startSetup}>{t("landing.setup")}<ArrowRight size={18} /></Button>
              <div className="hero-viewer-note">
                <span className="mini-avatar-stack" aria-hidden="true"><Avatar initials="D" color="#7c6ee6" size="sm" /><Avatar initials="K" color="#ce6685" size="sm" /></span>
                <span>{t("landing.demoContacts")}</span>
              </div>
              <a href="#how" className="hero-how-link">{t("landing.how")}<ArrowRight size={18} /></a>
            </div>
          </div>

          <div className="hero-visual" aria-label={t("landing.previewLabel")}>
            <div className="halo-orbit orbit-one" /><div className="halo-orbit orbit-two" />
            <Card className="phone-preview active-preview">
              <div className="preview-top"><Logo compact /><span className="preview-live"><span />{t("landing.previewInProgress")}</span></div>
              <div className="preview-destination"><span className="destination-icon"><Navigation size={18} /></span><div><small>{t("home.destination")}</small><strong>{t("landing.demoDestination")}</strong></div></div>
              <div className="mini-map" aria-hidden="true"><span className="mini-road r1" /><span className="mini-road r2" /><span className="mini-route mr1" /><span className="mini-route mr2" /><span className="mini-route mr3" /><span className="mini-pin mini-pin-start"><Navigation size={12} /></span><span className="mini-vehicle"><CarFront size={12} /></span><span className="mini-pin mini-pin-end"><MapPin size={13} /></span><span className="mini-distance">{demoDistance}</span></div>
              <Progress value={54} label={t("landing.journeyProgress")} />
              <div className="preview-stats"><span><small>{t("landing.updatedAt")}</small><strong>{demoUpdatedAt}</strong></span><span><small>{t("home.duration")}</small><strong>{demoDuration} {t("common.minutes")}</strong></span></div>
              <div className="preview-viewers"><span className="mini-avatar-stack"><Avatar initials="D" color="#7c6ee6" size="sm" /><Avatar initials="K" color="#ce6685" size="sm" /></span><span>{t("landing.demoContacts")}</span><Check size={16} /></div>
              <Button variant={previewSafe ? "safe" : "primary"} size="lg" className="preview-safe" onClick={() => setPreviewSafe(true)}><ShieldCheck size={19} />{previewSafe ? t("landing.safeConfirmed") : t("landing.imSafe")}</Button>
            </Card>
            <div className="floating-card floating-status"><span className="pulse-dot" aria-hidden="true" /><span><small>{t("status.onRoute")}</small><strong>{t("tracking.updatedJustNow")}</strong></span></div>
            <div className="floating-card floating-privacy"><LockKeyhole size={18} /><span>{t("landing.endAnytime")}</span></div>
          </div>
        </section>

        <section id="how" className="section shell-width how-section">
          <div className="section-heading"><span className="eyebrow">01 · {t("landing.how")}</span><h2>{t("landing.howTitle")}</h2><p>{t("landing.howText")}</p></div>
          <div className="three-grid">{steps.map(({ icon: Icon, title, text }, index) => <Card key={title} className="step-card"><span className="card-number">0{index + 1}</span><span className="feature-icon"><Icon size={22} /></span><h3>{title}</h3><p>{text}</p></Card>)}</div>
        </section>

        <section id="help" className="section section-tint">
          <div className="shell-width">
            <div className="section-heading"><span className="eyebrow">02 · {t("landing.getHelp")}</span><h2>{t("landing.emergencyHeading")}</h2><p>{t("landing.emergencyIntro")}</p></div>
            <div className="three-grid">{helpFeatures.map(({ icon: Icon, title, text }) => <Card key={title} className="feature-card"><span className="feature-icon"><Icon size={22} /></span><h3>{title}</h3><p>{text}</p></Card>)}</div>
            <p className="help-confirmation"><ShieldCheck size={17} />{t("landing.nothingSent")}</p>
            <Link href="/safety-limitations" className="subtle-section-link">{t("footer.safety")}<ArrowRight size={16} /></Link>
          </div>
        </section>

        <section id="privacy" className="section shell-width privacy-section">
          <div className="privacy-visual"><div className="privacy-halo"><LockKeyhole size={34} /><span className="privacy-dot dot-a" /><span className="privacy-dot dot-b" /><span className="privacy-dot dot-c" /></div></div>
          <div className="privacy-copy"><span className="eyebrow">03 · {t("landing.privacy")}</span><h2>{t("landing.privacyTitle")}</h2><p>{t("landing.privacyText")}</p><ul><li><Check size={17} />{t("landing.privatePeople")}</li><li><Check size={17} />{t("landing.endAnytime")}</li><li><Check size={17} />{t("landing.noAds")}</li><li><Check size={17} />{t("landing.informationProtected")}</li></ul><Link href="/privacy" className="button button-secondary button-md">{t("footer.privacy")}<ArrowRight size={17} /></Link></div>
        </section>

        <section id="themes" className="section section-tint">
          <div className="shell-width theme-showcase">
            <div className="section-heading"><span className="eyebrow">{t("landing.themeEyebrow")}</span><h2>{t("landing.themeTitle")}</h2><p>{t("landing.themeText")}</p></div>
            <div className="landing-theme-selector"><ThemeSelector previews /></div>
          </div>
        </section>

        <section id="faq" className="section section-tint"><div className="shell-width faq-shell"><div className="section-heading"><span className="eyebrow">04 · {t("landing.faq")}</span><h2>{t("landing.faqTitle")}</h2><p>{t("landing.faqText")}</p></div><div className="faq-list">{faqIds.map((id) => <details key={id}><summary><span>{t(`faq.${id}.question` as Parameters<typeof t>[0])}</span><span className="faq-plus" aria-hidden="true">+</span></summary><div><p>{t(`faq.${id}.answer` as Parameters<typeof t>[0])}</p></div></details>)}</div></div></section>

        <section className="final-cta shell-width"><div><span className="eyebrow"><ShieldCheck size={15} />Halovia</span><h2>{t("landing.ctaTitle")}</h2><p>{t("landing.ctaText")}</p></div><Button size="lg" onClick={startSetup}>{t("landing.setup")}<ArrowRight size={18} /></Button></section>
      </main>

      <footer className="landing-footer">
        <div className="shell-width landing-footer-grid">
          <div className="landing-footer-brand"><Logo /><p>{t("landing.footerText")}</p></div>
          <nav aria-label={t("footer.navigation")}><Link href="/privacy">{t("footer.privacy")}</Link><Link href="/terms">{t("footer.terms")}</Link><Link href="/safety-limitations">{t("footer.safety")}</Link><Link href="/feedback">{t("footer.feedback")}</Link><Link href="/report-problem">{t("footer.report")}</Link></nav>
          <p className="landing-footer-disclaimer">{t("disclaimer")}</p>
        </div>
      </footer>
    </div>
  );
}
