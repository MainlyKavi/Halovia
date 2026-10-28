import { projectOntoPolyline, type LatLng } from "./geo.ts";

export interface DeviationConfig {
  /** How far from the planned route the cab may drift before it counts as off-route. */
  thresholdMetres: number;
  /** How long the cab must stay off-route before an alert fires (filters GPS jitter). */
  graceMs: number;
}

export const DEFAULT_DEVIATION_CONFIG: DeviationConfig = { thresholdMetres: 300, graceMs: 4_000 };

export interface DeviationState {
  /** When the cab first went beyond the threshold, or null while it is on the route. */
  offRouteSince: number | null;
  /** True once the grace period has elapsed; stays true until the cab is back on route. */
  deviated: boolean;
  distanceMetres: number;
}

export const INITIAL_DEVIATION_STATE: DeviationState = { offRouteSince: null, deviated: false, distanceMetres: 0 };

export type DeviationEvent = "deviationStarted" | "backOnRoute" | null;

export interface DeviationResult {
  state: DeviationState;
  event: DeviationEvent;
}

/**
 * Pure step function: feed it each new cab position. It reports
 * `deviationStarted` exactly once per excursion, after the cab has stayed more
 * than `thresholdMetres` away for at least `graceMs`, and `backOnRoute` once it
 * returns within the threshold.
 */
export function evaluateDeviation(
  previous: DeviationState,
  plannedRoute: readonly LatLng[],
  position: LatLng,
  now: number,
  config: DeviationConfig = DEFAULT_DEVIATION_CONFIG,
): DeviationResult {
  if (plannedRoute.length === 0) return { state: previous, event: null };
  const distanceMetres = projectOntoPolyline(position, plannedRoute).distanceMetres;
  if (distanceMetres <= config.thresholdMetres) {
    return { state: { offRouteSince: null, deviated: false, distanceMetres }, event: previous.deviated ? "backOnRoute" : null };
  }
  const offRouteSince = previous.offRouteSince ?? now;
  const deviated = now - offRouteSince >= config.graceMs;
  return { state: { offRouteSince, deviated, distanceMetres }, event: deviated && !previous.deviated ? "deviationStarted" : null };
}
