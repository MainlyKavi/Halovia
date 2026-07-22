import assert from "node:assert/strict";
import test from "node:test";
import { haversineMetres, locationFreshness, shouldSubmitLocation, validCoordinate, validImageRequest, validShareLifetimeHours } from "./validation.ts";

const now = Date.parse("2026-07-18T12:00:00.000Z");
const coordinate = {
  latitude: 28.6139,
  longitude: 77.209,
  accuracy: 18,
  heading: 90,
  speed: 8,
  deviceRecordedAt: new Date(now).toISOString(),
};

test("coordinate validation rejects malformed, impossible, and unusably inaccurate readings", () => {
  assert.deepEqual(validCoordinate(coordinate), coordinate);
  assert.equal(validCoordinate({ ...coordinate, latitude: 91 }), null);
  assert.equal(validCoordinate({ ...coordinate, longitude: -181 }), null);
  assert.equal(validCoordinate({ ...coordinate, accuracy: 500 }), null);
  assert.equal(validCoordinate({ ...coordinate, heading: 360 }), null);
  assert.equal(validCoordinate({ ...coordinate, speed: -1 }), null);
});

test("location submission ignores exact duplicates but accepts elapsed time or significant movement", () => {
  const previous = { ...coordinate, serverReceivedAt: new Date(now).toISOString() };
  assert.equal(shouldSubmitLocation(previous, coordinate, now + 2_000), false);
  assert.equal(shouldSubmitLocation(previous, { ...coordinate, deviceRecordedAt: new Date(now + 11_000).toISOString() }, now + 11_000), true);
  assert.equal(shouldSubmitLocation(previous, { ...coordinate, latitude: coordinate.latitude + 0.001, deviceRecordedAt: new Date(now + 2_000).toISOString() }, now + 2_000), true);
  assert.ok(haversineMetres(previous, { ...coordinate, latitude: coordinate.latitude + 0.001 }) > 100);
});

test("freshness never labels missing or old server updates live", () => {
  assert.equal(locationFreshness(null, now), "unavailable");
  assert.equal(locationFreshness(new Date(now - 10_000).toISOString(), now), "live");
  assert.equal(locationFreshness(new Date(now - 60_000).toISOString(), now), "stale");
});

test("share lifetime and image validation enforce central policy bounds", () => {
  assert.equal(validShareLifetimeHours(0), 1);
  assert.equal(validShareLifetimeHours(500), 72);
  assert.equal(validImageRequest("image/jpeg", String(1024)), null);
  assert.equal(validImageRequest("image/heic", String(1024)), "type");
  assert.equal(validImageRequest("image/png", String(20 * 1024 * 1024)), "size");
});
