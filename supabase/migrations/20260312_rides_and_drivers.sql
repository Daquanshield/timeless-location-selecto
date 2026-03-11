-- Rides table: Core dispatch records linking bookings to driver assignments
-- Run in Supabase SQL Editor

-- 1. Drivers table (small lookup table for available drivers)
CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT,
  contact_id TEXT,  -- GHL contact ID
  zone TEXT DEFAULT 'all',  -- preferred zone: downtown, airport, suburbs, all
  vehicle_class TEXT DEFAULT 'EXECUTIVE_SUV',
  status TEXT DEFAULT 'active',  -- active, inactive, suspended
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drivers_phone ON drivers(phone);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);

-- Seed existing drivers
INSERT INTO drivers (first_name, last_name, phone, zone, status)
VALUES
  ('Daquan', 'Shield', '+13136000351', 'all', 'active'),
  ('Driver', '2', '+12489403262', 'suburbs', 'active')
ON CONFLICT (phone) DO NOTHING;

-- 2. Rides table (dispatch records)
CREATE TABLE IF NOT EXISTS rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Link to booking
  location_selection_id UUID REFERENCES location_selections(id),
  trip_id TEXT NOT NULL,  -- human-readable: TRP-YYYY-NNNNN

  -- Status tracking
  status TEXT DEFAULT 'pending',
  -- Values: pending, confirmed, en_route, arrived, completed, cancelled, no_show
  confirmation_status TEXT DEFAULT 'unconfirmed',
  -- Values: unconfirmed, confirmed, declined
  confirmation_timestamp TIMESTAMPTZ,

  -- Driver info
  driver_name TEXT,
  driver_phone TEXT,
  driver_contact_id TEXT,
  driver_email TEXT,

  -- Client info
  client_name TEXT,
  client_phone TEXT,
  client_contact_id TEXT,

  -- Trip details
  pickup_datetime TIMESTAMPTZ NOT NULL,
  pickup_address TEXT,
  dropoff_address TEXT,
  pickup_zone TEXT,
  dropoff_zone TEXT,
  vehicle_type TEXT DEFAULT 'EXECUTIVE_SUV',
  service_type TEXT,
  flight_number TEXT,
  special_instructions TEXT,
  number_of_passengers INTEGER DEFAULT 1,

  -- Pricing
  total_amount NUMERIC(10,2),
  payment_status TEXT DEFAULT 'pending',

  -- VIP tracking
  is_vip BOOLEAN DEFAULT FALSE,

  -- Reminder flags (added by elena_dispatch migration)
  reminder_evening_sent BOOLEAN DEFAULT FALSE,
  reminder_1hr_sent BOOLEAN DEFAULT FALSE,
  reminder_30min_sent BOOLEAN DEFAULT FALSE,

  -- SLA tracking
  sla_deadline_at TIMESTAMPTZ,
  sla_status TEXT DEFAULT 'ok',
  escalated BOOLEAN DEFAULT FALSE,
  assignment_count INTEGER DEFAULT 1,
  assignment_history JSONB DEFAULT '[]',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rides_trip_id ON rides(trip_id);
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_driver_phone ON rides(driver_phone);
CREATE INDEX IF NOT EXISTS idx_rides_pickup ON rides(pickup_datetime);
CREATE INDEX IF NOT EXISTS idx_rides_client_phone ON rides(client_phone);
CREATE INDEX IF NOT EXISTS idx_rides_location_selection ON rides(location_selection_id);

-- RLS
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for service role" ON rides
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for service role" ON drivers
  FOR ALL USING (true) WITH CHECK (true);

-- 3. Trip ID sequence for human-readable IDs
CREATE SEQUENCE IF NOT EXISTS trip_id_seq START WITH 10001;

-- 4. Function to generate trip IDs
CREATE OR REPLACE FUNCTION generate_trip_id()
RETURNS TEXT AS $$
BEGIN
  RETURN 'TRP-' || EXTRACT(YEAR FROM NOW()) || '-' || LPAD(nextval('trip_id_seq')::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;
