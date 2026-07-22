import type {
  AppState,
  CountryCode,
  DateFormatPreference,
  HistoryRetention,
  Journey,
  Language,
  Locale,
  Theme,
} from "@/lib/types";

export const STORAGE_KEY = "halovia.prototype.v2";
export const LEGACY_STORAGE_KEY = "halovia.prototype.v1";

const languages: Language[] = ["en", "hi", "es", "fr", "ru", "ar"];
const locales: Locale[] = ["en-IN", "en-US", "hi-IN", "es-ES", "fr-FR", "ru-RU", "ar-SA"];
const countries: CountryCode[] = ["IN", "US", "ES", "FR", "RU", "SA", "OTHER"];
const themes: Theme[] = ["light", "dark", "pink"];
const dateFormats: DateFormatPreference[] = ["locale", "dayFirst", "monthFirst"];
const retentionOptions: HistoryRetention[] = ["auto", "7", "30", "manual"];

export function createId(prefix: string): string {
  const value = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${value}`;
}

export function clampProgress(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculateJourneyProgress(journey: Pick<Journey, "startedAt" | "eta" | "endedAt">, now = Date.now()): number {
  const start = new Date(journey.startedAt).getTime();
  const end = new Date(journey.eta).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  const effectiveNow = journey.endedAt ? new Date(journey.endedAt).getTime() : now;
  return clampProgress(((effectiveNow - start) / (end - start)) * 100);
}

export function applyHistoryRetention(history: Journey[], retention: HistoryRetention, now = Date.now()): Journey[] {
  if (retention === "manual") return history;
  if (retention === "auto") return [];
  const cutoff = now - Number(retention) * 24 * 60 * 60_000;
  return history.filter((journey) => {
    const timestamp = new Date(journey.endedAt ?? journey.startedAt).getTime();
    return Number.isFinite(timestamp) && timestamp >= cutoff;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function validEnum<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return typeof value === "string" && options.includes(value as T) ? (value as T) : fallback;
}

function normalizeJourney(value: unknown): Journey | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.startedAt !== "string" || typeof value.eta !== "string") return null;
  if (typeof value.origin !== "string" || typeof value.destination !== "string") return null;
  const base = value as unknown as Journey;
  const events = Array.isArray(value.events)
    ? value.events.filter((event) => isRecord(event) && typeof event.id === "string" && typeof event.type === "string" && typeof event.timestamp === "string")
    : [];
  return {
    ...base,
    contactIds: Array.isArray(value.contactIds) ? value.contactIds.filter((id): id is string => typeof id === "string") : [],
    events: events as Journey["events"],
    progress: clampProgress(typeof value.progress === "number" ? value.progress : 0),
    safetyCheckOccurred: Boolean(value.safetyCheckOccurred),
    prototypeEscalationTriggered: Boolean(value.prototypeEscalationTriggered),
    lastLocationUpdateAt: validString(value.lastLocationUpdateAt, value.startedAt),
    connectionStatus: value.connectionStatus === "offline" ? "offline" : "online",
    emergencyState:
      value.emergencyState === "helpRequested" || value.emergencyState === "prototypeEscalated"
        ? value.emergencyState
        : "none",
  };
}

export function normalizeAppState(value: unknown, fallback: AppState): AppState {
  if (!isRecord(value) || value.version !== 2) return fallback;
  const user = isRecord(value.user) ? value.user : {};
  const emergency = isRecord(value.emergency) ? value.emergency : {};
  const privacy = isRecord(value.privacy) ? value.privacy : {};
  const contacts = Array.isArray(value.contacts)
    ? value.contacts.filter((contact) => isRecord(contact) && typeof contact.id === "string" && typeof contact.name === "string")
    : [];
  const history = Array.isArray(value.history)
    ? value.history.map(normalizeJourney).filter((journey): journey is Journey => Boolean(journey))
    : [];
  const activeJourney = value.activeJourney === null ? null : normalizeJourney(value.activeJourney);
  const historyRetention = validEnum(privacy.historyRetention, retentionOptions, fallback.privacy.historyRetention);

  const normalized: AppState = {
    ...fallback,
    mode: value.mode === "demo" ? "demo" : "clean",
    user: {
      ...fallback.user,
      id: validString(user.id, fallback.user.id),
      name: validString(user.name, ""),
      language: validEnum(user.language, languages, fallback.user.language),
      locale: validEnum(user.locale, locales, fallback.user.locale),
      country: validEnum(user.country, countries, fallback.user.country),
      dateFormat: validEnum(user.dateFormat, dateFormats, fallback.user.dateFormat),
      theme: validEnum(user.theme, themes, fallback.user.theme),
      onboardingComplete: Boolean(user.onboardingComplete),
    },
    contacts: contacts as AppState["contacts"],
    history,
    activeJourney,
    safetyCheck: isRecord(value.safetyCheck) ? (value.safetyCheck as unknown as AppState["safetyCheck"]) : null,
    emergency: {
      ...fallback.emergency,
      number: validString(emergency.number, fallback.emergency.number),
      country: validEnum(emergency.country, countries, fallback.emergency.country),
      shareLastLocation: emergency.shareLastLocation !== false,
      soundAlarm: emergency.soundAlarm !== false,
    },
    privacy: {
      ...fallback.privacy,
      historyRetention,
      reducedMotion: Boolean(privacy.reducedMotion),
      notifications: Boolean(privacy.notifications),
      locationWhileActive: Boolean(privacy.locationWhileActive),
      soundEnabled: Boolean(privacy.soundEnabled),
      vibrationEnabled: Boolean(privacy.vibrationEnabled),
      safetyResponseSeconds:
        privacy.safetyResponseSeconds === 30 || privacy.safetyResponseSeconds === 60 ? privacy.safetyResponseSeconds : 45,
    },
    demoViewerToken: typeof value.demoViewerToken === "string" ? value.demoViewerToken : null,
  };

  return {
    ...normalized,
    history: applyHistoryRetention(normalized.history, historyRetention),
  };
}
