"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, BellRing, Check, Globe2, LockKeyhole, MapPin, MonitorSmartphone, Navigation, PhoneCall, ShieldCheck, Sparkles, UsersRound } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { Avatar, Button, Card, CompactLanguageSwitcher, Progress } from "@/components/ui/Primitives";
import { Logo } from "@/components/ui/Logo";
import { formatTime } from "@/lib/i18n/format";

const faqIds = ["prototype", "services", "liveLocation", "trigger", "noResponse", "offline", "phoneDies", "contactNoResponse", "sharingStops", "storage", "regions", "free", "platform"] as const;

export function LandingPage() {
  const { state, t, beginCleanSetup, loadDemo } = useApp();
  const router = useRouter();
  const demoEta = formatTime("2030-01-01T20:00:00", state.user.locale);
  const steps = [
    { icon: MapPin, title: t("landing.step1Title"), text: t("landing.step1Text") },
    { icon: UsersRound, title: t("landing.step2Title"), text: t("landing.step2Text") },
    { icon: BellRing, title: t("landing.step3Title"), text: t("landing.step3Text") },
  ];
  const emergencyFeatures = [
    { icon: PhoneCall, title: t("landing.emergencyDialerTitle"), text: t("landing.emergencyDialerText") },
    { icon: BellRing, title: t("landing.emergencyContactTitle"), text: t("landing.emergencyContactText") },
    { icon: Navigation, title: t("landing.emergencyLocationTitle"), text: t("landing.emergencyLocationText") },
  ];

  function startSetup() {
    beginCleanSetup();
    router.push("/onboarding");
  }

  function exploreDemo() {
    loadDemo();
    router.push("/active");
  }

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="landing-nav shell-width">
          <Logo />
          <nav aria-label={t("landing.navigationLabel")}><a href="#how">{t("landing.how")}</a><a href="#approach">{t("landing.approach")}</a><a href="#privacy">{t("landing.privacy")}</a><a href="#faq">{t("landing.faq")}</a></nav>
          <div className="landing-nav-actions"><CompactLanguageSwitcher /><Link href="/launch" className="button button-secondary button-sm">{t("common.openHalovia")}<ArrowRight size={16} /></Link></div>
        </div>
      </header>

      <main>
        <section className="hero shell-width">
          <div className="hero-copy">
            <h1>{t("landing.heroTitle")}</h1>
            <p>{t("landing.heroText")}</p>
            <div className="prototype-inline"><AlertTriangle size={17} /><span>{t("landing.heroPrototype")}</span></div>
            <div className="hero-actions">
              <Button size="lg" onClick={startSetup}>{t("landing.setup")}<ArrowRight size={18} /></Button>
              <Button variant="secondary" size="lg" onClick={exploreDemo}>{t("landing.exploreDemo")}<Sparkles size={18} /></Button>
            </div>
            <p className="cta-guidance">{t("landing.ctaGuidance")}</p>
            <div className="trust-strip" aria-label={t("landing.trustTitle")}><span><Check size={16} />{t("landing.noAccount")}</span><span><Check size={16} />{t("landing.deviceData")}</span><span><Check size={16} />{t("landing.noAds")}</span></div>
          </div>

          <div className="hero-visual" aria-label={t("landing.previewLabel")}>
            <div className="halo-orbit orbit-one" /><div className="halo-orbit orbit-two" />
            <Card className="phone-preview">
              <div className="preview-top"><Logo compact /><span className="demo-pill">{t("common.demoData")}</span></div>
              <div className="preview-destination"><span className="destination-icon"><Navigation size={18} /></span><div><small>{t("home.destination")}</small><strong>{t("landing.demoDestination")}</strong></div></div>
              <div className="mini-map"><span className="mini-road r1" /><span className="mini-road r2" /><span className="mini-route mr1" /><span className="mini-route mr2" /><span className="mini-route mr3" /><span className="mini-pin mini-pin-start"><Navigation size={12} /></span><span className="mini-pin mini-pin-end"><MapPin size={13} /></span></div>
              <Progress value={30} label={t("active.estimatedProgress")} />
              <div className="preview-stats"><span><small>{t("home.eta")}</small><strong>{demoEta}</strong></span><span><small>{t("home.duration")}</small><strong>40 {t("common.minutes")}</strong></span></div>
              <div className="preview-viewers"><span className="mini-avatar-stack"><Avatar initials="D1" color="#7c6ee6" size="sm" /><Avatar initials="D2" color="#ce6685" size="sm" /></span><span>{t("landing.demoContacts")}</span><Check size={16} /></div>
              <Button size="lg" className="preview-safe" onClick={exploreDemo}><ShieldCheck size={19} />{t("landing.exploreDemo")}</Button>
            </Card>
            <div className="floating-card floating-status"><span className="pulse-dot" /><div><small>{t("status.onRoute")}</small><strong>{t("landing.demoDestination")}</strong></div></div>
            <div className="floating-card floating-privacy"><LockKeyhole size={18} /><span>{t("landing.localFirst")}</span></div>
          </div>
        </section>

        <section id="how" className="section shell-width how-section">
          <div className="section-heading"><span className="eyebrow">01 · {t("landing.how")}</span><h2>{t("landing.howTitle")}</h2><p>{t("landing.howText")}</p></div>
          <div className="three-grid">{steps.map(({ icon: Icon, title, text }, index) => <Card key={title} className="step-card"><span className="card-number">0{index + 1}</span><span className="feature-icon"><Icon size={22} /></span><h3>{title}</h3><p>{text}</p></Card>)}</div>
        </section>

        <section id="approach" className="section section-tint">
          <div className="shell-width"><div className="section-heading"><span className="eyebrow">02 · {t("landing.approach")}</span><h2>{t("landing.logicTitle")}</h2><p>{t("landing.logicText")}</p></div>
            <div className="logic-comparison">
              <Card className="logic-card traditional"><h3>{t("landing.traditionalTitle")}</h3><div className="logic-timeline"><span /><span /><span /></div><ul><li>{t("landing.traditional1")}</li><li>{t("landing.traditional2")}</li><li>{t("landing.traditional3")}</li></ul></Card>
              <div className="comparison-arrow" aria-hidden="true"><ArrowRight size={24} /></div>
              <Card className="logic-card halovia"><h3>{t("landing.haloviaApproachTitle")}</h3><div className="logic-timeline calm"><span /><span /><span /></div><ul><li>{t("landing.halovia1")}</li><li>{t("landing.halovia2")}</li><li>{t("landing.halovia3")}</li></ul></Card>
            </div>
          </div>
        </section>

        <section className="section shell-width">
          <div className="section-heading"><span className="eyebrow">03 · {t("landing.emergencyTitle")}</span><h2>{t("landing.emergencyHeading")}</h2><p>{t("landing.emergencyIntro")}</p></div>
          <div className="three-grid">{emergencyFeatures.map(({ icon: Icon, title, text }) => <Card key={title} className="feature-card"><span className="feature-icon"><Icon size={22} /></span><h3>{title}</h3><p>{text}</p></Card>)}</div>
          <div className="safety-limit-banner"><AlertTriangle size={21} /><p>{t("landing.notEmergencyReplacement")}</p><Link href="/safety-limitations">{t("footer.safety")}</Link></div>
        </section>

        <section id="privacy" className="section shell-width privacy-section">
          <div className="privacy-visual"><div className="privacy-halo"><LockKeyhole size={34} /><span className="privacy-dot dot-a" /><span className="privacy-dot dot-b" /><span className="privacy-dot dot-c" /></div></div>
          <div className="privacy-copy"><span className="eyebrow">04 · {t("landing.privacy")}</span><h2>{t("landing.privacyTitle")}</h2><p>{t("landing.privacyText")}</p><ul><li><Check size={17} />{t("landing.localFirst")}</li><li><Check size={17} />{t("landing.noAds")}</li><li><Check size={17} />{t("landing.endAnytime")}</li></ul><Link href="/privacy" className="button button-secondary button-md">{t("footer.privacy")}<ArrowRight size={17} /></Link></div>
        </section>

        <section className="section shell-width themes-language">
          <Card className="showcase-card"><div><span className="eyebrow"><MonitorSmartphone size={15} />PWA</span><h2>{t("landing.platformTitle")}</h2><p>{t("landing.platformText")}</p></div><div className="platform-visual"><Globe2 size={31} /><span aria-hidden="true">+</span><MonitorSmartphone size={31} /></div></Card>
          <Card className="showcase-card language-showcase"><div><span className="eyebrow"><Globe2 size={15} />{t("settings.language")}</span><h2>{t("landing.languagesTitle")}</h2><p>{t("landing.languagesText")}</p></div><div className="language-pills"><span>English</span><span>हिन्दी</span><span>Español</span><span>Français</span><span>Русский</span><span>العربية</span></div></Card>
        </section>

        <section id="faq" className="section section-tint"><div className="shell-width faq-shell"><div className="section-heading"><span className="eyebrow">05 · FAQ</span><h2>{t("landing.faqTitle")}</h2><p>{t("landing.faqText")}</p></div><div className="faq-list">{faqIds.map((id) => <details key={id}><summary><span>{t(`faq.${id}.question` as Parameters<typeof t>[0])}</span><span className="faq-plus" aria-hidden="true">+</span></summary><div><p>{t(`faq.${id}.answer` as Parameters<typeof t>[0])}</p></div></details>)}</div></div></section>

        <section className="validation-section shell-width"><div><h2>{t("landing.feedbackTitle")}</h2><p>{t("landing.feedbackText")}</p></div><Link href="/feedback" className="button button-primary button-lg">{t("landing.shareFeedback")}<ArrowRight size={18} /></Link></section>

        <section className="final-cta shell-width"><div><span className="eyebrow"><ShieldCheck size={15} />Halovia</span><h2>{t("landing.ctaTitle")}</h2><p>{t("landing.ctaText")}</p></div><Button size="lg" onClick={startSetup}>{t("landing.setup")}<ArrowRight size={18} /></Button></section>
      </main>

      <footer className="landing-footer"><div className="shell-width"><Logo /><p>{t("landing.footerText")}</p><nav aria-label={t("footer.navigation")}><Link href="/privacy">{t("footer.privacy")}</Link><Link href="/terms">{t("footer.terms")}</Link><Link href="/safety-limitations">{t("footer.safety")}</Link><Link href="/feedback">{t("footer.feedback")}</Link><Link href="/report-problem">{t("footer.report")}</Link></nav><p>{t("disclaimer")}</p></div></footer>
    </div>
  );
}
