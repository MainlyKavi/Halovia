import assert from "node:assert/strict";
import test from "node:test";
import { buildDeviationAlert, buildSosAlert, directionsLink, formatAlertText, formatDistance, locationLink } from "./alerts.ts";
import { DEFAULT_DEVIATION_CONFIG, evaluateDeviation, INITIAL_DEVIATION_STATE, type DeviationState } from "./deviation.ts";
import { FALLBACK_ROUTE, FALLBACK_ROUTE_DISTANCE_METRES } from "./fallback-route.ts";
import { destinationPoint, distanceToPolylineMetres, haversineMetres, pointAlongPolyline, polylineLengthMetres, projectOntoPolyline, slicePolyline, type LatLng } from "./geo.ts";
import { DEMO_MEMBERS, initialsFor, reconcileSelection, removeMember, toggleSelection, upsertMember, validateMember } from "./group.ts";
import { buildOverpassQuery, FALLBACK_SAFETY_PLACES, fetchSafetyPlaces, nearestSafetyPlaces, parseOverpassResponse, placesCacheKey, type KeyValueStore } from "./places.ts";
import { createMockRide, MockRideProvider } from "./ride-provider.ts";
import { FALLBACK_PLANNED_ROUTE, fetchPlannedRoute, parseOsrmResponse } from "./route.ts";
import { advanceSimulation, cabPosition, DETOUR_LENGTH_METRES, INITIAL_SIMULATION, remainingMetres, startWrongTurn } from "./simulation.ts";

const near = (actual: number, expected: number, tolerance: number, message?: string) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, message ?? `expected ${actual} to be within ${tolerance} of ${expected}`);

// A straight east-west road of ~1.08 km along the equator-ish latitude of Bengaluru.
const west: LatLng = { lat: 12.95, lng: 77.6 };
const east: LatLng = { lat: 12.95, lng: 77.61 };
const straight = [west, east];

test("haversine matches known distances", () => {
  near(haversineMetres(west, east), 1_084, 3);
  near(haversineMetres({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }), 111_195, 5);
  assert.equal(haversineMetres(west, west), 0);
});

test("destinationPoint round-trips with haversine", () => {
  const moved = destinationPoint(west, 0, 500);
  near(haversineMetres(west, moved), 500, 0.5);
  assert.ok(moved.lat > west.lat);
});

test("point-to-polyline distance is perpendicular in the middle and clamps at the ends", () => {
  const mid = { lat: 12.95, lng: 77.605 };
  const north300 = destinationPoint(mid, 0, 300);
  near(distanceToPolylineMetres(north300, straight), 300, 1);

  const projection = projectOntoPolyline(north300, straight);
  near(projection.alongMetres, 542, 3);
  assert.equal(projection.segmentIndex, 0);

  // Beyond the eastern end the nearest point is the end vertex itself.
  const pastEnd = destinationPoint(east, 90, 400);
  near(distanceToPolylineMetres(pastEnd, straight), 400, 1);

  // A point on the line is at distance ~0.
  near(distanceToPolylineMetres(mid, straight), 0, 0.5);
});

test("point-to-polyline picks the closest of several segments", () => {
  const corner = { lat: 12.96, lng: 77.61 };
  const lShape = [west, east, corner];
  const besideSecondLeg = destinationPoint({ lat: 12.955, lng: 77.61 }, 90, 120);
  const projection = projectOntoPolyline(besideSecondLeg, lShape);
  assert.equal(projection.segmentIndex, 1);
  near(projection.distanceMetres, 120, 1);
});

test("single-point and degenerate polylines are handled", () => {
  near(distanceToPolylineMetres(east, [west]), 1_084, 3);
  near(distanceToPolylineMetres(east, [west, west]), 1_084, 3);
  assert.throws(() => projectOntoPolyline(west, []));
});

test("pointAlongPolyline and slicePolyline walk the route", () => {
  const half = pointAlongPolyline(straight, 542);
  near(half.point.lng, 77.605, 0.0001);
  near(half.bearing, 90, 0.5);
  assert.deepEqual(pointAlongPolyline(straight, -10).point, west);
  assert.deepEqual(pointAlongPolyline(straight, 99_999).point, east);
  const slice = slicePolyline(straight, 542);
  assert.equal(slice.length, 2);
  near(polylineLengthMetres(slice), 542, 1);
});

test("the baked fallback route is a real, continuous road route", () => {
  assert.ok(FALLBACK_ROUTE.length > 50);
  near(polylineLengthMetres(FALLBACK_ROUTE), FALLBACK_ROUTE_DISTANCE_METRES, 150);
  for (let index = 1; index < FALLBACK_ROUTE.length; index += 1) {
    assert.ok(haversineMetres(FALLBACK_ROUTE[index - 1], FALLBACK_ROUTE[index]) < 600, `gap at ${index}`);
  }
});

test("deviation needs both the distance threshold and the grace period", () => {
  const config = { thresholdMetres: 300, graceMs: 4_000 };
  const mid = { lat: 12.95, lng: 77.605 };
  const slightlyOff = destinationPoint(mid, 0, 200);
  const farOff = destinationPoint(mid, 0, 450);

  let result = evaluateDeviation(INITIAL_DEVIATION_STATE, straight, slightlyOff, 0, config);
  assert.equal(result.event, null);
  assert.equal(result.state.offRouteSince, null);

  result = evaluateDeviation(result.state, straight, farOff, 1_000, config);
  assert.equal(result.event, null, "not yet: grace period running");
  assert.equal(result.state.offRouteSince, 1_000);
  assert.equal(result.state.deviated, false);

  result = evaluateDeviation(result.state, straight, farOff, 4_999, config);
  assert.equal(result.event, null);

  result = evaluateDeviation(result.state, straight, farOff, 5_000, config);
  assert.equal(result.event, "deviationStarted");
  assert.equal(result.state.deviated, true);
  near(result.state.distanceMetres, 450, 1);

  result = evaluateDeviation(result.state, straight, farOff, 9_000, config);
  assert.equal(result.event, null, "fires once per excursion");

  result = evaluateDeviation(result.state, straight, mid, 10_000, config);
  assert.equal(result.event, "backOnRoute");
  assert.deepEqual({ ...result.state, distanceMetres: 0 }, { offRouteSince: null, deviated: false, distanceMetres: 0 });
});

test("brief GPS jumps off the route do not raise a deviation", () => {
  const mid = { lat: 12.95, lng: 77.605 };
  const farOff = destinationPoint(mid, 180, 500);
  let state: DeviationState = INITIAL_DEVIATION_STATE;
  for (const [time, point] of [[0, farOff], [2_000, mid], [3_000, farOff], [6_000, mid]] as const) {
    const result = evaluateDeviation(state, straight, point, time, DEFAULT_DEVIATION_CONFIG);
    assert.equal(result.event, null);
    state = result.state;
  }
  assert.equal(state.deviated, false);
});

test("deviation with an empty route never fires", () => {
  const result = evaluateDeviation(INITIAL_DEVIATION_STATE, [], west, 10_000);
  assert.equal(result.event, null);
});

test("simulated cab follows the route, takes a wrong turn and rejoins", () => {
  const route = FALLBACK_ROUTE;
  let sim = advanceSimulation(route, INITIAL_SIMULATION, 1_500);
  near(sim.travelledMetres, 1_500, 0.01);
  near(distanceToPolylineMetres(cabPosition(route, sim).point, route), 0, 1);

  sim = startWrongTurn(route, sim);
  assert.ok(sim.detour);
  assert.equal(startWrongTurn(route, sim), sim, "cannot start a second detour");

  sim = advanceSimulation(route, sim, DETOUR_LENGTH_METRES);
  const offRoute = distanceToPolylineMetres(cabPosition(route, sim).point, route);
  assert.ok(offRoute > DEFAULT_DEVIATION_CONFIG.thresholdMetres, `detour should leave the route, got ${offRoute} m`);

  sim = advanceSimulation(route, sim, DETOUR_LENGTH_METRES + 1);
  assert.equal(sim.detour, null);
  near(sim.travelledMetres, 1_500, 0.01, "rejoins where it turned off");

  sim = advanceSimulation(route, sim, 1_000_000);
  assert.equal(sim.arrived, true);
  assert.equal(remainingMetres(route, sim), 0);
  assert.equal(advanceSimulation(route, sim, 100), sim);
});

test("trusted group helpers validate, upsert and keep selections in sync", () => {
  assert.equal(initialsFor("Lakshmi Iyer"), "LI");
  assert.equal(initialsFor("  priya  "), "PR");
  assert.equal(initialsFor("Ana María de la Cruz"), "AC");
  assert.equal(initialsFor(""), "?");
  assert.equal(initialsFor("सीता देवी"), "सद");

  assert.deepEqual(validateMember({ name: "", phone: "12" }), ["nameRequired", "phoneInvalid"]);
  assert.deepEqual(validateMember({ name: "A", phone: "+91 (900) 000-0001" }), []);
  assert.deepEqual(validateMember({ name: "A", phone: "call me" }), ["phoneInvalid"]);

  const added = upsertMember(DEMO_MEMBERS, { id: "new", name: " Meera Rao ", phone: "+91 90000 00009", relation: "Aunt", initials: "", color: "#000" });
  assert.equal(added.length, 4);
  assert.equal(added[3].name, "Meera Rao");
  assert.equal(added[3].initials, "MR");
  const edited = upsertMember(added, { ...added[3], name: "Meera R" });
  assert.equal(edited.length, 4);
  assert.equal(edited[3].name, "Meera R");

  const selection = toggleSelection(toggleSelection([], "new"), "member-priya");
  assert.deepEqual(selection, ["new", "member-priya"]);
  assert.deepEqual(toggleSelection(selection, "new"), ["member-priya"]);
  assert.deepEqual(reconcileSelection(selection, removeMember(edited, "new")), ["member-priya"]);
});

test("Overpass parsing keeps named police and hospitals with coordinates", () => {
  const places = parseOverpassResponse({
    elements: [
      { type: "node", id: 1, lat: 12.9, lon: 77.6, tags: { amenity: "police", name: "A Station", phone: "100" } },
      { type: "way", id: 2, center: { lat: 12.91, lon: 77.61 }, tags: { amenity: "hospital", name: "Local", "name:en": "City Hospital" } },
      { type: "node", id: 3, lat: 12.9, lon: 77.6, tags: { amenity: "hospital" } },
      { type: "node", id: 4, lat: 12.9, lon: 77.6, tags: { amenity: "school", name: "School" } },
      { type: "way", id: 5, tags: { amenity: "police", name: "No coordinates" } },
    ],
  });
  assert.deepEqual(places.map((place) => place.name), ["A Station", "City Hospital"]);
  assert.equal(places[0].phone, "100");
  assert.equal(places[1].id, "osm-way-2");
  assert.deepEqual(parseOverpassResponse(null), []);
  assert.deepEqual(parseOverpassResponse({ elements: "nope" }), []);
  assert.match(buildOverpassQuery({ lat: 12.95, lng: 77.62 }, 3_000), /around:3000,12\.95000,77\.62000/u);
});

test("nearest safety places skip specialist clinics and measure distance", () => {
  const from = FALLBACK_ROUTE[0];
  const nearest = nearestSafetyPlaces([
    ...FALLBACK_SAFETY_PLACES,
    { id: "eye", kind: "hospital", name: "Prasad Eye Hospital", location: from },
  ], from);
  assert.notEqual(nearest.hospital?.id, "eye", "the eye clinic is closer but is not an emergency hospital");
  assert.equal(nearest.hospital?.name, "Apollo Spectra Hospitals");
  assert.ok(nearest.police);
  assert.ok((nearest.hospital?.distanceMetres ?? 0) > 0);
  assert.deepEqual(nearestSafetyPlaces([], from), { police: null, hospital: null });
});

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); } };
}

const okJson = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

test("safety places fall back offline, cache live results and reuse them", async () => {
  const center = { lat: 12.95, lng: 77.62 };
  const failing = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
  const offline = await fetchSafetyPlaces(center, { fetcher: failing, store: memoryStore() });
  assert.equal(offline.source, "fallback");
  assert.equal(offline.places, FALLBACK_SAFETY_PLACES);

  const store = memoryStore();
  const live = await fetchSafetyPlaces(center, {
    store,
    now: 1_000,
    fetcher: okJson({ elements: [
      { type: "node", id: 1, lat: 12.9, lon: 77.6, tags: { amenity: "police", name: "P" } },
      { type: "node", id: 2, lat: 12.9, lon: 77.6, tags: { amenity: "hospital", name: "H" } },
    ] }),
  });
  assert.equal(live.source, "live");
  assert.ok(store.data.has(placesCacheKey(center)));

  const cached = await fetchSafetyPlaces(center, { store, now: 2_000, fetcher: failing });
  assert.equal(cached.source, "cache");
  assert.equal(cached.places.length, 2);

  const staleButOffline = await fetchSafetyPlaces(center, { store, now: 10 * 24 * 60 * 60_000, fetcher: failing });
  assert.equal(staleButOffline.source, "cache", "stale cache beats the generic fallback when offline");

  const partial = await fetchSafetyPlaces(center, { store: memoryStore(), fetcher: okJson({ elements: [{ type: "node", id: 1, lat: 1, lon: 1, tags: { amenity: "police", name: "P" } }] }) });
  assert.equal(partial.source, "fallback", "a result missing hospitals is not good enough for SOS");
});

test("OSRM route parsing and fallback", async () => {
  const geometry = { coordinates: [[77.610937, 12.934892], [77.62, 12.95], [77.640545, 12.971888]] };
  const parsed = parseOsrmResponse({ routes: [{ distance: 8_000, duration: 600, geometry }] });
  assert.equal(parsed?.points.length, 3);
  assert.deepEqual(parsed?.points[0], { lat: 12.934892, lng: 77.610937 });
  assert.equal(parseOsrmResponse({ routes: [] }), null);
  assert.equal(parseOsrmResponse({ routes: [{ geometry: { coordinates: [[1, 2]] } }] }), null);

  const from = { lat: 12.934892, lng: 77.610937 };
  const to = { lat: 12.971888, lng: 77.640545 };
  const live = await fetchPlannedRoute(from, to, okJson({ routes: [{ distance: 8_000, duration: 600, geometry }] }));
  assert.equal(live.source, "osrm");
  const wrongPlace = await fetchPlannedRoute({ lat: 0, lng: 0 }, to, okJson({ routes: [{ distance: 8_000, duration: 600, geometry }] }));
  assert.equal(wrongPlace, FALLBACK_PLANNED_ROUTE);
  const offline = await fetchPlannedRoute(from, to, (async () => { throw new Error("offline"); }) as unknown as typeof fetch);
  assert.equal(offline, FALLBACK_PLANNED_ROUTE);
});

test("mock ride provider is clearly simulated and branded by text only", async () => {
  const provider = new MockRideProvider("ola", () => 0);
  assert.equal(provider.label, "Ola");
  assert.equal(provider.isLive, false);
  const ride = await provider.getActiveRide();
  assert.equal(ride?.isSimulated, true);
  assert.equal(ride?.brand, "ola");
  assert.match(ride?.vehicle.plate ?? "", /^KA \d{2} [A-Z]{2} \d{4}$/u);
  assert.notEqual(createMockRide("uber").vehicle.plate, createMockRide("rapido").vehicle.plate);
});

test("alerts include location link, ride, plate and nearest help", () => {
  const ride = createMockRide("rapido", 0);
  const location = FALLBACK_ROUTE[40];
  const nearest = nearestSafetyPlaces(FALLBACK_SAFETY_PLACES, location);
  const sos = buildSosAlert({ id: "a1", userName: "Ananya", location, ride, nearest, recipientIds: ["m1"], now: 0 });
  assert.equal(sos.kind, "sos");
  assert.equal(sos.simulated, true);
  assert.equal(sos.ride?.plate, ride.vehicle.plate);
  assert.equal(sos.locationLink, locationLink(location));
  const text = formatAlertText(sos);
  for (const expected of ["SOS: Ananya needs help.", ride.vehicle.plate, "Nearest police:", "Nearest hospital:", "openstreetmap.org"]) assert.ok(text.includes(expected), expected);

  const deviation = buildDeviationAlert({ id: "a2", userName: " ", location, ride: null, nearest, recipientIds: [], distanceOffRouteMetres: 412.4 });
  assert.equal(deviation.userName, "Halovia user");
  assert.equal(deviation.distanceOffRouteMetres, 412);
  assert.match(formatAlertText(deviation), /left the planned route\.\nOff route by 410 m\./u);

  assert.equal(formatDistance(1_540), "1.5 km");
  assert.match(directionsLink(location, "Police & Co", true), /^geo:.+\(Police%20%26%20Co\)$/u);
  assert.match(directionsLink(location, "x", false), /^https:\/\/www\.openstreetmap\.org\/directions/u);
});
