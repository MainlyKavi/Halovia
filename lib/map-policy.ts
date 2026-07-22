import { haversineMetres } from "./backend/validation.ts";

interface Coordinate {
  latitude: number;
  longitude: number;
}

export type LocationUpdateAge =
  | { kind: "unavailable" }
  | { kind: "justNow" }
  | { kind: "seconds"; value: number }
  | { kind: "minutes"; value: number };

export function locationUpdateAge(timestamp: string | null | undefined, now = Date.now()): LocationUpdateAge {
  if (!timestamp) return { kind: "unavailable" };
  const recordedAt = new Date(timestamp).getTime();
  if (!Number.isFinite(recordedAt)) return { kind: "unavailable" };
  const seconds = Math.max(0, Math.floor((now - recordedAt) / 1_000));
  if (seconds < 6) return { kind: "justNow" };
  if (seconds < 60) return { kind: "seconds", value: seconds };
  return { kind: "minutes", value: Math.floor(seconds / 60) };
}

export function shouldReuseRoute(
  previousOrigin: Coordinate | null,
  nextOrigin: Coordinate,
  previousRouteKey: string,
  nextRouteKey: string,
  routeAvailable: boolean,
  thresholdMetres: number,
): boolean {
  return Boolean(
    previousOrigin
    && routeAvailable
    && previousRouteKey === nextRouteKey
    && haversineMetres(previousOrigin, nextOrigin) < thresholdMetres,
  );
}
