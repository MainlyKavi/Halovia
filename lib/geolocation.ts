import type { DeviceCoordinate } from "@/lib/api-types";

export type LocationPermissionState = "prompt" | "granted" | "denied" | "unsupported" | "unknown";

export function coordinateFromPosition(position: GeolocationPosition): DeviceCoordinate {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    heading: Number.isFinite(position.coords.heading) ? position.coords.heading : null,
    speed: Number.isFinite(position.coords.speed) ? position.coords.speed : null,
    deviceRecordedAt: new Date(position.timestamp).toISOString(),
  };
}

export function getCurrentDeviceCoordinate(): Promise<DeviceCoordinate> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("unsupported"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(coordinateFromPosition(position)),
      (error) => reject(error),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );
  });
}

export async function getLocationPermissionState(): Promise<LocationPermissionState> {
  if (!("geolocation" in navigator)) return "unsupported";
  if (!("permissions" in navigator)) return "unknown";
  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state;
  } catch {
    return "unknown";
  }
}
