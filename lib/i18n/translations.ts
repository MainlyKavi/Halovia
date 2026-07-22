import type { Language } from "../types.ts";
import { ar } from "./locales/ar.ts";
import { bn } from "./locales/bn.ts";
import { consumerOverrides } from "./locales/consumer-overrides.ts";
import { en, type EnglishTranslationKey } from "./locales/en.ts";
import { es } from "./locales/es.ts";
import { fr } from "./locales/fr.ts";
import { hi } from "./locales/hi.ts";
import { ru } from "./locales/ru.ts";
import { ta } from "./locales/ta.ts";
import { ur } from "./locales/ur.ts";

export type TranslationKey = EnglishTranslationKey;
export type TranslationDictionary = Record<TranslationKey, string>;

function complete(locale: Partial<Record<string, string>>): TranslationDictionary {
  return Object.fromEntries(Object.keys(en).map((key) => [key, locale[key] ?? en[key as TranslationKey]])) as TranslationDictionary;
}

// Hindi and Arabic began as prototype-era dictionaries. Keep their translated
// interface chrome, but prefer the current English source for claims whose old
// wording described browser-only storage, simulated sharing, or fake alerts.
// This is safer than presenting a polished translation that is materially false.
const currentTruthKeys: TranslationKey[] = [
  "landing.ctaGuidance", "landing.howText", "landing.step1Text", "landing.step2Text", "landing.step3Text",
  "landing.logicText", "landing.intendedBehaviour", "landing.haloviaApproachTitle", "landing.halovia1", "landing.halovia2", "landing.halovia3",
  "landing.emergencyContactTitle", "landing.emergencyContactText", "landing.emergencyLocationTitle", "landing.emergencyLocationText",
  "landing.prototypeAction", "landing.privacyTitle", "landing.privacyText", "landing.languagesText", "landing.faqText", "landing.earlyPrototype",
  "landing.feedbackText", "landing.ctaText", "faq.prototype.answer", "faq.liveLocation.answer", "faq.trigger.answer", "faq.noResponse.answer",
  "faq.offline.answer", "faq.phoneDies.answer", "faq.contactNoResponse.answer", "faq.sharingStops.answer", "faq.storage.answer",
  "faq.regions.answer", "faq.free.answer", "onboarding.welcomeText", "onboarding.nameText", "onboarding.locationText",
  "onboarding.locationAllowed", "onboarding.notificationsText", "onboarding.readyText", "home.contactsLocalCopy", "home.noContactsText",
  "home.quickEmergencyText", "home.noActiveText", "start.subtitle", "start.currentHint", "start.vehicleText", "start.imageRules",
  "start.imageStoredLocally", "start.imageLocalDisclosure", "start.imageStorageError", "start.imageSizeError", "start.selectContacts",
  "start.privacy", "start.noContactsWarning", "start.final", "start.confirmTitle", "start.confirmText", "start.confirmPrototype",
  "active.contactsNoAccess", "active.statusPrototypeCopy", "active.helpLocalState", "active.escalationLocalState", "active.lastLocation",
  "safety.text", "safety.prototype", "safety.alerted", "safety.explainHelp", "safety.explainTimeout", "safety.helpRecorded",
  "emergency.subtitle", "emergency.prototypeText", "emergency.alert", "emergency.alertText", "emergency.locationText",
  "emergency.infoText", "emergency.simulationOnly", "emergency.networkCopy", "emergency.simulationConfirm", "emergency.noMessageSent",
  "emergency.noSavedJourney", "emergency.locationCopied", "emergency.copyFailed", "emergency.infoTitle", "emergency.infoDescription",
  "emergency.journeyStored", "circle.subtitle", "circle.privacy", "circle.preference", "circle.contactHint", "circle.saved",
  "circle.emptyText", "journeyEnd.description", "journeyEnd.sharing", "journeys.subtitle", "journeys.prototypeEscalation",
  "journeys.timeline", "journeys.deleteText", "status.helpRequested", "status.prototypeEscalated", "settings.subtitle",
  "settings.locationDescription", "settings.storageDisclosure", "settings.clearText", "settings.aboutText", "page.privacy.title",
  "page.privacy.intro", "page.privacy.section1Text", "page.privacy.section2Text", "page.privacy.section3Text", "page.privacy.section4Text",
  "page.privacy.section5Text", "page.terms.title", "page.terms.intro", "page.terms.section1Title", "page.terms.section1Text",
  "page.terms.section3Title", "page.terms.section4Text", "page.safety.section2Text", "page.safety.section3Text",
  "page.feedback.intro", "page.report.intro", "page.form.localOnly", "page.form.copy", "page.form.copied", "page.form.error",
  "page.form.guidance", "page.offline.intro", "offline.location", "offline.alerts", "security.title", "security.intro",
  "viewer.prototypeIdentity", "viewer.simulatedLocation", "viewer.prototypeEscalated", "viewer.noPublicSharing",
];

function withCurrentTruth(locale: Partial<Record<string, string>>): Partial<Record<string, string>> {
  return { ...locale, ...Object.fromEntries(currentTruthKeys.map((key) => [key, en[key]])) };
}

export const translations = {
  en,
  hi: complete({ ...withCurrentTruth(hi), ...consumerOverrides.hi }),
  es: complete(es),
  fr: complete(fr),
  ru: complete(ru),
  ur: complete({ ...withCurrentTruth(ur), ...consumerOverrides.ur }),
  bn: complete({ ...withCurrentTruth(bn), ...consumerOverrides.bn }),
  ta: complete({ ...withCurrentTruth(ta), ...consumerOverrides.ta }),
  ar: complete({ ...withCurrentTruth(ar), ...consumerOverrides.ar }),
} satisfies Record<Language, TranslationDictionary>;
