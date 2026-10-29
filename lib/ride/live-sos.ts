// Pure helpers for the live SOS between paired phones (mobile/cloud/). No
// Firebase imports here, so they run under the plain Node test runner.
import { haversineMetres } from "./geo.ts";

/** No I, O, 0 or 1, so a code read out loud or off a screen is never ambiguous. */
export const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const INVITE_LENGTH = 6;

export function newInviteCode(random: (max: number) => number = cryptoRandom): string {
  return Array.from({ length: INVITE_LENGTH }, () => INVITE_ALPHABET[random(INVITE_ALPHABET.length)]).join("");
}

function cryptoRandom(max: number): number {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] % max;
}

/** Accepts "abc 234", "ABC-234" etc. Returns null unless it is a valid code. */
export function normalizeInviteCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[^A-Z0-9]/gu, "");
  if (code.length !== INVITE_LENGTH) return null;
  return [...code].every((char) => INVITE_ALPHABET.includes(char)) ? code : null;
}

export interface LivePoint { lat: number; lng: number; accuracy: number | null; at: number }

export interface LiveSos {
  id: string;
  circleId: string;
  senderUid: string;
  senderName: string;
  senderPhone: string | null;
  status: "active" | "ended";
  demo: boolean;
  createdAt: number;
  location: LivePoint | null;
  trail: LivePoint[];
  deliveredTo: Record<string, number>;
  seenBy: Record<string, number>;
  ackBy: Record<string, number>;
  endedBy: string | null;
  push: { recipients: number; successCount: number; failureCount: number; failures: Record<string, string>; error?: string } | null;
  /** Written on this phone but not yet confirmed by the server. */
  pending: boolean;
}

export interface CircleMemberInfo { uid: string; name: string; phone: string | null; role: "owner" | "member"; pushReady: boolean }

export type RecipientState = "waiting" | "pushFailed" | "delivered" | "seen" | "acknowledged";

export interface RecipientStatus { uid: string; name: string; state: RecipientState }

/** Per-recipient progress for the sender's SOS screen, strongest state first. */
export function recipientStatuses(sos: LiveSos, members: readonly CircleMemberInfo[]): RecipientStatus[] {
  return members.filter((member) => member.uid !== sos.senderUid).map((member) => {
    const state: RecipientState = sos.ackBy[member.uid] ? "acknowledged"
      : sos.seenBy[member.uid] ? "seen"
      : sos.deliveredTo[member.uid] ? "delivered"
      : sos.push?.failures[member.uid] || (sos.push && !member.pushReady) ? "pushFailed"
      : "waiting";
    return { uid: member.uid, name: member.name, state };
  });
}

export type SendState = "queued" | "sending" | "sent";

export function sendState(sos: LiveSos, online: boolean): SendState {
  if (!sos.pending) return "sent";
  return online ? "sending" : "queued";
}

/** Keeps the newest points, dropping ones closer than `minMetres` to the last kept point. */
export function appendTrail(trail: readonly LivePoint[], point: LivePoint, max = 100, minMetres = 5): LivePoint[] {
  const last = trail[trail.length - 1];
  if (last && haversineMetres(last, point) < minMetres) return [...trail.slice(0, -1), { ...last, at: point.at }];
  return [...trail, point].slice(-max);
}

/** An SOS left "active" by a phone that died is ignored after this long. */
export const SOS_STALE_MS = 6 * 60 * 60 * 1_000;
