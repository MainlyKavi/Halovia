import { FALLBACK_ROUTE, FALLBACK_ROUTE_DISTANCE_METRES, FALLBACK_ROUTE_DURATION_SECONDS } from "./fallback-route.ts";
import { haversineMetres, polylineLengthMetres, type LatLng } from "./geo.ts";

export interface PlannedRoute {
  points: LatLng[];
  distanceMetres: number;
  durationSeconds: number;
  source: "osrm" | "fallback";
}

export const OSRM_ENDPOINT = "https://routing.openstreetmap.de/routed-car/route/v1/driving";

export function buildOsrmUrl(from: LatLng, to: LatLng): string {
  return `${OSRM_ENDPOINT}/${from.lng.toFixed(6)},${from.lat.toFixed(6)};${to.lng.toFixed(6)},${to.lat.toFixed(6)}?overview=full&geometries=geojson&steps=false`;
}

export function parseOsrmResponse(payload: unknown): PlannedRoute | null {
  if (!payload || typeof payload !== "object") return null;
  const route = (payload as { routes?: Array<{ distance?: unknown; duration?: unknown; geometry?: { coordinates?: unknown } }> }).routes?.[0];
  const coordinates = route?.geometry?.coordinates;
  if (!route || !Array.isArray(coordinates)) return null;
  const points = coordinates
    .filter((pair): pair is [number, number] => Array.isArray(pair) && typeof pair[0] === "number" && typeof pair[1] === "number")
    .map(([lng, lat]) => ({ lat, lng }));
  if (points.length < 2) return null;
  return {
    points,
    distanceMetres: typeof route.distance === "number" ? route.distance : polylineLengthMetres(points),
    durationSeconds: typeof route.duration === "number" ? route.duration : 0,
    source: "osrm",
  };
}

export const FALLBACK_PLANNED_ROUTE: PlannedRoute = {
  points: FALLBACK_ROUTE,
  distanceMetres: FALLBACK_ROUTE_DISTANCE_METRES,
  durationSeconds: FALLBACK_ROUTE_DURATION_SECONDS,
  source: "fallback",
};

/**
 * Asks the public OSRM server for a driving route. Any failure (offline,
 * timeout, bad payload, or a route that does not start and end near the
 * requested points) returns the baked-in fallback, so this never throws.
 */
export async function fetchPlannedRoute(from: LatLng, to: LatLng, fetcher: typeof fetch | undefined = globalThis.fetch, timeoutMs = 6_000): Promise<PlannedRoute> {
  if (!fetcher) return FALLBACK_PLANNED_ROUTE;
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = setTimeout(() => controller?.abort(), timeoutMs);
  try {
    const response = await fetcher(buildOsrmUrl(from, to), { signal: controller?.signal });
    if (!response.ok) return FALLBACK_PLANNED_ROUTE;
    const route = parseOsrmResponse(await response.json());
    if (!route) return FALLBACK_PLANNED_ROUTE;
    const endsMatch = haversineMetres(route.points[0], from) < 500 && haversineMetres(route.points[route.points.length - 1], to) < 500;
    return endsMatch ? route : FALLBACK_PLANNED_ROUTE;
  } catch {
    return FALLBACK_PLANNED_ROUTE;
  } finally {
    clearTimeout(timer);
  }
}
