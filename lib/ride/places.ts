import { haversineMetres, type LatLng } from "./geo.ts";

export type SafetyPlaceKind = "police" | "hospital";

export interface SafetyPlace {
  id: string;
  kind: SafetyPlaceKind;
  name: string;
  location: LatLng;
  phone?: string;
}

export interface NearbySafetyPlace extends SafetyPlace {
  distanceMetres: number;
}

export interface NearestSafetyPlaces {
  police: NearbySafetyPlace | null;
  hospital: NearbySafetyPlace | null;
}

export const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";

// Snapshot of OpenStreetMap data (© OpenStreetMap contributors, ODbL) taken
// from Overpass around the demo route in Bengaluru. Used whenever the live
// Overpass request fails or times out, so the demo never shows an empty card.
export const FALLBACK_SAFETY_PLACES: SafetyPlace[] = [
  { id: "osm-police-indiranagar", kind: "police", name: "Indira Nagar Police Station", location: { lat: 12.983019, lng: 77.6384106 } },
  { id: "osm-police-jb-nagar", kind: "police", name: "Jeevan Bhima Nagar Police Station", location: { lat: 12.9677712, lng: 77.6556937 } },
  { id: "osm-police-commercial-street", kind: "police", name: "Commercial Street Police Station", location: { lat: 12.9825702, lng: 77.6070982 } },
  { id: "osm-police-cubbon-park", kind: "police", name: "Cubbon Park Police Station", location: { lat: 12.9762399, lng: 77.5983458 } },
  { id: "osm-hospital-acura", kind: "hospital", name: "Acura Speciality Hospital", location: { lat: 12.9353208, lng: 77.6205504 }, phone: "+91 80 4110 5151" },
  { id: "osm-hospital-apollo-spectra", kind: "hospital", name: "Apollo Spectra Hospitals", location: { lat: 12.9338175, lng: 77.6201615 } },
  { id: "osm-hospital-cambridge", kind: "hospital", name: "Cambridge Hospital", location: { lat: 12.9716236, lng: 77.6273835 } },
  { id: "osm-hospital-axon", kind: "hospital", name: "Axon Speciality Hospital", location: { lat: 12.973892, lng: 77.6460904 }, phone: "080 4334 6333" },
  { id: "osm-hospital-cloudnine", kind: "hospital", name: "Cloudnine Hospital", location: { lat: 12.9597752, lng: 77.6569127 } },
];

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
      const distanceMetres = haversineMetres(from, place.location);
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
  return { places: FALLBACK_SAFETY_PLACES, source: "fallback" };
}
