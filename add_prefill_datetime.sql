-- Add prefill_datetime column to location_selections table
-- This stores the customer's requested ride date/time from Sofia AI
ALTER TABLE location_selections
ADD COLUMN IF NOT EXISTS prefill_datetime TEXT;

-- Verify
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'location_selections'
AND column_name = 'prefill_datetime';
