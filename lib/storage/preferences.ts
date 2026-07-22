import type { CountryCode, DateFormatPreference, Language, Locale, Theme } from "@/lib/types";

export const PREFERENCES_KEY = "halovia.preferences.v3";

export interface LocalPreferences {
  version: 3;
  theme: Theme;
  language: Language;
  locale: Locale;
  country: CountryCode;
  dateFormat: DateFormatPreference;
  reducedMotion: boolean;
}

const defaults: LocalPreferences = {
  version: 3,
  theme: "pink",
  language: "en",
  locale: "en-IN",
  country: "IN",
  dateFormat: "locale",
  reducedMotion: false,
};

const themes = new Set<Theme>(["light", "dark", "pink"]);
const languages = new Set<Language>(["en", "hi", "es", "fr", "ru", "ur", "bn", "ta", "ar"]);
const locales = new Set<Locale>(["en-IN", "en-US", "hi-IN", "es-ES", "fr-FR", "ru-RU", "ur-PK", "bn-BD", "ta-IN", "ar-SA"]);
const countries = new Set<CountryCode>(["IN", "US", "ES", "FR", "RU", "PK", "BD", "SA", "OTHER"]);
const dateFormats = new Set<DateFormatPreference>(["locale", "dayFirst", "monthFirst"]);

export function readPreferences(): LocalPreferences {
  try {
    const parsed = JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? "null") as Partial<LocalPreferences> | null;
    if (!parsed || parsed.version !== 3) return defaults;
    return {
      version: 3,
      theme: themes.has(parsed.theme as Theme) ? parsed.theme as Theme : defaults.theme,
      language: languages.has(parsed.language as Language) ? parsed.language as Language : defaults.language,
      locale: locales.has(parsed.locale as Locale) ? parsed.locale as Locale : defaults.locale,
      country: countries.has(parsed.country as CountryCode) ? parsed.country as CountryCode : defaults.country,
      dateFormat: dateFormats.has(parsed.dateFormat as DateFormatPreference) ? parsed.dateFormat as DateFormatPreference : defaults.dateFormat,
      reducedMotion: Boolean(parsed.reducedMotion),
    };
  } catch {
    return defaults;
  }
}

export function writePreferences(preferences: Omit<LocalPreferences, "version">): boolean {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ version: 3, ...preferences } satisfies LocalPreferences));
    return true;
  } catch {
    return false;
  }
}

export function clearPreferences(): void {
  try { localStorage.removeItem(PREFERENCES_KEY); } catch { /* Browser storage may be unavailable. */ }
}
