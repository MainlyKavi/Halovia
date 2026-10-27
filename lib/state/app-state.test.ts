import assert from "node:assert/strict";
import test from "node:test";
import { createDemoState, createEmptyState } from "../mock-data.ts";
import { applyHistoryRetention, calculateJourneyProgress, normalizeAppState } from "./app-state.ts";
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
