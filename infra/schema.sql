CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nid_hash TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending_verification',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  fingerprint_hash TEXT NOT NULL,
  trust_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_device_id ON user_devices(device_id);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  risk_score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id_expires_at ON sessions(user_id, expires_at);

CREATE TABLE IF NOT EXISTS otp_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  nid_hash TEXT NOT NULL,
  phone TEXT NOT NULL,
  device_id TEXT NOT NULL,
  fingerprint_hash TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  train_id TEXT NOT NULL,
  route_code TEXT NOT NULL,
  journey_date DATE NOT NULL,
  seat_class TEXT NOT NULL,
  total_seats INTEGER NOT NULL,
  available_seats INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_journeys_route_date_class
  ON journeys(train_id, journey_date, seat_class);

CREATE TABLE IF NOT EXISTS queue_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  journey_id UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  queue_bucket INTEGER NOT NULL,
  risk_score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'waiting',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queue_tokens_journey_status
  ON queue_tokens(journey_id, status, created_at);

ALTER TABLE queue_tokens ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE queue_tokens ADD COLUMN IF NOT EXISTS device_trust_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE queue_tokens ADD COLUMN IF NOT EXISTS priority_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE queue_tokens ADD COLUMN IF NOT EXISTS telemetry_snapshot_id UUID;
ALTER TABLE queue_tokens ADD COLUMN IF NOT EXISTS reservation_expires_at TIMESTAMPTZ;
ALTER TABLE queue_tokens ADD COLUMN IF NOT EXISTS eligibility_reason TEXT;

CREATE TABLE IF NOT EXISTS seat_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  journey_id UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  hold_reference TEXT NOT NULL UNIQUE,
  seat_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'held',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seat_holds_journey_status
  ON seat_holds(journey_id, status, expires_at);

ALTER TABLE seat_holds ADD COLUMN IF NOT EXISTS queue_token TEXT;

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  journey_id UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  hold_id UUID REFERENCES seat_holds(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending_payment',
  risk_score INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_user_id_created_at ON bookings(user_id, created_at);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_reference TEXT;

CREATE TABLE IF NOT EXISTS risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_id UUID,
  score INTEGER NOT NULL,
  band TEXT NOT NULL,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  nid_hash TEXT NOT NULL,
  weekly_limit INTEGER NOT NULL DEFAULT 4,
  monthly_limit INTEGER NOT NULL DEFAULT 12,
  weekly_booked_count INTEGER NOT NULL DEFAULT 0,
  monthly_booked_count INTEGER NOT NULL DEFAULT 0,
  cooldown_until TIMESTAMPTZ,
  last_booking_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_limits_nid_hash ON booking_limits(nid_hash);

CREATE TABLE IF NOT EXISTS telemetry_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  device_id TEXT NOT NULL,
  journey_id UUID REFERENCES journeys(id) ON DELETE SET NULL,
  mouse_movements INTEGER NOT NULL DEFAULT 0,
  click_count INTEGER NOT NULL DEFAULT 0,
  typing_speed_cpm INTEGER NOT NULL DEFAULT 0,
  focus_switch_count INTEGER NOT NULL DEFAULT 0,
  paste_count INTEGER NOT NULL DEFAULT 0,
  hesitation_score INTEGER NOT NULL DEFAULT 0,
  form_fill_ms INTEGER NOT NULL DEFAULT 0,
  page_dwell_ms INTEGER NOT NULL DEFAULT 0,
  risk_hint INTEGER NOT NULL DEFAULT 0,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_snapshots_device_created_at
  ON telemetry_snapshots(device_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'queue_tokens_telemetry_snapshot_id_fkey'
  ) THEN
    ALTER TABLE queue_tokens
    ADD CONSTRAINT queue_tokens_telemetry_snapshot_id_fkey
    FOREIGN KEY (telemetry_snapshot_id) REFERENCES telemetry_snapshots(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS payment_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  hold_id UUID REFERENCES seat_holds(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  payment_reference TEXT NOT NULL UNIQUE,
  authorization_reference TEXT,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BDT',
  status TEXT NOT NULL DEFAULT 'initiated',
  callback_signature TEXT,
  provider_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_cancellations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  cancelled_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  refund_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS seat_redistributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  journey_id UUID NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  released_seat_count INTEGER NOT NULL,
  queue_token TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seat_redistributions_journey_status
  ON seat_redistributions(journey_id, status, created_at);

CREATE TABLE IF NOT EXISTS queue_cooldowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT,
  journey_id UUID REFERENCES journeys(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_queue_cooldowns_user_journey
  ON queue_cooldowns(user_id, journey_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'started',
  response_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (scope, idempotency_key)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  outcome TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
