import type { LatLng } from "./geo.ts";
import type { NearestSafetyPlaces } from "./places.ts";
import type { RideDetails } from "./ride-provider.ts";

export type SafetyAlertKind = "deviation" | "sos";

export interface AlertRideSummary {
  brand: RideDetails["brand"];
  driverName: string;
  vehicle: string;
  plate: string;
  pickup: string;
  drop: string;
}

export interface SafetyAlert {
  id: string;
  kind: SafetyAlertKind;
  createdAt: string;
  userName: string;
  location: LatLng;
  locationLink: string;
  ride: AlertRideSummary | null;
  nearest: NearestSafetyPlaces;
  /** Only for deviation alerts. */
  distanceOffRouteMetres?: number;
  recipientIds: string[];
  /** Always true in this prototype: nothing leaves the device. */
  simulated: true;
}

export function locationLink(point: LatLng): string {
  const lat = point.lat.toFixed(6);
  const lng = point.lng.toFixed(6);
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}

/** Opens the platform maps app on Android (geo: intent) or OpenStreetMap directions elsewhere. */
export function directionsLink(to: LatLng, label: string, native: boolean): string {
  const lat = to.lat.toFixed(6);
  const lng = to.lng.toFixed(6);
  return native
    ? `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(label)})`
    : `https://www.openstreetmap.org/directions?route=%3B${lat}%2C${lng}#map=16/${lat}/${lng}`;
}

export function summarizeRide(ride: RideDetails | null): AlertRideSummary | null {
  if (!ride) return null;
  return {
    brand: ride.brand,
    driverName: ride.driver.name,
    vehicle: `${ride.vehicle.colour} ${ride.vehicle.model}`,
    plate: ride.vehicle.plate,
    pickup: ride.pickup.label,
    drop: ride.drop.label,
  };
}

interface AlertInput {
  id: string;
  userName: string;
  location: LatLng;
  ride: RideDetails | null;
  nearest: NearestSafetyPlaces;
  recipientIds: string[];
  now?: number;
}

function baseAlert(kind: SafetyAlertKind, input: AlertInput): SafetyAlert {
  return {
    id: input.id,
    kind,
    createdAt: new Date(input.now ?? Date.now()).toISOString(),
    userName: input.userName.trim() || "Halovia user",
    location: input.location,
    locationLink: locationLink(input.location),
    ride: summarizeRide(input.ride),
    nearest: input.nearest,
    recipientIds: [...input.recipientIds],
    simulated: true,
  };
}

export function buildDeviationAlert(input: AlertInput & { distanceOffRouteMetres: number }): SafetyAlert {
  return { ...baseAlert("deviation", input), distanceOffRouteMetres: Math.round(input.distanceOffRouteMetres) };
}

export function buildSosAlert(input: AlertInput): SafetyAlert {
  return baseAlert("sos", input);
}

export function formatDistance(metres: number): string {
  return metres < 1_000 ? `${Math.round(metres / 10) * 10} m` : `${(metres / 1_000).toFixed(1)} km`;
}

/**
 * Plain-text version of an alert, as it would go out over SMS when there is no
 * data connection (future work). English only because SMS gateways and
 * recipients may not share the sender's app language.
 */
export function formatAlertText(alert: SafetyAlert): string {
  const lines = [
    alert.kind === "sos" ? `SOS: ${alert.userName} needs help.` : `Alert: ${alert.userName}'s driver left the planned route.`,
  ];
  if (alert.kind === "deviation" && alert.distanceOffRouteMetres !== undefined) lines.push(`Off route by ${formatDistance(alert.distanceOffRouteMetres)}.`);
  lines.push(`Location: ${alert.locationLink}`);
  if (alert.ride) lines.push(`Ride: ${alert.ride.vehicle}, ${alert.ride.plate}, driver ${alert.ride.driverName}. ${alert.ride.pickup} to ${alert.ride.drop}.`);
  if (alert.nearest.police) lines.push(`Nearest police: ${alert.nearest.police.name} (${formatDistance(alert.nearest.police.distanceMetres)}).`);
  if (alert.nearest.hospital) lines.push(`Nearest hospital: ${alert.nearest.hospital.name} (${formatDistance(alert.nearest.hospital.distanceMetres)}).`);
  return lines.join("\n");
}
