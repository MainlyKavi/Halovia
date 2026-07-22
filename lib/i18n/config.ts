import type { CountryCode, Language, Locale } from "@/lib/types";

export const languageOptions: Array<{ value: Language; nativeLabel: string }> = [
  { value: "en", nativeLabel: "English" },
  { value: "hi", nativeLabel: "हिन्दी" },
  { value: "es", nativeLabel: "Español" },
  { value: "fr", nativeLabel: "Français" },
  { value: "ru", nativeLabel: "Русский" },
  { value: "ur", nativeLabel: "اردو" },
  { value: "bn", nativeLabel: "বাংলা" },
  { value: "ta", nativeLabel: "தமிழ்" },
  { value: "ar", nativeLabel: "العربية" },
];

export const localeOptions: Locale[] = ["en-IN", "en-US", "hi-IN", "es-ES", "fr-FR", "ru-RU", "ur-PK", "bn-BD", "ta-IN", "ar-SA"];
export const countryOptions: CountryCode[] = ["IN", "US", "ES", "FR", "RU", "PK", "BD", "SA", "OTHER"];
