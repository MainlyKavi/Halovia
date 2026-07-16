import type { Language } from "@/lib/types";
import { ar } from "@/lib/i18n/locales/ar";
import { en, type EnglishTranslationKey } from "@/lib/i18n/locales/en";
import { es } from "@/lib/i18n/locales/es";
import { fr } from "@/lib/i18n/locales/fr";
import { hi } from "@/lib/i18n/locales/hi";
import { ru } from "@/lib/i18n/locales/ru";

export type TranslationKey = EnglishTranslationKey;
export type TranslationDictionary = Record<TranslationKey, string>;

export const translations = {
  en,
  hi,
  es,
  fr,
  ru,
  ar,
} satisfies Record<Language, TranslationDictionary>;
