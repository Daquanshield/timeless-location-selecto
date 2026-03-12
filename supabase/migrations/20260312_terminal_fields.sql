-- Add terminal/airline fields to location_selections for DTW airport bookings
ALTER TABLE location_selections
  ADD COLUMN IF NOT EXISTS departure_airline TEXT,
  ADD COLUMN IF NOT EXISTS airport_direction TEXT,
  ADD COLUMN IF NOT EXISTS terminal TEXT;

-- Add terminal/flight fields to rides table for driver dispatch
ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS departure_airline TEXT,
  ADD COLUMN IF NOT EXISTS airport_direction TEXT,
  ADD COLUMN IF NOT EXISTS terminal TEXT;

-- Add client reminder tracking columns to rides table
ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS client_reminder_daybefore_sent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS client_reminder_2hr_sent BOOLEAN DEFAULT FALSE;
