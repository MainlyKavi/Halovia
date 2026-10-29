import { haversineMetres, type LatLng } from "./geo.ts";

export type SafetyPlaceKind = "police" | "hospital";

export interface SafetyPlace {
  id: string;
  kind: SafetyPlaceKind;
  name: string;
  location: LatLng;
  phone?: string;
  address?: string;
  /**
   * Distance to show in the app, as given by the project brief, instead of the
   * straight-line distance from the current position.
   */
  statedDistanceMetres?: number;
}

export interface NearbySafetyPlace extends SafetyPlace {
  distanceMetres: number;
}

export interface NearestSafetyPlaces {
  police: NearbySafetyPlace | null;
  hospital: NearbySafetyPlace | null;
}

// Optional live lookup (Overpass). The mobile app uses the fixed places above;
// these helpers remain for a future "find help anywhere" mode.
export const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

// Fixed safety places for the demo start point (Echelon Institute of
// Technology, Faridabad). These are the primary source: the app always shows
// them, so SOS and route alerts never say "nothing found".
//
// Coordinates:
// - Sarvodaya Hospital and Research Centre, YMCA Road, Sector 8: OpenStreetMap
//   node 6895526377 (looked up via Overpass).
// - Police Station Bhupani, Sector 89: OpenStreetMap has no mapped point for
//   this station, so this uses the Sector 89, Faridabad centroid from
//   Nominatim (OSM). Treat it as approximate (within ~1 km).
// Distances are the figures from the brief. From Echelon, OSRM gives 9.2 km by
// road (8.4 km straight) to the police point and 14.0 km by road (13.0 km
// straight) to Sarvodaya.
export const FIXED_POLICE: SafetyPlace = {
  id: "fixed-police-bhupani",
  kind: "police",
  name: "Police Station Bhupani",
  address: "Bhopani, Ferrous City, Phase 1, Sector 89, Faridabad, Haryana 121014",
  location: { lat: 28.4210247, lng: 77.3667617 },
  phone: "112",
  statedDistanceMetres: 8_500,
};

export const FIXED_HOSPITAL: SafetyPlace = {
  id: "fixed-hospital-sarvodaya-s8",
  kind: "hospital",
  name: "Sarvodaya Hospital",
  address: "YMCA Road, Sector 8, Faridabad, Haryana",
  location: { lat: 28.4222263, lng: 77.3167697 },
  phone: "108",
  statedDistanceMetres: 15_600,
};

export const FIXED_SAFETY_PLACES: SafetyPlace[] = [FIXED_POLICE, FIXED_HOSPITAL];

/** The fixed demo places, ready to show. Never contains nulls. */
export const FIXED_NEAREST: { police: NearbySafetyPlace; hospital: NearbySafetyPlace } = {
  police: { ...FIXED_POLICE, distanceMetres: FIXED_POLICE.statedDistanceMetres ?? 0 },
  hospital: { ...FIXED_HOSPITAL, distanceMetres: FIXED_HOSPITAL.statedDistanceMetres ?? 0 },
};

export function buildOverpassQuery(center: LatLng, radiusMetres = 4_000): string {
  const around = `around:${Math.round(radiusMetres)},${center.lat.toFixed(5)},${center.lng.toFixed(5)}`;
  return `[out:json][timeout:15];(nwr["amenity"="police"](${around});nwr["amenity"="hospital"](${around}););out center tags 60;`;
}

// OSM tags many specialist clinics as amenity=hospital. In an emergency the
// user needs a general hospital, so these names are skipped when choosing one.
const NON_EMERGENCY_NAME = /\b(eye|dental|dentist|diagnostic|lab|ivf|ayur|wellness|hydrotherapy|netra|nethra|screening|opd)\b/iu;

export function isLikelyEmergencyFacility(place: SafetyPlace): boolean {
  return place.kind === "police" || !NON_EMERGENCY_NAME.test(place.name);
}

interface OverpassElement {
  type?: unknown;
  id?: unknown;
  lat?: unknown;
  lon?: unknown;
  center?: { lat?: unknown; lon?: unknown };
  tags?: Record<string, unknown>;
}

export function parseOverpassResponse(payload: unknown): SafetyPlace[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { elements?: unknown }).elements)) return [];
  const places: SafetyPlace[] = [];
  for (const element of (payload as { elements: OverpassElement[] }).elements) {
    const tags = element.tags ?? {};
    const amenity = tags.amenity;
    const name = typeof tags["name:en"] === "string" ? tags["name:en"] : tags.name;
    const lat = typeof element.lat === "number" ? element.lat : element.center?.lat;
    const lng = typeof element.lon === "number" ? element.lon : element.center?.lon;
    if ((amenity !== "police" && amenity !== "hospital") || typeof name !== "string" || !name.trim()) continue;
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    const phone = typeof tags.phone === "string" ? tags.phone : typeof tags["contact:phone"] === "string" ? tags["contact:phone"] : undefined;
    places.push({ id: `osm-${String(element.type)}-${String(element.id)}`, kind: amenity, name: name.trim(), location: { lat, lng }, phone });
  }
  return places;
}

export function nearestSafetyPlaces(places: readonly SafetyPlace[], from: LatLng): NearestSafetyPlaces {
  const nearest = (kind: SafetyPlaceKind): NearbySafetyPlace | null => {
    let best: NearbySafetyPlace | null = null;
    for (const place of places) {
      if (place.kind !== kind || !isLikelyEmergencyFacility(place)) continue;
      const distanceMetres = place.statedDistanceMetres ?? haversineMetres(from, place.location);
      if (!best || distanceMetres < best.distanceMetres) best = { ...place, distanceMetres };
    }
    return best;
  };
  return { police: nearest("police"), hospital: nearest("hospital") };
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface FetchSafetyPlacesOptions {
  fetcher?: typeof fetch;
  store?: KeyValueStore | null;
  timeoutMs?: number;
  now?: number;
  /** Cached results younger than this are used without a network request. */
  maxCacheAgeMs?: number;
}

export interface SafetyPlacesResult {
  places: SafetyPlace[];
  source: "live" | "cache" | "fallback";
}

const CACHE_PREFIX = "halovia.ride.places.";

/** Cache key on a ~1 km grid so small movements reuse the same result. */
export function placesCacheKey(center: LatLng): string {
  return `${CACHE_PREFIX}${center.lat.toFixed(2)},${center.lng.toFixed(2)}`;
}

/**
 * Loads nearby police stations and hospitals: a fresh cache entry first, then
 * the live Overpass API, then any stale cache entry, then the baked-in
 * fallback. Never throws, so callers can always render something.
 */
export async function fetchSafetyPlaces(center: LatLng, options: FetchSafetyPlacesOptions = {}): Promise<SafetyPlacesResult> {
  const { fetcher = globalThis.fetch, store = null, timeoutMs = 8_000, now = Date.now(), maxCacheAgeMs = 24 * 60 * 60_000 } = options;
  const key = placesCacheKey(center);
  let cached: { savedAt: number; places: SafetyPlace[] } | null = null;
  try {
    const raw = store?.getItem(key);
    if (raw) cached = JSON.parse(raw) as { savedAt: number; places: SafetyPlace[] };
  } catch { cached = null; }
  if (cached && Array.isArray(cached.places) && cached.places.length && now - cached.savedAt < maxCacheAgeMs) return { places: cached.places, source: "cache" };

  if (fetcher) {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timer = setTimeout(() => controller?.abort(), timeoutMs);
    try {
      const response = await fetcher(OVERPASS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(buildOverpassQuery(center))}`,
        signal: controller?.signal,
      });
      if (response.ok) {
        const places = parseOverpassResponse(await response.json());
        if (places.some((place) => place.kind === "police") && places.some((place) => place.kind === "hospital")) {
          try { store?.setItem(key, JSON.stringify({ savedAt: now, places })); } catch { /* Cache is best effort. */ }
          return { places, source: "live" };
        }
      }
    } catch { /* Offline, timed out or rate limited: fall through. */ } finally {
      clearTimeout(timer);
    }
  }
  if (cached && Array.isArray(cached.places) && cached.places.length) return { places: cached.places, source: "cache" };
  return { places: FIXED_SAFETY_PLACES, source: "fallback" };
}
