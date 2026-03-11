-- Add flight_number column to location_selections table
ALTER TABLE location_selections ADD COLUMN IF NOT EXISTS flight_number TEXT;

-- Add driver info columns to tracked_flights for notification purposes
ALTER TABLE tracked_flights ADD COLUMN IF NOT EXISTS driver_phone TEXT;
ALTER TABLE tracked_flights ADD COLUMN IF NOT EXISTS driver_name TEXT;
ALTER TABLE tracked_flights ADD COLUMN IF NOT EXISTS driver_contact_id TEXT;
