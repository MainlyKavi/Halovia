import type { AppState, Journey, TrustedContact } from "@/lib/types";
import { createId } from "./state/app-state.ts";

const demoContacts: TrustedContact[] = [
  {
    id: "demo-contact-one",
    name: "Demo Contact One",
    relationship: "Sample contact",
    phone: "demo-contact-1",
    initials: "D1",
    color: "#7c6ee6",
    preference: "all",
    active: true,
    defaultForJourneys: true,
    emergencyAlerts: true,
    isDemo: true,
  },
  {
    id: "demo-contact-two",
    name: "Demo Contact Two",
    relationship: "Sample contact",
    phone: "demo-contact-2",
    initials: "D2",
    color: "#ce6685",
    preference: "emergency",
    active: true,
    defaultForJourneys: true,
    emergencyAlerts: true,
    isDemo: true,
  },
];

export function createEmptyState(): AppState {
  return {
    version: 2,
    mode: "clean",
    user: {
      id: createId("user"),
      name: "",
      language: "en",
      locale: "en-IN",
      country: "IN",
      dateFormat: "locale",
      theme: "pink",
      onboardingComplete: false,
    },
    contacts: [],
    history: [],
    activeJourney: null,
    safetyCheck: null,
    emergency: {
      number: "112",
      country: "IN",
      shareLastLocation: true,
      soundAlarm: true,
    },
    privacy: {
      historyRetention: "30",
      reducedMotion: false,
      notifications: false,
      locationWhileActive: false,
      soundEnabled: false,
      vibrationEnabled: false,
      safetyResponseSeconds: 45,
    },
    demoViewerToken: null,
  };
}

function createCompletedDemoJourney(offsetDays: number, checked: boolean): Journey {
  const endedAt = new Date(Date.now() - offsetDays * 24 * 60 * 60_000);
  const startedAt = new Date(endedAt.getTime() - 32 * 60_000);
  const eta = new Date(startedAt.getTime() + 38 * 60_000);
  return {
    id: `demo-history-${offsetDays}`,
    origin: "Demo start point",
    destination: "Demo destination",
    startedAt: startedAt.toISOString(),
    eta: eta.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMinutes: 32,
    travelType: offsetDays % 2 ? "walking" : "publicTransport",
    status: "arrivedSafely",
    contactIds: ["demo-contact-one"],
    safetyCheckOccurred: checked,
    prototypeEscalationTriggered: false,
    progress: 100,
    lastLocationUpdateAt: endedAt.toISOString(),
    connectionStatus: "online",
    emergencyState: "none",
    isDemo: true,
    events: [
      { id: createId("event"), type: "journeyStarted", timestamp: startedAt.toISOString() },
      ...(checked
        ? [{ id: createId("event"), type: "safeCheckIn" as const, timestamp: new Date(startedAt.getTime() + 18 * 60_000).toISOString() }]
        : []),
      { id: createId("event"), type: "arrivedSafely", timestamp: endedAt.toISOString() },
    ],
  };
}

export function createDemoJourney(): Journey {
  const startedAt = new Date(Date.now() - 12 * 60_000);
  const eta = new Date(Date.now() + 28 * 60_000);
  return {
    id: createId("demo-journey"),
    origin: "Demo start point",
    destination: "Demo destination",
    startedAt: startedAt.toISOString(),
    eta: eta.toISOString(),
    durationMinutes: 40,
    travelType: "cab",
    status: "onRoute",
    contactIds: demoContacts.map((contact) => contact.id),
    safetyCheckOccurred: false,
    prototypeEscalationTriggered: false,
    progress: 30,
    vehicleNumber: "DEMO VEHICLE",
    driverName: "Demo driver",
    note: "Sample journey data — no real trip or person.",
    lastLocationUpdateAt: new Date().toISOString(),
    connectionStatus: "online",
    emergencyState: "none",
    isDemo: true,
    events: [
      { id: createId("event"), type: "journeyStarted", timestamp: startedAt.toISOString() },
      { id: createId("event"), type: "onRoute", timestamp: new Date(startedAt.getTime() + 4 * 60_000).toISOString() },
    ],
  };
}

export function createDemoState(): AppState {
  const state = createEmptyState();
  return {
    ...state,
    mode: "demo",
    user: {
      ...state.user,
      name: "Demo Traveller",
      onboardingComplete: true,
    },
    contacts: demoContacts.map((contact) => ({ ...contact })),
    history: [createCompletedDemoJourney(2, false), createCompletedDemoJourney(5, true)],
    activeJourney: createDemoJourney(),
    demoViewerToken: createId("viewer"),
  };
}
