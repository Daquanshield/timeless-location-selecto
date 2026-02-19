-- ============================================================
-- SOFIA v4.0 Schema Migration
-- Run in Supabase SQL Editor
-- All columns are nullable — existing rows are unaffected
-- ============================================================

-- SOFIA v4 vehicle class (replaces vehicle_type)
ALTER TABLE location_selections ADD COLUMN IF NOT EXISTS vehicle_class TEXT;

-- SOFIA v4 service type (replaces ride_type)
ALTER TABLE location_selections ADD COLUMN IF NOT EXISTS service_type TEXT;

-- Price in cents for precision (e.g., $125 = 12500)
ALTER TABLE location_selections ADD COLUMN IF NOT EXISTS fare_cents INTEGER;

-- Estimated hours (for HOURLY and DAY_RATE service types)
ALTER TABLE location_selections ADD COLUMN IF NOT EXISTS estimated_hours DECIMAL(4,1);

-- Wait time tier for LONG_DISTANCE trips
ALTER TABLE location_selections ADD COLUMN IF NOT EXISTS wait_time_tier TEXT;

-- Day rate duration ('8hr' or '12hr')
ALTER TABLE location_selections ADD COLUMN IF NOT EXISTS day_rate_duration TEXT;

-- Long distance destination city
ALTER TABLE location_selections ADD COLUMN IF NOT EXISTS long_distance_destination TEXT;

-- Trip direction for long distance ('one_way' or 'round_trip')
ALTER TABLE location_selections ADD COLUMN IF NOT EXISTS trip_direction TEXT;

-- Estimated dropoff time (for buffer calculations in V1.1)
ALTER TABLE location_selections ADD COLUMN IF NOT EXISTS estimated_dropoff_time TIMESTAMPTZ;

-- Passenger count (moved from implicit to explicit column if not already present)
ALTER TABLE location_selections ADD COLUMN IF NOT EXISTS passenger_count INTEGER;

-- GHL appointment ID (for updating status after payment)
ALTER TABLE location_selections ADD COLUMN IF NOT EXISTS ghl_appointment_id TEXT;

-- ============================================================
-- Optional: Add CHECK constraints for data integrity
-- ============================================================

-- Validate vehicle_class values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_vehicle_class'
  ) THEN
    ALTER TABLE location_selections
    ADD CONSTRAINT chk_vehicle_class
    CHECK (vehicle_class IS NULL OR vehicle_class IN ('EXECUTIVE_SUV', 'PREMIER_SUV'));
  END IF;
END $$;

-- Validate service_type values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_service_type'
  ) THEN
    ALTER TABLE location_selections
    ADD CONSTRAINT chk_service_type
    CHECK (service_type IS NULL OR service_type IN ('AIRPORT', 'HOURLY', 'DAY_RATE', 'LONG_DISTANCE', 'MULTI_STOP'));
  END IF;
END $$;

-- Validate wait_time_tier values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_wait_time_tier'
  ) THEN
    ALTER TABLE location_selections
    ADD CONSTRAINT chk_wait_time_tier
    CHECK (wait_time_tier IS NULL OR wait_time_tier IN ('SHORT', 'DINNER', 'EXTENDED', 'ALL_DAY'));
  END IF;
END $$;

-- Validate day_rate_duration values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_day_rate_duration'
  ) THEN
    ALTER TABLE location_selections
    ADD CONSTRAINT chk_day_rate_duration
    CHECK (day_rate_duration IS NULL OR day_rate_duration IN ('8hr', '12hr'));
  END IF;
END $$;

-- Validate trip_direction values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_trip_direction'
  ) THEN
    ALTER TABLE location_selections
    ADD CONSTRAINT chk_trip_direction
    CHECK (trip_direction IS NULL OR trip_direction IN ('one_way', 'round_trip'));
  END IF;
END $$;
