import type { TravelType } from "./types";

export const OPEN_MAP_STYLES = {
  light: "https://tiles.openfreemap.org/styles/liberty",
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const;

export const MAP_SEARCH_ENDPOINT = "/api/maps/search";

const ROUTING_ENDPOINTS = {
  driving: "https://routing.openstreetmap.de/routed-car/route/v1/driving",
  walking: "https://routing.openstreetmap.de/routed-foot/route/v1/driving",
} as const;

export function routingEndpointFor(travelType: TravelType): string {
  return travelType === "walking" ? ROUTING_ENDPOINTS.walking : ROUTING_ENDPOINTS.driving;
}

export function buildRouteUrl(
  travelType: TravelType,
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
): string {
  const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  return `${routingEndpointFor(travelType)}/${coordinates}?overview=full&geometries=geojson&steps=false`;
}

export function logOpenMapDevelopmentError(context: string, error: unknown): void {
  if (!import.meta.env.DEV) return;
  const message = error instanceof Error ? error.message : "Unknown map error";
  console.warn(`[Halovia map] ${context}: ${message}`);
}
