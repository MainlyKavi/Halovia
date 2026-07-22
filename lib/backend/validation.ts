import { IMAGE_POLICY, LOCATION_POLICY, SHARING_POLICY } from "../config.ts";
import type { DeviceCoordinate } from "../api-types.ts";
import type { TravelType } from "../types.ts";

const travelTypes = new Set<TravelType>(["cab", "autoRickshaw", "motorcycle", "walking", "publicTransport", "other"]);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function cleanText(value: unknown, maximumLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maximumLength) : "";
}

export function optionalText(value: unknown, maximumLength: number): string | null {
  const cleaned = cleanText(value, maximumLength);
  return cleaned || null;
}

export function validIsoDate(value: unknown, futureOnly = false, now = Date.now()): string | null {
  if (typeof value !== "string") return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time) || (futureOnly && time <= now)) return null;
  return new Date(time).toISOString();
}

export function validTravelType(value: unknown): TravelType | null {
  return typeof value === "string" && travelTypes.has(value as TravelType) ? value as TravelType : null;
}

export function validCoordinate(value: unknown): DeviceCoordinate | null {
  if (!isRecord(value)) return null;
  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  const accuracy = Number(value.accuracy);
  const heading = value.heading === null || value.heading === undefined ? null : Number(value.heading);
  const speed = value.speed === null || value.speed === undefined ? null : Number(value.speed);
  const deviceRecordedAt = validIsoDate(value.deviceRecordedAt);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > LOCATION_POLICY.maximumAccuracyMetres) return null;
  if (heading !== null && (!Number.isFinite(heading) || heading < 0 || heading >= 360)) return null;
  if (speed !== null && (!Number.isFinite(speed) || speed < 0 || speed > 120)) return null;
  if (!deviceRecordedAt) return null;
  return { latitude, longitude, accuracy, heading, speed, deviceRecordedAt };
}

export function haversineMetres(a: Pick<DeviceCoordinate, "latitude" | "longitude">, b: Pick<DeviceCoordinate, "latitude" | "longitude">): number {
  const radius = 6_371_000;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function shouldSubmitLocation(
  previous: (DeviceCoordinate & { serverReceivedAt?: string }) | null,
  next: DeviceCoordinate,
  now = Date.now(),
): boolean {
  if (!previous) return true;
  if (previous.latitude === next.latitude && previous.longitude === next.longitude && previous.deviceRecordedAt === next.deviceRecordedAt) return false;
  const previousTime = previous.serverReceivedAt ? new Date(previous.serverReceivedAt).getTime() : new Date(previous.deviceRecordedAt).getTime();
  const elapsed = now - previousTime;
  return elapsed >= LOCATION_POLICY.minimumUpdateIntervalMs
    || haversineMetres(previous, next) >= LOCATION_POLICY.significantMovementMetres;
}

export function validShareLifetimeHours(value: unknown): number {
  const hours = Number(value);
  if (!Number.isFinite(hours)) return SHARING_POLICY.defaultLifetimeHours;
  return Math.max(1, Math.min(SHARING_POLICY.maximumLifetimeHours, Math.round(hours)));
}

export function validImageRequest(contentType: string | null, contentLength: string | null): "type" | "size" | null {
  if (!contentType || !(IMAGE_POLICY.acceptedMimeTypes as readonly string[]).includes(contentType.toLowerCase())) return "type";
  const bytes = Number(contentLength);
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > IMAGE_POLICY.maximumBytes) return "size";
  return null;
}

export function locationFreshness(lastServerUpdateAt: string | null, now = Date.now()): "live" | "stale" | "unavailable" {
  if (!lastServerUpdateAt) return "unavailable";
  const time = new Date(lastServerUpdateAt).getTime();
  if (!Number.isFinite(time)) return "unavailable";
  return now - time <= LOCATION_POLICY.staleAfterMs ? "live" : "stale";
}
