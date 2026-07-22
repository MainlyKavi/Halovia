PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL DEFAULT '',
  language TEXT NOT NULL DEFAULT 'en',
  locale TEXT NOT NULL DEFAULT 'en-IN',
  country TEXT NOT NULL DEFAULT 'IN',
  date_format TEXT NOT NULL DEFAULT 'locale',
  emergency_number TEXT NOT NULL DEFAULT '112',
  retention_days INTEGER NOT NULL DEFAULT 30 CHECK (retention_days IN (7, 30)),
  onboarding_complete INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE trusted_contacts (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  relationship TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  default_for_journeys INTEGER NOT NULL DEFAULT 0,
  emergency_alerts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX trusted_contacts_owner_idx ON trusted_contacts(owner_id);

CREATE TABLE journeys (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_display_name TEXT NOT NULL,
  origin_name TEXT NOT NULL,
  origin_lat REAL NOT NULL,
  origin_lng REAL NOT NULL,
  destination_name TEXT NOT NULL,
  destination_lat REAL NOT NULL,
  destination_lng REAL NOT NULL,
  transport_type TEXT NOT NULL,
  safety_eta TEXT NOT NULL,
  route_eta TEXT,
  remaining_distance_metres INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  safety_status TEXT NOT NULL DEFAULT 'safe',
  sharing_status TEXT NOT NULL DEFAULT 'disabled',
  driver_name TEXT,
  vehicle_number TEXT,
  vehicle_description TEXT,
  vehicle_image_key TEXT,
  notes TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  last_location_at TEXT,
  last_server_update_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (status IN ('active', 'completed', 'ended')),
  CHECK (safety_status IN ('safe', 'check_pending', 'attention_required', 'help_requested')),
  CHECK (sharing_status IN ('disabled', 'active', 'revoked', 'completed'))
);
CREATE UNIQUE INDEX one_active_journey_per_owner_idx ON journeys(owner_id) WHERE status = 'active';
CREATE INDEX journeys_owner_updated_idx ON journeys(owner_id, updated_at DESC);

CREATE TABLE journey_contacts (
  journey_id TEXT NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES trusted_contacts(id) ON DELETE CASCADE,
  PRIMARY KEY (journey_id, contact_id)
);

CREATE TABLE journey_locations (
  id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  accuracy REAL NOT NULL,
  heading REAL,
  speed REAL,
  device_recorded_at TEXT NOT NULL,
  server_received_at TEXT NOT NULL
);
CREATE INDEX journey_locations_latest_idx ON journey_locations(journey_id, server_received_at DESC);

CREATE TABLE journey_events (
  id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  detail_json TEXT,
  idempotency_key TEXT,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX journey_events_idempotency_idx ON journey_events(journey_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX journey_events_timeline_idx ON journey_events(journey_id, created_at DESC);

CREATE TABLE safety_checks (
  id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  reason TEXT NOT NULL,
  deadline_at TEXT NOT NULL,
  extension_count INTEGER NOT NULL DEFAULT 0,
  responded_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (status IN ('pending', 'safe', 'help_requested', 'expired', 'cancelled'))
);
CREATE UNIQUE INDEX one_pending_safety_check_idx ON safety_checks(journey_id) WHERE status = 'pending';

CREATE TABLE viewer_sessions (
  id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  last_viewed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX viewer_sessions_journey_idx ON viewer_sessions(journey_id, created_at DESC);

CREATE TABLE feedback (
  id TEXT PRIMARY KEY,
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  window_started_at TEXT NOT NULL,
  request_count INTEGER NOT NULL
);
