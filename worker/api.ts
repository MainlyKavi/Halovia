import { SCHEMA_STATEMENTS } from "../db/schema";
import { locationFreshness, cleanText, isRecord, optionalText, shouldSubmitLocation, validCoordinate, validImageRequest, validIsoDate, validShareLifetimeHours, validTravelType } from "../lib/backend/validation";
import type { BackendContact, BackendJourney, BackendJourneyEvent, BackendProfile, BackendSafetyCheck, DeviceCoordinate, ViewerPayload } from "../lib/api-types";
import { assertSameOrigin, authenticatedEmail, PRIVATE_HEADERS, rateLimit, secureId, secureToken, sha256 } from "./security";
import type { D1Database, Env } from "./runtime-types";

let schemaInitialised = false;

interface JourneyRow {
  id: string;
  owner_id: string;
  owner_display_name: string;
  origin_name: string;
  origin_lat: number;
  origin_lng: number;
  destination_name: string;
  destination_lat: number;
  destination_lng: number;
  transport_type: BackendJourney["transportType"];
  safety_eta: string;
  route_eta: string | null;
  remaining_distance_metres: number | null;
  status: BackendJourney["status"];
  safety_status: BackendJourney["safetyStatus"];
  sharing_status: BackendJourney["sharingStatus"];
  driver_name: string | null;
  vehicle_number: string | null;
  vehicle_description: string | null;
  vehicle_image_key: string | null;
  notes: string | null;
  started_at: string;
  completed_at: string | null;
  last_location_at: string | null;
  last_server_update_at: string | null;
}

interface LocationRow {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  device_recorded_at: string;
  server_received_at: string;
}

interface ApiContext {
  request: Request;
  env: Env;
  userId: string;
  email: string;
}

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(data, { status, headers: { ...PRIVATE_HEADERS, ...headers } });
}

function apiError(status: number, code: string, message: string): Response {
  return json({ error: message, code }, status);
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value = await request.json() as unknown;
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

async function ensureSchema(db: D1Database): Promise<void> {
  if (schemaInitialised) return;
  try {
    await db.prepare("SELECT id FROM users LIMIT 1").first();
  } catch {
    await db.batch(SCHEMA_STATEMENTS.map((statement) => db.prepare(statement)));
  }
  schemaInitialised = true;
}

async function ensureUser(db: D1Database, email: string): Promise<string> {
  const userId = `usr_${(await sha256(email)).slice(0, 32)}`;
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET updated_at = excluded.updated_at`)
    .bind(userId, email, now, now).run();
  return userId;
}

function mapProfile(row: Record<string, unknown>): BackendProfile {
  return {
    id: String(row.id),
    displayName: String(row.display_name ?? ""),
    language: String(row.language ?? "en"),
    locale: String(row.locale ?? "en-IN"),
    country: String(row.country ?? "IN"),
    dateFormat: String(row.date_format ?? "locale"),
    emergencyNumber: String(row.emergency_number ?? "112"),
    retentionDays: Number(row.retention_days) === 7 ? 7 : 30,
    onboardingComplete: Boolean(row.onboarding_complete),
  };
}

function mapContact(row: Record<string, unknown>): BackendContact {
  return {
    id: String(row.id),
    name: String(row.name),
    phone: String(row.phone),
    relationship: String(row.relationship ?? ""),
    active: Boolean(row.active),
    defaultForJourneys: Boolean(row.default_for_journeys),
    emergencyAlerts: Boolean(row.emergency_alerts),
  };
}

function mapLocation(row: LocationRow | null): (DeviceCoordinate & { serverReceivedAt: string }) | null {
  if (!row) return null;
  return {
    latitude: row.latitude,
    longitude: row.longitude,
    accuracy: row.accuracy,
    heading: row.heading,
    speed: row.speed,
    deviceRecordedAt: row.device_recorded_at,
    serverReceivedAt: row.server_received_at,
  };
}

async function journeyDetails(db: D1Database, row: JourneyRow): Promise<BackendJourney> {
  const [location, eventResult, safetyCheck] = await Promise.all([
    db.prepare(`SELECT latitude, longitude, accuracy, heading, speed, device_recorded_at, server_received_at
      FROM journey_locations WHERE journey_id = ? ORDER BY server_received_at DESC LIMIT 1`).bind(row.id).first<LocationRow>(),
    db.prepare(`SELECT id, event_type, detail_json, created_at FROM journey_events
      WHERE journey_id = ? ORDER BY created_at DESC LIMIT 50`).bind(row.id).all<{ id: string; event_type: string; detail_json: string | null; created_at: string }>(),
    db.prepare(`SELECT id, status, reason, deadline_at, extension_count, responded_at FROM safety_checks
      WHERE journey_id = ? ORDER BY created_at DESC LIMIT 1`).bind(row.id).first<{ id: string; status: BackendSafetyCheck["status"]; reason: string; deadline_at: string; extension_count: number; responded_at: string | null }>(),
  ]);
  const events: BackendJourneyEvent[] = (eventResult.results ?? []).map((event) => {
    let detail: Record<string, unknown> | null = null;
    if (event.detail_json) {
      try {
        const parsed = JSON.parse(event.detail_json) as unknown;
        if (isRecord(parsed)) detail = parsed;
      } catch { /* Malformed historical detail is ignored safely. */ }
    }
    return { id: event.id, type: event.event_type, detail, createdAt: event.created_at };
  });
  return {
    id: row.id,
    ownerDisplayName: row.owner_display_name,
    originName: row.origin_name,
    origin: { latitude: row.origin_lat, longitude: row.origin_lng },
    destinationName: row.destination_name,
    destination: { latitude: row.destination_lat, longitude: row.destination_lng },
    transportType: row.transport_type,
    safetyEta: row.safety_eta,
    routeEta: row.route_eta,
    remainingDistanceMetres: row.remaining_distance_metres,
    status: row.status,
    safetyStatus: row.safety_status,
    sharingStatus: row.sharing_status,
    driverName: row.driver_name,
    vehicleNumber: row.vehicle_number,
    vehicleDescription: row.vehicle_description,
    hasVehicleImage: Boolean(row.vehicle_image_key),
    notes: row.notes,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    lastLocationAt: row.last_location_at,
    lastServerUpdateAt: row.last_server_update_at,
    latestLocation: mapLocation(location),
    events,
    safetyCheck: safetyCheck ? {
      id: safetyCheck.id,
      status: safetyCheck.status,
      reason: safetyCheck.reason,
      deadlineAt: safetyCheck.deadline_at,
      extensionCount: safetyCheck.extension_count,
      respondedAt: safetyCheck.responded_at,
    } : null,
  };
}

async function ownedJourney(db: D1Database, userId: string, journeyId: string): Promise<JourneyRow | null> {
  return db.prepare("SELECT * FROM journeys WHERE id = ? AND owner_id = ?").bind(journeyId, userId).first<JourneyRow>();
}

async function recordEvent(db: D1Database, journeyId: string, type: string, detail: Record<string, unknown> | null, idempotencyKey: string | null, now: string): Promise<void> {
  await db.prepare(`INSERT OR IGNORE INTO journey_events (id, journey_id, event_type, detail_json, idempotency_key, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(secureId("evt"), journeyId, type, detail ? JSON.stringify(detail) : null, idempotencyKey, now).run();
}

async function handleState(context: ApiContext): Promise<Response> {
  const { env, userId } = context;
  const [profile, contacts, active, history] = await Promise.all([
    env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(userId).first<Record<string, unknown>>(),
    env.DB.prepare("SELECT * FROM trusted_contacts WHERE owner_id = ? ORDER BY created_at").bind(userId).all<Record<string, unknown>>(),
    env.DB.prepare("SELECT * FROM journeys WHERE owner_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1").bind(userId).first<JourneyRow>(),
    env.DB.prepare("SELECT * FROM journeys WHERE owner_id = ? AND status != 'active' ORDER BY completed_at DESC LIMIT 50").bind(userId).all<JourneyRow>(),
  ]);
  if (!profile) return apiError(500, "profile_missing", "The authenticated profile could not be loaded.");
  const historyDetails = await Promise.all((history.results ?? []).map((row) => journeyDetails(env.DB, row)));
  return json({
    profile: mapProfile(profile),
    contacts: (contacts.results ?? []).map(mapContact),
    activeJourney: active ? await journeyDetails(env.DB, active) : null,
    history: historyDetails,
  });
}

async function handleProfile(context: ApiContext): Promise<Response> {
  const body = await readJson(context.request);
  if (!body) return apiError(400, "invalid_json", "A valid profile payload is required.");
  const allowedLanguages = new Set(["en", "hi", "es", "fr", "ru", "ur", "bn", "ta", "ar"]);
  const displayName = cleanText(body.displayName, 80);
  const language = typeof body.language === "string" && allowedLanguages.has(body.language) ? body.language : "en";
  const locale = cleanText(body.locale, 20) || "en-IN";
  const country = cleanText(body.country, 8) || "IN";
  const dateFormat = ["locale", "dayFirst", "monthFirst"].includes(String(body.dateFormat)) ? String(body.dateFormat) : "locale";
  const emergencyNumber = cleanText(body.emergencyNumber, 12) || "112";
  const retentionDays = Number(body.retentionDays) === 7 ? 7 : 30;
  const now = new Date().toISOString();
  await context.env.DB.prepare(`UPDATE users SET display_name = ?, language = ?, locale = ?, country = ?, date_format = ?,
    emergency_number = ?, retention_days = ?, onboarding_complete = ?, updated_at = ? WHERE id = ?`)
    .bind(displayName, language, locale, country, dateFormat, emergencyNumber, retentionDays, body.onboardingComplete ? 1 : 0, now, context.userId).run();
  const profile = await context.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(context.userId).first<Record<string, unknown>>();
  return json({ profile: mapProfile(profile ?? {}) });
}

async function handleContacts(context: ApiContext, contactId?: string): Promise<Response> {
  const { request, env, userId } = context;
  if (request.method === "GET") {
    const result = await env.DB.prepare("SELECT * FROM trusted_contacts WHERE owner_id = ? ORDER BY created_at").bind(userId).all<Record<string, unknown>>();
    return json({ contacts: (result.results ?? []).map(mapContact) });
  }
  if (request.method === "DELETE" && contactId) {
    await env.DB.prepare("DELETE FROM trusted_contacts WHERE id = ? AND owner_id = ?").bind(contactId, userId).run();
    return new Response(null, { status: 204, headers: PRIVATE_HEADERS });
  }
  const body = await readJson(request);
  if (!body) return apiError(400, "invalid_json", "A valid contact payload is required.");
  const name = cleanText(body.name, 80);
  const phone = cleanText(body.phone, 40);
  if (!name || !phone) return apiError(422, "invalid_contact", "Contact name and contact method are required.");
  const id = contactId ?? secureId("con");
  const now = new Date().toISOString();
  if (contactId) {
    await env.DB.prepare(`UPDATE trusted_contacts SET name = ?, phone = ?, relationship = ?, active = ?, default_for_journeys = ?, emergency_alerts = ?, updated_at = ?
      WHERE id = ? AND owner_id = ?`)
      .bind(name, phone, optionalText(body.relationship, 60) ?? "", body.active === false ? 0 : 1, body.defaultForJourneys ? 1 : 0, body.emergencyAlerts ? 1 : 0, now, id, userId).run();
  } else {
    await env.DB.prepare(`INSERT INTO trusted_contacts (id, owner_id, name, phone, relationship, active, default_for_journeys, emergency_alerts, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, userId, name, phone, optionalText(body.relationship, 60) ?? "", body.active === false ? 0 : 1, body.defaultForJourneys ? 1 : 0, body.emergencyAlerts ? 1 : 0, now, now).run();
  }
  const contact = await env.DB.prepare("SELECT * FROM trusted_contacts WHERE id = ? AND owner_id = ?").bind(id, userId).first<Record<string, unknown>>();
  return json({ contact: mapContact(contact ?? {}) }, contactId ? 200 : 201);
}

async function createJourney(context: ApiContext): Promise<Response> {
  const body = await readJson(context.request);
  if (!body) return apiError(400, "invalid_json", "A valid journey payload is required.");
  const origin = validCoordinate(body.origin);
  const destination = isRecord(body.destination) ? {
    latitude: Number(body.destination.latitude),
    longitude: Number(body.destination.longitude),
  } : null;
  const destinationValid = destination && Number.isFinite(destination.latitude) && destination.latitude >= -90 && destination.latitude <= 90
    && Number.isFinite(destination.longitude) && destination.longitude >= -180 && destination.longitude <= 180;
  const safetyEta = validIsoDate(body.safetyEta, true);
  const transportType = validTravelType(body.transportType);
  const originName = cleanText(body.originName, 160);
  const destinationName = cleanText(body.destinationName, 160);
  if (!origin || !destinationValid || !safetyEta || !transportType || !originName || !destinationName) {
    return apiError(422, "invalid_journey", "A current device location, confirmed destination, transport type, and future safety ETA are required.");
  }
  const existing = await context.env.DB.prepare("SELECT id FROM journeys WHERE owner_id = ? AND status = 'active'").bind(context.userId).first<{ id: string }>();
  if (existing) return apiError(409, "active_journey_exists", "End the current journey before starting another.");
  const profile = await context.env.DB.prepare("SELECT display_name FROM users WHERE id = ?").bind(context.userId).first<{ display_name: string }>();
  const id = secureId("jrn");
  const now = new Date().toISOString();
  await context.env.DB.prepare(`INSERT INTO journeys (
    id, owner_id, owner_display_name, origin_name, origin_lat, origin_lng, destination_name, destination_lat, destination_lng,
    transport_type, safety_eta, driver_name, vehicle_number, vehicle_description, notes, started_at, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, context.userId, profile?.display_name || "Halovia traveller", originName, origin.latitude, origin.longitude,
      destinationName, destination.latitude, destination.longitude, transportType, safetyEta,
      optionalText(body.driverName, 80), optionalText(body.vehicleNumber, 40), optionalText(body.vehicleDescription, 160), optionalText(body.notes, 500), now, now, now).run();
  const contactIds = Array.isArray(body.contactIds) ? body.contactIds.filter((value): value is string => typeof value === "string").slice(0, 20) : [];
  if (contactIds.length) {
    const owned = await context.env.DB.prepare(`SELECT id FROM trusted_contacts WHERE owner_id = ? AND id IN (${contactIds.map(() => "?").join(",")})`)
      .bind(context.userId, ...contactIds).all<{ id: string }>();
    const statements = (owned.results ?? []).map((contact) => context.env.DB.prepare("INSERT INTO journey_contacts (journey_id, contact_id) VALUES (?, ?)").bind(id, contact.id));
    if (statements.length) await context.env.DB.batch(statements);
  }
  await recordEvent(context.env.DB, id, "journey_started", null, null, now);
  const row = await ownedJourney(context.env.DB, context.userId, id);
  return json({ journey: await journeyDetails(context.env.DB, row as JourneyRow) }, 201);
}

async function submitLocation(context: ApiContext, journey: JourneyRow): Promise<Response> {
  if (journey.status !== "active") return apiError(409, "journey_ended", "This journey is no longer active.");
  if (journey.sharing_status !== "active") return apiError(409, "sharing_inactive", "Location sharing is not active for this journey.");
  const body = await readJson(context.request);
  const coordinate = validCoordinate(body?.coordinate);
  if (!coordinate) return apiError(422, "invalid_coordinate", "The location reading is invalid or too inaccurate.");
  const allowed = await rateLimit(context.env.DB, `${context.userId}:${journey.id}:location`, "location");
  if (!allowed) return apiError(429, "rate_limited", "Location updates are arriving too quickly.");
  const latestRow = await context.env.DB.prepare(`SELECT latitude, longitude, accuracy, heading, speed, device_recorded_at, server_received_at
    FROM journey_locations WHERE journey_id = ? ORDER BY server_received_at DESC LIMIT 1`).bind(journey.id).first<LocationRow>();
  const latest = mapLocation(latestRow);
  const now = new Date().toISOString();
  if (!shouldSubmitLocation(latest, coordinate)) return json({ accepted: false, reason: "insignificant", lastServerUpdateAt: journey.last_server_update_at });
  await context.env.DB.batch([
    context.env.DB.prepare(`INSERT INTO journey_locations (id, journey_id, latitude, longitude, accuracy, heading, speed, device_recorded_at, server_received_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(secureId("loc"), journey.id, coordinate.latitude, coordinate.longitude, coordinate.accuracy, coordinate.heading, coordinate.speed, coordinate.deviceRecordedAt, now),
    context.env.DB.prepare("UPDATE journeys SET last_location_at = ?, last_server_update_at = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND status = 'active' AND sharing_status = 'active'")
      .bind(coordinate.deviceRecordedAt, now, now, journey.id, context.userId),
    context.env.DB.prepare(`DELETE FROM journey_locations WHERE journey_id = ? AND id NOT IN (
      SELECT id FROM journey_locations WHERE journey_id = ? ORDER BY server_received_at DESC LIMIT 500
    )`).bind(journey.id, journey.id),
  ]);
  return json({ accepted: true, lastServerUpdateAt: now });
}

async function updateRoute(context: ApiContext, journey: JourneyRow): Promise<Response> {
  const body = await readJson(context.request);
  const routeEta = validIsoDate(body?.routeEta);
  const distance = Number(body?.remainingDistanceMetres);
  if (!routeEta || !Number.isFinite(distance) || distance < 0 || distance > 20_000_000) return apiError(422, "invalid_route", "Route timing or distance is invalid.");
  const now = new Date().toISOString();
  await context.env.DB.prepare("UPDATE journeys SET route_eta = ?, remaining_distance_metres = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND status = 'active'")
    .bind(routeEta, Math.round(distance), now, journey.id, context.userId).run();
  return json({ routeEta, remainingDistanceMetres: Math.round(distance) });
}

async function createShare(context: ApiContext, journey: JourneyRow): Promise<Response> {
  if (journey.status !== "active") return apiError(409, "journey_ended", "Only an active journey can be shared.");
  const body = await readJson(context.request);
  const lifetimeHours = validShareLifetimeHours(body?.lifetimeHours);
  const token = secureToken();
  const tokenHash = await sha256(token);
  const now = new Date();
  const id = secureId("shr");
  const expiresAt = new Date(now.getTime() + lifetimeHours * 3_600_000).toISOString();
  await context.env.DB.batch([
    context.env.DB.prepare("INSERT INTO viewer_sessions (id, journey_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(id, journey.id, tokenHash, expiresAt, now.toISOString()),
    context.env.DB.prepare("UPDATE journeys SET sharing_status = 'active', updated_at = ? WHERE id = ? AND owner_id = ?")
      .bind(now.toISOString(), journey.id, context.userId),
  ]);
  await recordEvent(context.env.DB, journey.id, "sharing_enabled", { expiresAt }, null, now.toISOString());
  return json({ session: { id, expiresAt, createdAt: now.toISOString(), revokedAt: null, lastViewedAt: null }, token, viewerUrl: new URL(`/viewer/${token}`, context.request.url).toString() }, 201);
}

async function listShares(context: ApiContext, journey: JourneyRow): Promise<Response> {
  const result = await context.env.DB.prepare(`SELECT id, expires_at, revoked_at, last_viewed_at, created_at FROM viewer_sessions
    WHERE journey_id = ? ORDER BY created_at DESC`).bind(journey.id).all<{ id: string; expires_at: string; revoked_at: string | null; last_viewed_at: string | null; created_at: string }>();
  return json({ sessions: (result.results ?? []).map((row) => ({ id: row.id, expiresAt: row.expires_at, revokedAt: row.revoked_at, lastViewedAt: row.last_viewed_at, createdAt: row.created_at })) });
}

async function revokeShare(context: ApiContext, journey: JourneyRow, sessionId?: string): Promise<Response> {
  const now = new Date().toISOString();
  if (sessionId) {
    await context.env.DB.prepare("UPDATE viewer_sessions SET revoked_at = ? WHERE id = ? AND journey_id = ? AND revoked_at IS NULL")
      .bind(now, sessionId, journey.id).run();
  } else {
    await context.env.DB.prepare("UPDATE viewer_sessions SET revoked_at = ? WHERE journey_id = ? AND revoked_at IS NULL")
      .bind(now, journey.id).run();
  }
  const remaining = await context.env.DB.prepare("SELECT id FROM viewer_sessions WHERE journey_id = ? AND revoked_at IS NULL AND expires_at > ? LIMIT 1")
    .bind(journey.id, now).first<{ id: string }>();
  if (!remaining) await context.env.DB.prepare("UPDATE journeys SET sharing_status = 'revoked', updated_at = ? WHERE id = ? AND owner_id = ?").bind(now, journey.id, context.userId).run();
  await recordEvent(context.env.DB, journey.id, "sharing_revoked", null, null, now);
  return new Response(null, { status: 204, headers: PRIVATE_HEADERS });
}

async function safetyAction(context: ApiContext, journey: JourneyRow): Promise<Response> {
  const body = await readJson(context.request);
  const action = body?.action;
  const nowDate = new Date();
  const now = nowDate.toISOString();
  const idempotencyKey = cleanText(context.request.headers.get("idempotency-key") ?? body?.idempotencyKey, 120) || null;
  const current = await context.env.DB.prepare("SELECT * FROM safety_checks WHERE journey_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1")
    .bind(journey.id).first<{ id: string; deadline_at: string; extension_count: number }>();
  if (action === "safe" || action === "help") {
    const recentType = action === "safe" ? "safe_check_in" : "help_requested";
    const recent = await context.env.DB.prepare("SELECT id FROM journey_events WHERE journey_id = ? AND event_type = ? AND created_at >= ? LIMIT 1")
      .bind(journey.id, recentType, new Date(nowDate.getTime() - 5_000).toISOString()).first<{ id: string }>();
    if (recent) {
      const unchanged = await ownedJourney(context.env.DB, context.userId, journey.id);
      return json({ journey: await journeyDetails(context.env.DB, unchanged as JourneyRow) });
    }
  }
  if (action === "start") {
    if (current) return apiError(409, "safety_check_active", "A safety check is already active.");
    const seconds = [30, 45, 60].includes(Number(body?.responseSeconds)) ? Number(body?.responseSeconds) : 45;
    const deadline = new Date(nowDate.getTime() + seconds * 1000).toISOString();
    await context.env.DB.batch([
      context.env.DB.prepare(`INSERT INTO safety_checks (id, journey_id, status, reason, deadline_at, created_at, updated_at)
        VALUES (?, ?, 'pending', ?, ?, ?, ?)`).bind(secureId("chk"), journey.id, cleanText(body?.reason, 80) || "manual", deadline, now, now),
      context.env.DB.prepare("UPDATE journeys SET safety_status = 'check_pending', updated_at = ? WHERE id = ? AND owner_id = ?").bind(now, journey.id, context.userId),
    ]);
    await recordEvent(context.env.DB, journey.id, "safety_check_started", { deadlineAt: deadline }, idempotencyKey, now);
  } else if (action === "safe") {
    if (current) await context.env.DB.prepare("UPDATE safety_checks SET status = 'safe', responded_at = ?, updated_at = ? WHERE id = ?").bind(now, now, current.id).run();
    await context.env.DB.prepare("UPDATE journeys SET safety_status = 'safe', updated_at = ? WHERE id = ? AND owner_id = ?").bind(now, journey.id, context.userId).run();
    await recordEvent(context.env.DB, journey.id, "safe_check_in", null, idempotencyKey, now);
  } else if (action === "help") {
    if (current) await context.env.DB.prepare("UPDATE safety_checks SET status = 'help_requested', responded_at = ?, updated_at = ? WHERE id = ?").bind(now, now, current.id).run();
    await context.env.DB.prepare("UPDATE journeys SET safety_status = 'help_requested', updated_at = ? WHERE id = ? AND owner_id = ?").bind(now, journey.id, context.userId).run();
    await recordEvent(context.env.DB, journey.id, "help_requested", { delivery: "not_connected" }, idempotencyKey, now);
  } else if (action === "extend") {
    if (!current || current.extension_count >= 1) return apiError(409, "extension_unavailable", "This safety check cannot be extended again.");
    const deadlineTime = Math.max(nowDate.getTime(), new Date(current.deadline_at).getTime()) + 120_000;
    const deadline = new Date(deadlineTime).toISOString();
    await context.env.DB.prepare("UPDATE safety_checks SET deadline_at = ?, extension_count = extension_count + 1, updated_at = ? WHERE id = ? AND status = 'pending' AND extension_count = 0")
      .bind(deadline, now, current.id).run();
    await recordEvent(context.env.DB, journey.id, "safety_check_extended", { deadlineAt: deadline }, idempotencyKey, now);
  } else if (action === "expire") {
    if (!current || new Date(current.deadline_at).getTime() > nowDate.getTime()) return apiError(409, "safety_check_not_expired", "The response period has not ended.");
    await context.env.DB.batch([
      context.env.DB.prepare("UPDATE safety_checks SET status = 'expired', responded_at = ?, updated_at = ? WHERE id = ? AND status = 'pending'").bind(now, now, current.id),
      context.env.DB.prepare("UPDATE journeys SET safety_status = 'attention_required', updated_at = ? WHERE id = ? AND owner_id = ?").bind(now, journey.id, context.userId),
    ]);
    await recordEvent(context.env.DB, journey.id, "safety_check_expired", { delivery: "not_connected" }, idempotencyKey, now);
  } else {
    return apiError(422, "invalid_safety_action", "The safety-check action is not supported.");
  }
  const row = await ownedJourney(context.env.DB, context.userId, journey.id);
  return json({ journey: await journeyDetails(context.env.DB, row as JourneyRow) });
}

async function endJourney(context: ApiContext, journey: JourneyRow): Promise<Response> {
  if (journey.status !== "active") return apiError(409, "journey_ended", "The journey has already ended.");
  const body = await readJson(context.request);
  const result = body?.result === "completed" ? "completed" : "ended";
  const now = new Date().toISOString();
  await context.env.DB.batch([
    context.env.DB.prepare("UPDATE journeys SET status = ?, sharing_status = 'completed', completed_at = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND status = 'active'")
      .bind(result, now, now, journey.id, context.userId),
    context.env.DB.prepare("UPDATE viewer_sessions SET revoked_at = ? WHERE journey_id = ? AND revoked_at IS NULL").bind(now, journey.id),
    context.env.DB.prepare("UPDATE safety_checks SET status = 'cancelled', responded_at = ?, updated_at = ? WHERE journey_id = ? AND status = 'pending'").bind(now, now, journey.id),
  ]);
  await recordEvent(context.env.DB, journey.id, result === "completed" ? "arrived_safely" : "journey_ended", null, cleanText(context.request.headers.get("idempotency-key"), 120) || null, now);
  const row = await ownedJourney(context.env.DB, context.userId, journey.id);
  return json({ journey: await journeyDetails(context.env.DB, row as JourneyRow) });
}

async function handleVehicleImage(context: ApiContext, journey: JourneyRow): Promise<Response> {
  if (context.request.method === "GET") {
    if (!journey.vehicle_image_key) return apiError(404, "image_missing", "No vehicle image is stored for this journey.");
    const object = await context.env.VEHICLE_IMAGES.get(journey.vehicle_image_key);
    if (!object) return apiError(404, "image_missing", "The vehicle image could not be found.");
    const headers = new Headers(PRIVATE_HEADERS);
    object.writeHttpMetadata(headers);
    headers.set("Content-Security-Policy", "default-src 'none'; sandbox");
    return new Response(object.body, { headers });
  }
  if (context.request.method === "DELETE") {
    if (journey.vehicle_image_key) await context.env.VEHICLE_IMAGES.delete(journey.vehicle_image_key);
    await context.env.DB.prepare("UPDATE journeys SET vehicle_image_key = NULL, updated_at = ? WHERE id = ? AND owner_id = ?")
      .bind(new Date().toISOString(), journey.id, context.userId).run();
    return new Response(null, { status: 204, headers: PRIVATE_HEADERS });
  }
  const contentType = context.request.headers.get("content-type");
  const imageBytes = await context.request.arrayBuffer();
  const validation = validImageRequest(contentType, String(imageBytes.byteLength));
  if (validation === "type") return apiError(415, "unsupported_image", "Use a JPEG, PNG, or WebP image.");
  if (validation === "size") return apiError(413, "image_too_large", "Vehicle images must be no larger than 8 MB.");
  const key = `users/${context.userId}/journeys/${journey.id}/${secureId("vehicle")}`;
  await context.env.VEHICLE_IMAGES.put(key, imageBytes, {
    httpMetadata: { contentType: contentType ?? "application/octet-stream" },
    customMetadata: { ownerId: context.userId, journeyId: journey.id },
  });
  if (journey.vehicle_image_key) await context.env.VEHICLE_IMAGES.delete(journey.vehicle_image_key);
  await context.env.DB.prepare("UPDATE journeys SET vehicle_image_key = ?, updated_at = ? WHERE id = ? AND owner_id = ?")
    .bind(key, new Date().toISOString(), journey.id, context.userId).run();
  return json({ uploaded: true }, 201);
}

async function handleViewer(request: Request, env: Env, token: string, imageRequest: boolean): Promise<Response> {
  const networkIdentity = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "unknown";
  const viewerRateKey = `viewer:${(await sha256(networkIdentity)).slice(0, 24)}`;
  if (!(await rateLimit(env.DB, viewerRateKey, "mutation"))) return apiError(429, "rate_limited", "Too many viewer requests were made from this network.");
  if (token.length < 32 || token.length > 128) return apiError(404, "viewer_not_found", "This viewer link is invalid.");
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const session = await env.DB.prepare(`SELECT s.id AS session_id, s.expires_at, s.revoked_at, j.* FROM viewer_sessions s
    JOIN journeys j ON j.id = s.journey_id WHERE s.token_hash = ? LIMIT 1`).bind(tokenHash).first<(JourneyRow & { session_id: string; expires_at: string; revoked_at: string | null })>();
  if (!session) return apiError(404, "viewer_not_found", "This viewer link is invalid.");
  if (session.revoked_at) return apiError(410, "viewer_revoked", "The journey owner revoked this viewer link.");
  if (new Date(session.expires_at).getTime() <= Date.now()) return apiError(410, "viewer_expired", "This viewer link has expired.");
  if (session.status !== "active" || session.sharing_status !== "active") return apiError(410, "journey_ended", "This journey is no longer shared.");
  await env.DB.prepare("UPDATE viewer_sessions SET last_viewed_at = ? WHERE id = ?").bind(now, session.session_id).run();
  if (imageRequest) {
    if (!session.vehicle_image_key) return apiError(404, "image_missing", "No vehicle image is shared for this journey.");
    const object = await env.VEHICLE_IMAGES.get(session.vehicle_image_key);
    if (!object) return apiError(404, "image_missing", "The vehicle image could not be found.");
    const headers = new Headers(PRIVATE_HEADERS);
    object.writeHttpMetadata(headers);
    headers.set("Content-Security-Policy", "default-src 'none'; sandbox");
    return new Response(object.body, { headers });
  }
  const journey = await journeyDetails(env.DB, session);
  const viewerJourney: BackendJourney = {
    ...journey,
    id: "shared-journey",
    events: journey.events.map((event, index) => ({ ...event, id: `event-${index + 1}` })),
    safetyCheck: journey.safetyCheck ? { ...journey.safetyCheck, id: "current-safety-check" } : null,
  };
  const payload: ViewerPayload = { journey: viewerJourney, freshness: locationFreshness(journey.lastServerUpdateAt), serverTime: now };
  return json(payload);
}

async function handleFeedback(context: ApiContext): Promise<Response> {
  const body = await readJson(context.request);
  const message = cleanText(body?.message, 2000);
  if (message.length < 10) return apiError(422, "feedback_too_short", "Please provide at least 10 characters.");
  const category = ["feedback", "problem"].includes(String(body?.category)) ? String(body?.category) : "feedback";
  await context.env.DB.prepare("INSERT INTO feedback (id, owner_id, category, message, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(secureId("fbk"), context.userId, category, message, new Date().toISOString()).run();
  return json({ submitted: true }, 201);
}

async function deleteAccount(context: ApiContext): Promise<Response> {
  const images = await context.env.DB.prepare("SELECT vehicle_image_key FROM journeys WHERE owner_id = ? AND vehicle_image_key IS NOT NULL")
    .bind(context.userId).all<{ vehicle_image_key: string }>();
  await Promise.all((images.results ?? []).map((row) => context.env.VEHICLE_IMAGES.delete(row.vehicle_image_key)));
  await context.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(context.userId).run();
  return new Response(null, { status: 204, headers: PRIVATE_HEADERS });
}

async function handleOwnerApi(context: ApiContext, path: string): Promise<Response> {
  const { request, env, userId } = context;
  if (!assertSameOrigin(request)) return apiError(403, "origin_rejected", "The request origin could not be verified.");
  if (!["GET", "HEAD"].includes(request.method)) {
    const allowed = await rateLimit(env.DB, `${userId}:mutation`, "mutation");
    if (!allowed) return apiError(429, "rate_limited", "Too many changes were requested. Please wait and try again.");
  }
  if (path === "/api/session" && request.method === "GET") return json({ authenticated: true, email: context.email });
  if (path === "/api/state" && request.method === "GET") return handleState(context);
  if (path === "/api/profile" && request.method === "PUT") return handleProfile(context);
  if (path === "/api/account" && request.method === "DELETE") return deleteAccount(context);
  if (path === "/api/feedback" && request.method === "POST") return handleFeedback(context);
  if (path === "/api/maps/search" && request.method === "GET") {
    const allowed = await rateLimit(env.DB, `${userId}:map-search`, "mutation");
    if (!allowed) return apiError(429, "rate_limited", "Too many destination searches were requested. Please wait and try again.");
    const requestUrl = new URL(request.url);
    const query = cleanText(requestUrl.searchParams.get("q"), 100);
    if (!query || query.length < 3) return apiError(400, "invalid_search", "Enter at least three characters to search.");
    const upstreamUrl = new URL("https://photon.komoot.io/api/");
    upstreamUrl.searchParams.set("q", query);
    upstreamUrl.searchParams.set("limit", "5");
    const latitude = Number(requestUrl.searchParams.get("lat"));
    const longitude = Number(requestUrl.searchParams.get("lon"));
    if (Number.isFinite(latitude) && latitude >= -90 && latitude <= 90 && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180) {
      upstreamUrl.searchParams.set("lat", String(latitude));
      upstreamUrl.searchParams.set("lon", String(longitude));
    }
    const upstream = await fetch(upstreamUrl, { headers: { Accept: "application/json", "User-Agent": "Halovia-MVP/0.1" } });
    if (!upstream.ok) return apiError(503, "map_search_unavailable", "Destination search is temporarily unavailable.");
    const result = await upstream.json() as unknown;
    return json(result);
  }
  if (path === "/api/contacts" && ["GET", "POST"].includes(request.method)) return handleContacts(context);
  const contactMatch = path.match(/^\/api\/contacts\/([^/]+)$/u);
  if (contactMatch && ["PUT", "DELETE"].includes(request.method)) return handleContacts(context, contactMatch[1]);
  if (path === "/api/journeys" && request.method === "POST") return createJourney(context);
  const journeyMatch = path.match(/^\/api\/journeys\/([^/]+)(?:\/(.*))?$/u);
  if (!journeyMatch) return apiError(404, "not_found", "The requested API route does not exist.");
  const journey = await ownedJourney(env.DB, userId, journeyMatch[1]);
  if (!journey) return apiError(404, "journey_not_found", "The journey was not found.");
  const action = journeyMatch[2] ?? "";
  if (!action && request.method === "GET") return json({ journey: await journeyDetails(env.DB, journey) });
  if (action === "location" && request.method === "POST") return submitLocation(context, journey);
  if (action === "route" && request.method === "PUT") return updateRoute(context, journey);
  if (action === "shares" && request.method === "GET") return listShares(context, journey);
  if (action === "shares" && request.method === "POST") return createShare(context, journey);
  if (action === "shares" && request.method === "DELETE") return revokeShare(context, journey);
  const shareMatch = action.match(/^shares\/([^/]+)$/u);
  if (shareMatch && request.method === "DELETE") return revokeShare(context, journey, shareMatch[1]);
  if (action === "safety" && request.method === "POST") return safetyAction(context, journey);
  if (action === "end" && request.method === "POST") return endJourney(context, journey);
  if (action === "vehicle-image" && ["GET", "PUT", "DELETE"].includes(request.method)) return handleVehicleImage(context, journey);
  return apiError(404, "not_found", "The requested journey action does not exist.");
}

export async function handleApi(request: Request, env: Env): Promise<Response> {
  const path = new URL(request.url).pathname;
  try {
    await ensureSchema(env.DB);
    const viewerMatch = path.match(/^\/api\/view\/([^/]+)(?:\/(vehicle-image))?$/u);
    if (viewerMatch && request.method === "GET") return handleViewer(request, env, viewerMatch[1], Boolean(viewerMatch[2]));
    const email = authenticatedEmail(request, env.HALOVIA_LOCAL_USER_EMAIL);
    if (!email) return apiError(401, "authentication_required", "Sign in to manage Halovia journeys.");
    const userId = await ensureUser(env.DB, email);
    return await handleOwnerApi({ request, env, userId, email }, path);
  } catch (error) {
    console.error("[Halovia API] request failed", { path, errorName: error instanceof Error ? error.name : "UnknownError" });
    return apiError(503, "service_unavailable", "Something went wrong. Please try again.");
  }
}

export async function runRetentionCleanup(env: Env, now = new Date()): Promise<void> {
  await ensureSchema(env.DB);
  const result = await env.DB.prepare(`SELECT j.id, j.vehicle_image_key FROM journeys j
    JOIN users u ON u.id = j.owner_id
    WHERE j.status != 'active' AND j.completed_at IS NOT NULL
      AND datetime(j.completed_at) < datetime(?, '-' || u.retention_days || ' days')
    LIMIT 250`).bind(now.toISOString()).all<{ id: string; vehicle_image_key: string | null }>();
  const expired = result.results ?? [];
  await Promise.all(expired.flatMap((journey) => journey.vehicle_image_key ? [env.VEHICLE_IMAGES.delete(journey.vehicle_image_key)] : []));
  if (expired.length) await env.DB.batch(expired.map((journey) => env.DB.prepare("DELETE FROM journeys WHERE id = ? AND status != 'active'").bind(journey.id)));
  await env.DB.prepare("DELETE FROM rate_limits WHERE datetime(window_started_at) < datetime(?, '-1 day')").bind(now.toISOString()).run();
}
