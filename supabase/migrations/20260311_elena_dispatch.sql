-- Elena Dispatch System: Event Logging, SLA Tracking, Driver Scorecards
-- Run in Supabase SQL Editor

-- 1. Dispatch Events Log (immutable audit trail)
CREATE TABLE IF NOT EXISTS dispatch_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL,
  trip_id TEXT,
  event_type TEXT NOT NULL,
  -- Event types: ASSIGNMENT, CONFIRMATION, REMINDER_SENT, SLA_WARNING,
  -- SLA_BREACH, REASSIGNMENT, ESCALATION, EN_ROUTE, ARRIVED, COMPLETED,
  -- NO_SHOW, CANCELLATION, VOICE_CALL, SMS_SENT
  driver_name TEXT,
  driver_phone TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dispatch_events_ride ON dispatch_events(ride_id);
CREATE INDEX idx_dispatch_events_type ON dispatch_events(event_type);
CREATE INDEX idx_dispatch_events_driver ON dispatch_events(driver_phone);
CREATE INDEX idx_dispatch_events_created ON dispatch_events(created_at DESC);

-- 2. Driver Scorecards (rolling performance metrics)
CREATE TABLE IF NOT EXISTS driver_scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_phone TEXT NOT NULL UNIQUE,
  driver_name TEXT NOT NULL,
  -- Lifetime metrics
  total_assignments INTEGER DEFAULT 0,
  total_confirmations INTEGER DEFAULT 0,
  total_on_time INTEGER DEFAULT 0,
  total_late INTEGER DEFAULT 0,
  total_no_response INTEGER DEFAULT 0,
  total_reassignments INTEGER DEFAULT 0,
  total_completed INTEGER DEFAULT 0,
  total_no_show INTEGER DEFAULT 0,
  -- Calculated rates (updated by scorecard API)
  confirmation_rate NUMERIC(5,2) DEFAULT 0,
  on_time_rate NUMERIC(5,2) DEFAULT 0,
  late_rate NUMERIC(5,2) DEFAULT 0,
  no_response_rate NUMERIC(5,2) DEFAULT 0,
  reassignment_rate NUMERIC(5,2) DEFAULT 0,
  avg_confirmation_minutes NUMERIC(8,2) DEFAULT 0,
  avg_late_minutes NUMERIC(8,2) DEFAULT 0,
  -- Rolling windows (JSONB for 7/30/90 day breakdowns)
  rolling_7d JSONB DEFAULT '{}',
  rolling_30d JSONB DEFAULT '{}',
  rolling_90d JSONB DEFAULT '{}',
  -- Meta
  last_assignment_at TIMESTAMPTZ,
  last_completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scorecards_phone ON driver_scorecards(driver_phone);

-- 3. Add reminder tracking fields to rides table
DO $$ BEGIN
  ALTER TABLE rides ADD COLUMN IF NOT EXISTS reminder_evening_sent BOOLEAN DEFAULT FALSE;
  ALTER TABLE rides ADD COLUMN IF NOT EXISTS reminder_1hr_sent BOOLEAN DEFAULT FALSE;
  ALTER TABLE rides ADD COLUMN IF NOT EXISTS reminder_30min_sent BOOLEAN DEFAULT FALSE;
  ALTER TABLE rides ADD COLUMN IF NOT EXISTS sla_deadline_at TIMESTAMPTZ;
  ALTER TABLE rides ADD COLUMN IF NOT EXISTS sla_status TEXT DEFAULT 'ok';
  -- sla_status values: ok, warning, breached, resolved
  ALTER TABLE rides ADD COLUMN IF NOT EXISTS escalated BOOLEAN DEFAULT FALSE;
  ALTER TABLE rides ADD COLUMN IF NOT EXISTS assignment_count INTEGER DEFAULT 1;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 4. RLS Policies
ALTER TABLE dispatch_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_scorecards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service role" ON dispatch_events
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for service role" ON driver_scorecards
  FOR ALL USING (true) WITH CHECK (true);

-- 5. Seed scorecards for existing drivers
INSERT INTO driver_scorecards (driver_phone, driver_name)
VALUES
  ('+13136000351', 'Daquan Shield'),
  ('+12489403262', 'Driver 2')
ON CONFLICT (driver_phone) DO NOTHING;
