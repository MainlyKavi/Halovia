export type Theme = "light" | "dark" | "pink";
export type Language = "en" | "hi" | "es";
export type NotificationPreference = "all" | "emergency" | "none";

export interface User {
  id: string;
  name: string;
  language: Language;
  theme: Theme;
  onboardingComplete: boolean;
  region: "IN" | "US" | "ES";
}

export interface TrustedContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  initials: string;
  color: string;
  preference: NotificationPreference;
  active: boolean;
  defaultForJourneys: boolean;
  emergencyAlerts: boolean;
}

export type JourneyStatus =
  | "journeyStarted"
  | "onRoute"
  | "slightDelay"
  | "routeChanged"
  | "safetyCheckRequested"
  | "contactAlerted"
  | "arrivedSafely"
  | "endedManually";

export type TravelType = "cab" | "walking" | "publicTransport" | "driving" | "other";

export interface JourneyEvent {
  id: string;
  type: JourneyStatus;
  timestamp: string;
  detail?: string;
}

export interface Journey {
  id: string;
  origin: string;
  destination: string;
  startedAt: string;
  eta: string;
  endedAt?: string;
  durationMinutes: number;
  travelType: TravelType;
  status: JourneyStatus;
  contactIds: string[];
  safetyCheckOccurred: boolean;
  alertTriggered: boolean;
  progress: number;
  vehicleNumber?: string;
  driverName?: string;
  note?: string;
  events: JourneyEvent[];
}

export interface EmergencySettings {
  number: string;
  region: string;
  shareLastLocation: boolean;
  soundAlarm: boolean;
}

export interface PrivacyPreferences {
  historyRetention: "auto" | "7" | "30" | "manual";
  reducedMotion: boolean;
  notifications: boolean;
  locationWhileActive: boolean;
}

export interface AppState {
  user: User;
  contacts: TrustedContact[];
  history: Journey[];
  activeJourney: Journey | null;
  emergency: EmergencySettings;
  privacy: PrivacyPreferences;
}
