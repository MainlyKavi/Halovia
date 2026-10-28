import type { SafetyAlert } from "@/lib/ride/alerts";
import type { LatLng } from "@/lib/ride/geo";
import type { GroupMember } from "@/lib/ride/group";
import type { NearestSafetyPlaces } from "@/lib/ride/places";
import type { RideDetails } from "@/lib/ride/ride-provider";

/**
 * DEMO STAND-IN FOR A BACKEND. What a trusted contact's phone would receive
 * from a push/realtime service. The rider's screen publishes this snapshot and
 * the contact view renders only from it. It travels over BroadcastChannel and
 * localStorage, so it also works across two tabs of the same browser, but it
 * never leaves the device.
 */
export interface SharedSnapshot {
  version: 1;
  updatedAt: number;
  userName: string;
  members: GroupMember[];
  ride: RideDetails | null;
  sharing: { recipientIds: string[]; startedAt: number } | null;
  route: LatLng[];
  cab: { point: LatLng; bearing: number } | null;
  offRouteMetres: number;
  deviated: boolean;
  arrived: boolean;
  alerts: SafetyAlert[];
  sosActiveAlertId: string | null;
  nearest: NearestSafetyPlaces;
}

const CHANNEL = "halovia-ride-share";
const STORAGE_KEY = "halovia.ride.shared.v1";

let channel: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel | null {
  if (channel || typeof BroadcastChannel === "undefined") return channel;
  try { channel = new BroadcastChannel(CHANNEL); } catch { channel = null; }
  return channel;
}

export function publishSnapshot(snapshot: SharedSnapshot): void {
  try { getChannel()?.postMessage(snapshot); } catch { /* Ignore closed channels. */ }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)); } catch { /* Storage may be full or blocked. */ }
}

export function readSnapshot(): SharedSnapshot | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as SharedSnapshot | null;
    return parsed?.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

export function subscribeSnapshot(onSnapshot: (snapshot: SharedSnapshot) => void): () => void {
  const fromChannel = (event: MessageEvent<SharedSnapshot>) => { if (event.data?.version === 1) onSnapshot(event.data); };
  const fromStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEY) { const snapshot = readSnapshot(); if (snapshot) onSnapshot(snapshot); } };
  const bus = getChannel();
  bus?.addEventListener("message", fromChannel);
  window.addEventListener("storage", fromStorage);
  return () => { bus?.removeEventListener("message", fromChannel); window.removeEventListener("storage", fromStorage); };
}

export function clearSnapshot(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* Ignore. */ }
}
