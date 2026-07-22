import type { TravelType } from "@/lib/types";

export type TrackingStatus =
  | "idle"
  | "permission_required"
  | "finding"
  | "updating"
  | "live"
  | "accuracy_limited"
  | "stale"
  | "offline"
  | "paused"
  | "unavailable"
  | "ended"
  | "sharing_disabled";

export interface DeviceCoordinate {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  deviceRecordedAt: string;
}

export interface BackendProfile {
  id: string;
  displayName: string;
  language: string;
  locale: string;
  country: string;
  dateFormat: string;
  emergencyNumber: string;
  retentionDays: 7 | 30;
  onboardingComplete: boolean;
}

export interface BackendContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  active: boolean;
  defaultForJourneys: boolean;
  emergencyAlerts: boolean;
}

export interface BackendJourney {
  id: string;
  ownerDisplayName: string;
  originName: string;
  origin: { latitude: number; longitude: number };
  destinationName: string;
  destination: { latitude: number; longitude: number };
  transportType: TravelType;
  safetyEta: string;
  routeEta: string | null;
  remainingDistanceMetres: number | null;
  status: "active" | "completed" | "ended";
  safetyStatus: "safe" | "check_pending" | "attention_required" | "help_requested";
  sharingStatus: "disabled" | "active" | "revoked" | "completed";
  driverName: string | null;
  vehicleNumber: string | null;
  vehicleDescription: string | null;
  hasVehicleImage: boolean;
  notes: string | null;
  startedAt: string;
  completedAt: string | null;
  lastLocationAt: string | null;
  lastServerUpdateAt: string | null;
  latestLocation: DeviceCoordinate | null;
  events: BackendJourneyEvent[];
  safetyCheck: BackendSafetyCheck | null;
}

export interface BackendJourneyEvent {
  id: string;
  type: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

export interface BackendSafetyCheck {
  id: string;
  status: "pending" | "safe" | "help_requested" | "expired" | "cancelled";
  reason: string;
  deadlineAt: string;
  extensionCount: number;
  respondedAt: string | null;
}

export interface BackendShareSession {
  id: string;
  expiresAt: string;
  revokedAt: string | null;
  lastViewedAt: string | null;
  createdAt: string;
}

export interface BootstrapPayload {
  profile: BackendProfile;
  contacts: BackendContact[];
  activeJourney: BackendJourney | null;
  history: BackendJourney[];
}

export interface ViewerPayload {
  journey: BackendJourney;
  freshness: "live" | "stale" | "unavailable";
  serverTime: string;
}

export interface ApiErrorPayload {
  error: string;
  code: string;
}
