import type { AppState, Journey, TrustedContact } from "@/lib/types";

export const mockContacts: TrustedContact[] = [
  {
    id: "contact-1",
    name: "Ananya Rao",
    relationship: "Sister",
    phone: "+91 98765 43210",
    initials: "AR",
    color: "#7c6ee6",
    preference: "all",
    active: true,
    defaultForJourneys: true,
    emergencyAlerts: true,
  },
  {
    id: "contact-2",
    name: "Kabir Mehta",
    relationship: "Friend",
    phone: "+91 99887 76124",
    initials: "KM",
    color: "#e07b8f",
    preference: "emergency",
    active: true,
    defaultForJourneys: true,
    emergencyAlerts: true,
  },
  {
    id: "contact-3",
    name: "Maya Rao",
    relationship: "Mother",
    phone: "+91 91234 55678",
    initials: "MR",
    color: "#4f9f8f",
    preference: "all",
    active: true,
    defaultForJourneys: false,
    emergencyAlerts: true,
  },
];

const completedJourney: Journey = {
  id: "journey-001",
  origin: "Koramangala",
  destination: "Home · Indiranagar",
  startedAt: "2026-07-14T18:10:00.000Z",
  eta: "2026-07-14T18:42:00.000Z",
  endedAt: "2026-07-14T18:39:00.000Z",
  durationMinutes: 29,
  travelType: "cab",
  status: "arrivedSafely",
  contactIds: ["contact-1", "contact-2"],
  safetyCheckOccurred: false,
  alertTriggered: false,
  progress: 100,
  vehicleNumber: "KA 01 AB 4821",
  events: [
    { id: "e1", type: "journeyStarted", timestamp: "2026-07-14T18:10:00.000Z" },
    { id: "e2", type: "onRoute", timestamp: "2026-07-14T18:16:00.000Z" },
    { id: "e3", type: "arrivedSafely", timestamp: "2026-07-14T18:39:00.000Z" },
  ],
};

const checkedJourney: Journey = {
  id: "journey-002",
  origin: "Bengaluru City Station",
  destination: "Church Street",
  startedAt: "2026-07-11T15:25:00.000Z",
  eta: "2026-07-11T15:55:00.000Z",
  endedAt: "2026-07-11T16:02:00.000Z",
  durationMinutes: 37,
  travelType: "publicTransport",
  status: "arrivedSafely",
  contactIds: ["contact-1"],
  safetyCheckOccurred: true,
  alertTriggered: false,
  progress: 100,
  events: [
    { id: "e4", type: "journeyStarted", timestamp: "2026-07-11T15:25:00.000Z" },
    { id: "e5", type: "safetyCheckRequested", timestamp: "2026-07-11T15:48:00.000Z" },
    { id: "e6", type: "arrivedSafely", timestamp: "2026-07-11T16:02:00.000Z" },
  ],
};

export function createSampleJourney(): Journey {
  const startedAt = new Date(Date.now() - 26 * 60_000);
  const eta = new Date(Date.now() + 22 * 60_000);
  return {
    id: "active-sample",
    origin: "Home · Indiranagar",
    destination: "Kempegowda International Airport",
    startedAt: startedAt.toISOString(),
    eta: eta.toISOString(),
    durationMinutes: 48,
    travelType: "cab",
    status: "onRoute",
    contactIds: ["contact-1", "contact-2"],
    safetyCheckOccurred: false,
    alertTriggered: false,
    progress: 58,
    vehicleNumber: "KA 03 MN 2470",
    driverName: "Ramesh K.",
    note: "Terminal 1 departures",
    events: [
      { id: "active-e1", type: "journeyStarted", timestamp: startedAt.toISOString() },
      { id: "active-e2", type: "onRoute", timestamp: new Date(startedAt.getTime() + 6 * 60_000).toISOString() },
    ],
  };
}

export function createDefaultState(): AppState {
  return {
    user: {
      id: "user-1",
      name: "Aarav",
      language: "en",
      theme: "light",
      onboardingComplete: false,
      region: "IN",
    },
    contacts: mockContacts,
    history: [completedJourney, checkedJourney],
    activeJourney: createSampleJourney(),
    emergency: {
      number: "112",
      region: "India",
      shareLastLocation: true,
      soundAlarm: true,
    },
    privacy: {
      historyRetention: "30",
      reducedMotion: false,
      notifications: true,
      locationWhileActive: true,
    },
  };
}
