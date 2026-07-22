import type { D1Database } from "./runtime-types";
import { SECURITY_POLICY } from "../lib/config";

const encoder = new TextEncoder();

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function secureToken(bytes = 32): string {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  let binary = "";
  data.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

export function secureId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function authenticatedEmail(request: Request, localEmail?: string): string | null {
  const header = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (header && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(header)) return header;
  const hostname = new URL(request.url).hostname;
  if ((hostname === "localhost" || hostname === "127.0.0.1") && localEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(localEmail)) {
    return localEmail.trim().toLowerCase();
  }
  return null;
}

export function assertSameOrigin(request: Request): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  const origin = request.headers.get("origin");
  return Boolean(origin) && origin === new URL(request.url).origin;
}

export async function rateLimit(
  db: D1Database,
  key: string,
  kind: "location" | "mutation",
  now = Date.now(),
): Promise<boolean> {
  const maximum = kind === "location" ? SECURITY_POLICY.locationWritesPerMinute : SECURITY_POLICY.ownerMutationsPerMinute;
  const current = await db.prepare("SELECT window_started_at, request_count FROM rate_limits WHERE key = ?").bind(key).first<{ window_started_at: string; request_count: number }>();
  const windowStart = current ? new Date(current.window_started_at).getTime() : 0;
  if (!current || !Number.isFinite(windowStart) || now - windowStart >= 60_000) {
    await db.prepare(`INSERT INTO rate_limits (key, window_started_at, request_count) VALUES (?, ?, 1)
      ON CONFLICT(key) DO UPDATE SET window_started_at = excluded.window_started_at, request_count = 1`)
      .bind(key, new Date(now).toISOString()).run();
    return true;
  }
  if (current.request_count >= maximum) return false;
  await db.prepare("UPDATE rate_limits SET request_count = request_count + 1 WHERE key = ?").bind(key).run();
  return true;
}

export const PRIVATE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
} as const;
