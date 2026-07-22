import assert from "node:assert/strict";
import test from "node:test";
import { locationUpdateAge, shouldReuseRoute } from "./map-policy.ts";

test("location update age uses calm customer-facing time buckets", () => {
  const now = Date.UTC(2026, 6, 19, 12, 0, 0);
  assert.deepEqual(locationUpdateAge(null, now), { kind: "unavailable" });
  assert.deepEqual(locationUpdateAge(new Date(now - 4_000).toISOString(), now), { kind: "justNow" });
  assert.deepEqual(locationUpdateAge(new Date(now - 12_000).toISOString(), now), { kind: "seconds", value: 12 });
  assert.deepEqual(locationUpdateAge(new Date(now - 125_000).toISOString(), now), { kind: "minutes", value: 2 });
});

test("route results are reused only for the same nearby journey", () => {
  const previous = { latitude: 28.4595, longitude: 77.0266 };
  assert.equal(shouldReuseRoute(previous, { latitude: 28.4597, longitude: 77.0267 }, "cab:destination-a", "cab:destination-a", true, 100), true);
  assert.equal(shouldReuseRoute(previous, { latitude: 28.4695, longitude: 77.0266 }, "cab:destination-a", "cab:destination-a", true, 100), false);
  assert.equal(shouldReuseRoute(previous, previous, "cab:destination-a", "walking:destination-a", true, 100), false);
  assert.equal(shouldReuseRoute(previous, previous, "cab:destination-a", "cab:destination-a", false, 100), false);
});
