import type { CountryCode, DateFormatPreference, Locale } from "@/lib/types";

function validDate(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function formatTime(value: string | Date, locale: Locale): string {
  const date = validDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(date);
}

export function formatDate(value: string | Date, locale: Locale, preference: DateFormatPreference = "locale"): string {
  const date = validDate(value);
  if (!date) return "—";
  if (preference === "locale") return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
  const parts = new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const order = preference === "dayFirst" ? ["day", "month", "year"] : ["month", "day", "year"];
  return order.map((part) => values[part]).join("/");
}

export function formatDateTime(value: string | Date, locale: Locale, preference: DateFormatPreference = "locale"): string {
  const date = validDate(value);
  if (!date) return "—";
  return `${formatDate(date, locale, preference)} · ${formatTime(date, locale)}`;
}

export function formatNumber(value: number, locale: Locale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatDuration(
  minutes: number,
  locale: Locale,
  labels: { hours: string; minutes: string },
): string {
  const safeMinutes = Math.max(0, Math.round(minutes));
  const hours = Math.floor(safeMinutes / 60);
  const remaining = safeMinutes % 60;
  if (hours === 0) return `${formatNumber(remaining, locale)} ${labels.minutes}`;
  if (remaining === 0) return `${formatNumber(hours, locale)} ${labels.hours}`;
  return `${formatNumber(hours, locale)} ${labels.hours} ${formatNumber(remaining, locale)} ${labels.minutes}`;
}

export function formatCountry(country: CountryCode, locale: Locale): string {
  if (country === "OTHER") return "—";
  return new Intl.DisplayNames([locale], { type: "region" }).of(country) ?? country;
}

export function toDateTimeLocalValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
