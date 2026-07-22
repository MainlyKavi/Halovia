export type Theme = "light" | "dark" | "pink";
export type Language = "en" | "hi" | "es" | "fr" | "ru" | "ur" | "bn" | "ta" | "ar";
export type Locale = "en-IN" | "en-US" | "hi-IN" | "es-ES" | "fr-FR" | "ru-RU" | "ur-PK" | "bn-BD" | "ta-IN" | "ar-SA";
export type CountryCode = "IN" | "US" | "ES" | "FR" | "RU" | "PK" | "BD" | "SA" | "OTHER";
export type DateFormatPreference = "locale" | "dayFirst" | "monthFirst";
export type NotificationPreference = "all" | "emergency" | "none";
export type AppMode = "clean" | "demo";

export interface User {
  id: string;
  name: string;
  language: Language;
  locale: Locale;
  country: CountryCode;
  dateFormat: DateFormatPreference;
  theme: Theme;
  onboardingComplete: boolean;
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
  isDemo?: boolean;
}

export type JourneyStatus =
  | "journeyStarted"
  | "onRoute"
  | "slightDelay"
  | "routeChanged"
  | "safetyCheckRequested"
  | "safeCheckIn"
  | "helpRequested"
  | "prototypeEscalated"
  | "arrivedSafely"
  | "endedManually";

export type JourneyEventType =
  | JourneyStatus
  | "safetyCheckExtended"
  | "connectionLost"
  | "emergencyActionPreview";

export type TravelType = "cab" | "autoRickshaw" | "motorcycle" | "walking" | "publicTransport" | "other";
export type ConnectionStatus = "online" | "offline";
export type EmergencyState = "none" | "helpRequested" | "prototypeEscalated";

export interface JourneyEvent {
  id: string;
  type: JourneyEventType;
  timestamp: string;
  detail?: string;
}

export interface Journey {
  id: string;
  origin: string;
  destination: string;
  originCoordinate?: { latitude: number; longitude: number };
  destinationCoordinate?: { latitude: number; longitude: number };
  startedAt: string;
  eta: string;
  routeEta?: string;
  remainingDistanceMetres?: number;
  endedAt?: string;
  durationMinutes: number;
  travelType: TravelType;
  status: JourneyStatus;
  contactIds: string[];
  safetyCheckOccurred: boolean;
  prototypeEscalationTriggered: boolean;
  progress: number;
  vehicleNumber?: string;
  driverName?: string;
  vehicleDescription?: string;
  note?: string;
  vehicleImageId?: string;
  vehicleImageName?: string;
  lastCheckInAt?: string;
  lastLocationUpdateAt: string;
  lastServerUpdateAt?: string;
  latestCoordinate?: {
    latitude: number;
    longitude: number;
    accuracy: number;
    heading: number | null;
    speed: number | null;
    deviceRecordedAt: string;
  };
  sharingStatus?: "disabled" | "active" | "revoked" | "completed";
  backendSafetyStatus?: "safe" | "check_pending" | "attention_required" | "help_requested";
  connectionStatus: ConnectionStatus;
  emergencyState: EmergencyState;
  isDemo?: boolean;
  events: JourneyEvent[];
}

export interface EmergencySettings {
  number: string;
  country: CountryCode;
  shareLastLocation: boolean;
  soundAlarm: boolean;
}

export type HistoryRetention = "auto" | "7" | "30" | "manual";

export interface PrivacyPreferences {
  historyRetention: HistoryRetention;
  reducedMotion: boolean;
  notifications: boolean;
  locationWhileActive: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  safetyResponseSeconds: 30 | 45 | 60;
}

export type SafetyCheckReason = "routeChanged" | "slightDelay" | "extendedStop" | "manualDemo";

export interface SafetyCheckState {
  id: string;
  reason: SafetyCheckReason;
  startedAt: string;
  deadlineAt: string;
  responseSeconds: number;
  extensionUsed: boolean;
  escalated: boolean;
}

export interface AppState {
  version: 2;
  mode: AppMode;
  user: User;
  contacts: TrustedContact[];
  history: Journey[];
  activeJourney: Journey | null;
  safetyCheck: SafetyCheckState | null;
  emergency: EmergencySettings;
  privacy: PrivacyPreferences;
  demoViewerToken: string | null;
}
