import assert from "node:assert/strict";
import test from "node:test";
import { createDemoState, createEmptyState } from "../mock-data.ts";
import {
  applyHistoryRetention,
  calculateJourneyProgress,
  completeJourneyTransition,
  createDefaultEta,
  escalateSafetyCheckTransition,
  extendSafetyCheckTransition,
  normalizeAppState,
  recordSafeCheckInTransition,
  requestHelpTransition,
  resolveLaunchRoute,
} from "./app-state.ts";
import type { Journey } from "../types.ts";

const day = 24 * 60 * 60_000;
const now = Date.UTC(2026, 6, 16, 12, 0, 0);

function completedJourney(id: string, ageDays: number): Journey {
  const endedAt = new Date(now - ageDays * day).toISOString();
  const startedAt = new Date(now - ageDays * day - 30 * 60_000).toISOString();
  return {
    id,
    origin: "Test origin",
    destination: "Test destination",
    startedAt,
    eta: endedAt,
    endedAt,
    durationMinutes: 30,
    travelType: "walking",
    status: "arrivedSafely",
    contactIds: [],
    safetyCheckOccurred: false,
    prototypeEscalationTriggered: false,
    progress: 100,
    lastLocationUpdateAt: endedAt,
    connectionStatus: "online",
    emergencyState: "none",
    events: [],
  };
}

test("a clean first-run state is empty and pink by default", () => {
  const state = createEmptyState();
  assert.equal(state.mode, "clean");
  assert.equal(state.user.theme, "pink");
  assert.equal(state.user.name, "");
  assert.deepEqual(state.contacts, []);
  assert.deepEqual(state.history, []);
  assert.equal(state.activeJourney, null);
});

test("sample data appears only in the explicitly-created demo state", () => {
  const clean = createEmptyState();
  const demo = createDemoState();
  assert.equal(clean.activeJourney, null);
  assert.equal(demo.mode, "demo");
  assert.equal(demo.activeJourney?.isDemo, true);
  assert.ok(demo.contacts.every((contact) => contact.isDemo));
  assert.ok(demo.history.every((journey) => journey.isDemo));
});

test("history retention applies auto, 7-day, 30-day, and manual rules", () => {
  const history = [completedJourney("recent", 2), completedJourney("mid", 12), completedJourney("old", 45)];
  assert.deepEqual(applyHistoryRetention(history, "auto", now), []);
  assert.deepEqual(applyHistoryRetention(history, "7", now).map(({ id }) => id), ["recent"]);
  assert.deepEqual(applyHistoryRetention(history, "30", now).map(({ id }) => id), ["recent", "mid"]);
  assert.equal(applyHistoryRetention(history, "manual", now), history);
});

test("elapsed-time progress starts at zero and remains clamped", () => {
  const startedAt = new Date(now).toISOString();
  const eta = new Date(now + 40 * 60_000).toISOString();
  const journey = { startedAt, eta };
  assert.equal(calculateJourneyProgress(journey, now - 1_000), 0);
  assert.equal(calculateJourneyProgress(journey, now + 20 * 60_000), 50);
  assert.equal(calculateJourneyProgress(journey, now + 90 * 60_000), 100);
});

test("corrupt or legacy browser data falls back to a clean empty state", () => {
  const fallback = createEmptyState();
  assert.equal(normalizeAppState({ version: 1, contacts: [{ name: "Legacy sample" }] }, fallback), fallback);
  const normalized = normalizeAppState({ version: 2, user: null, contacts: "broken", history: [null], privacy: {} }, fallback);
  assert.deepEqual(normalized.contacts, []);
  assert.deepEqual(normalized.history, []);
  assert.equal(normalized.activeJourney, null);
  assert.equal(normalized.user.theme, "pink");
});

test("saved theme, language, locale, and RTL language remain independent", () => {
  const fallback = createEmptyState();
  const normalized = normalizeAppState({
    ...fallback,
    user: { ...fallback.user, theme: "dark", language: "ar", locale: "ur-PK", country: "US", dateFormat: "monthFirst" },
  }, fallback);
  assert.equal(normalized.user.theme, "dark");
  assert.equal(normalized.user.language, "ar");
  assert.equal(normalized.user.locale, "ur-PK");
  assert.equal(normalized.user.country, "US");
  assert.equal(normalized.user.dateFormat, "monthFirst");
});

test("new journey ETAs default to a valid 30 to 45 minute window", () => {
  const eta = new Date(createDefaultEta(now, 40)).getTime();
  assert.equal(eta - now, 40 * 60_000);
  assert.equal(new Date(createDefaultEta(now, 5)).getTime() - now, 30 * 60_000);
  assert.equal(new Date(createDefaultEta(now, 90)).getTime() - now, 45 * 60_000);
});

test("legacy driving journeys migrate to the car or cab transport type", () => {
  const fallback = createEmptyState();
  const legacyJourney = { ...completedJourney("legacy-driving", 1), travelType: "driving" };
  const normalized = normalizeAppState({ ...fallback, history: [legacyJourney] }, fallback);
  assert.equal(normalized.history[0]?.travelType, "cab");
});

test("safe check-ins persist an event, clear emergencies, and prevent rapid duplicates", () => {
  const state = createDemoState();
  state.safetyCheck = {
    id: "check-1",
    reason: "manualDemo",
    startedAt: new Date(now - 10_000).toISOString(),
    deadlineAt: new Date(now + 45_000).toISOString(),
    responseSeconds: 45,
    extensionUsed: false,
    escalated: false,
  };
  const checked = recordSafeCheckInTransition(state, now);
  assert.equal(checked.safetyCheck, null);
  assert.equal(checked.activeJourney?.status, "safeCheckIn");
  assert.equal(checked.activeJourney?.events.at(-1)?.type, "safeCheckIn");
  assert.equal(recordSafeCheckInTransition(checked, now + 1_000), checked);
});

test("safety-check extension, help, escalation, and journey ending are consistent", () => {
  const state = createDemoState();
  state.safetyCheck = {
    id: "check-2",
    reason: "extendedStop",
    startedAt: new Date(now - 5_000).toISOString(),
    deadlineAt: new Date(now + 40_000).toISOString(),
    responseSeconds: 45,
    extensionUsed: false,
    escalated: false,
  };
  const extended = extendSafetyCheckTransition(state, now);
  assert.equal(extended.safetyCheck?.extensionUsed, true);
  assert.equal(new Date(extended.safetyCheck?.deadlineAt ?? 0).getTime(), now + 160_000);
  assert.equal(extendSafetyCheckTransition(extended, now + 1_000), extended);

  const helped = requestHelpTransition(state, now);
  assert.equal(helped.safetyCheck, null);
  assert.equal(helped.activeJourney?.emergencyState, "helpRequested");

  const escalated = escalateSafetyCheckTransition(state, now);
  assert.equal(escalated.safetyCheck?.escalated, true);
  assert.equal(escalated.activeJourney?.emergencyState, "prototypeEscalated");

  const ended = completeJourneyTransition(state, "endedManually", now);
  assert.equal(ended.activeJourney, null);
  assert.equal(ended.safetyCheck, null);
  assert.equal(ended.history[0]?.status, "endedManually");
});

test("launch routing never bypasses onboarding and prioritises an active journey", () => {
  const clean = createEmptyState();
  assert.equal(resolveLaunchRoute(clean), "/");
  assert.equal(resolveLaunchRoute({ ...clean, user: { ...clean.user, onboardingComplete: true } }), "/home");
  assert.equal(resolveLaunchRoute(createDemoState()), "/active");
});
