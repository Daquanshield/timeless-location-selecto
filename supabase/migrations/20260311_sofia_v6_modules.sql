-- ============================================================
-- SOFIA v6.0 Database Schema Migration
-- Modules: Invoicing, Flight Tracking, Local Concierge, Personal EA
-- ============================================================

-- 1. INVOICES TABLE
-- Sequential numbering: TR-YYYY-NNNN
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  ride_id UUID REFERENCES location_selections(id),
  contact_id TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT NOT NULL,
  service_type TEXT NOT NULL CHECK (service_type IN ('AIRPORT','HOURLY','DAY_RATE','LONG_DISTANCE','MULTI_STOP')),
  vehicle_class TEXT NOT NULL CHECK (vehicle_class IN ('EXECUTIVE_SUV','PREMIER_SUV')),
  pickup_address TEXT NOT NULL,
  dropoff_address TEXT NOT NULL,
  trip_date TIMESTAMPTZ NOT NULL,
  fare_cents INTEGER NOT NULL DEFAULT 0,
  gratuity_cents INTEGER NOT NULL DEFAULT 0,
  extras_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  price_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','overdue','cancelled')),
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sequence for invoice numbering within each year
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 1;

-- Function to generate invoice number TR-YYYY-NNNN
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
  current_year TEXT;
  next_num INTEGER;
BEGIN
  current_year := to_char(now(), 'YYYY');
  next_num := nextval('invoice_number_seq');
  NEW.invoice_number := 'TR-' || current_year || '-' || lpad(next_num::text, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_invoice_number
  BEFORE INSERT ON invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL OR NEW.invoice_number = '')
  EXECUTE FUNCTION generate_invoice_number();

CREATE INDEX idx_invoices_contact ON invoices(contact_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_trip_date ON invoices(trip_date DESC);

-- 2. TRACKED FLIGHTS TABLE
CREATE TABLE IF NOT EXISTS tracked_flights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  ride_id UUID REFERENCES location_selections(id),
  flight_number TEXT NOT NULL,
  airline TEXT NOT NULL,
  departure_airport TEXT NOT NULL,
  arrival_airport TEXT NOT NULL,
  scheduled_departure TIMESTAMPTZ NOT NULL,
  scheduled_arrival TIMESTAMPTZ NOT NULL,
  actual_departure TIMESTAMPTZ,
  actual_arrival TIMESTAMPTZ,
  terminal TEXT,
  gate TEXT,
  baggage_claim TEXT,
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','tracking','landed','cancelled','completed')),
  dtw_pickup_instructions TEXT,
  weather_conditions TEXT,
  last_polled_at TIMESTAMPTZ,
  polling_started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_flights_contact ON tracked_flights(contact_id);
CREATE INDEX idx_flights_status ON tracked_flights(status);
CREATE INDEX idx_flights_arrival ON tracked_flights(scheduled_arrival);
CREATE INDEX idx_flights_polling ON tracked_flights(status, scheduled_arrival)
  WHERE status IN ('scheduled', 'tracking');

-- 3. VENUES TABLE (Local Concierge)
CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'fine_dining','upscale_casual','steakhouse','cocktail_bar',
    'rooftop','live_music','theater','sports','spa','hotel'
  )),
  price_level TEXT NOT NULL DEFAULT '$$$$' CHECK (price_level IN ('$$$','$$$$')),
  address TEXT NOT NULL,
  lat DECIMAL(9,6) NOT NULL,
  lng DECIMAL(9,6) NOT NULL,
  zone TEXT NOT NULL CHECK (zone IN ('DOWNTOWN','WEST','NORTH','EAST','NORTHEAST','AIRPORT','OUT_OF_AREA')),
  phone TEXT,
  website TEXT,
  description TEXT NOT NULL,
  dress_code TEXT,
  reservation_required BOOLEAN NOT NULL DEFAULT false,
  best_for TEXT[] NOT NULL DEFAULT '{}',
  hours TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_venues_category ON venues(category) WHERE active = true;
CREATE INDEX idx_venues_zone ON venues(zone) WHERE active = true;

-- Seed initial curated Detroit venues
INSERT INTO venues (name, category, price_level, address, lat, lng, zone, phone, website, description, dress_code, reservation_required, best_for, hours) VALUES
('The Apparatus Room', 'fine_dining', '$$$$', '250 W Larned St, Detroit, MI 48226', 42.3280, -83.0490, 'DOWNTOWN', '(313) 800-5500', 'https://apparatusroom.com', 'Upscale American cuisine in the historic Detroit Foundation Hotel. Stunning architectural details with seasonal menus.', 'Smart casual to formal', true, ARRAY['date night', 'business dinner', 'celebration'], 'Mon-Sun 7AM-10PM'),
('Parc', 'fine_dining', '$$$$', '800 Woodward Ave, Detroit, MI 48226', 42.3332, -83.0475, 'DOWNTOWN', '(313) 922-7272', 'https://parcdetroit.com', 'Contemporary French-American dining with elegant ambiance in the heart of downtown Detroit.', 'Business casual to formal', true, ARRAY['date night', 'business dinner', 'special occasion'], 'Tue-Sat 5PM-10PM'),
('Prime + Proper', 'steakhouse', '$$$$', '1145 Griswold St, Detroit, MI 48226', 42.3305, -83.0505, 'DOWNTOWN', '(313) 636-3100', 'https://primeandproper.com', 'Premier steakhouse with sophisticated cocktails and an impressive wine list. Multi-level dining experience.', 'Cocktail attire', true, ARRAY['business dinner', 'celebration', 'date night'], 'Mon-Sat 5PM-11PM'),
('Townhouse Detroit', 'upscale_casual', '$$$', '500 Woodward Ave, Detroit, MI 48226', 42.3310, -83.0470, 'DOWNTOWN', '(313) 723-1000', 'https://townhousedetroit.com', 'Modern American bistro with creative cocktails and a lively atmosphere.', 'Smart casual', false, ARRAY['happy hour', 'group dinner', 'date night'], 'Mon-Sun 11AM-11PM'),
('The Sugar House', 'cocktail_bar', '$$$', '2130 Michigan Ave, Detroit, MI 48216', 42.3280, -83.0720, 'DOWNTOWN', '(313) 962-0123', NULL, 'Speakeasy-style cocktail bar with craft drinks and intimate ambiance. A Detroit institution.', 'Casual to smart casual', false, ARRAY['drinks', 'date night', 'nightlife'], 'Mon-Sat 5PM-2AM'),
('Highlands', 'rooftop', '$$$', '400 Renaissance Center, Detroit, MI 48243', 42.3292, -83.0397, 'DOWNTOWN', '(313) 568-8600', NULL, 'Rooftop bar in the Renaissance Center with panoramic views of the Detroit River and Windsor skyline.', 'Smart casual', false, ARRAY['drinks', 'sunset', 'group outing'], 'Thu-Sun 4PM-12AM'),
('The Roostertail', 'live_music', '$$$', '100 Marquette Dr, Detroit, MI 48214', 42.3360, -83.0170, 'EAST', '(313) 822-1234', 'https://roostertail.com', 'Iconic Detroit waterfront venue with live entertainment, dancing, and river views since 1958.', 'Smart casual', true, ARRAY['live music', 'dancing', 'celebration'], 'Event schedule varies'),
('Birmingham Athletic Club', 'upscale_casual', '$$$$', '350 S Old Woodward Ave, Birmingham, MI 48009', 42.5440, -83.2130, 'NORTH', '(248) 530-1555', NULL, 'Members club with exceptional dining and wellness. Private dining experiences available.', 'Business casual', true, ARRAY['business dinner', 'private dining'], 'Mon-Sun 6AM-10PM'),
('The Townsend Hotel', 'hotel', '$$$$', '100 Townsend St, Birmingham, MI 48009', 42.5467, -83.2115, 'NORTH', '(248) 642-7900', 'https://townsendhotel.com', 'Luxury boutique hotel with acclaimed Rugby Grille restaurant. A metro Detroit landmark.', 'Business casual to formal', true, ARRAY['hotel stay', 'business dinner', 'afternoon tea'], 'Open 24/7'),
('Iridescence', 'fine_dining', '$$$$', '2901 Grand River Ave, Detroit, MI 48201', 42.3365, -83.0620, 'DOWNTOWN', '(313) 596-7979', NULL, 'Award-winning fine dining atop the MotorCity Casino Hotel with stunning city views.', 'Formal', true, ARRAY['special occasion', 'celebration', 'date night'], 'Wed-Sun 5PM-10PM');

-- 4. CLIENT PROFILES TABLE (Personal EA)
CREATE TABLE IF NOT EXISTS client_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id TEXT UNIQUE NOT NULL,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_email TEXT,
  vip_tier TEXT NOT NULL DEFAULT 'STANDARD' CHECK (vip_tier IN ('STANDARD','PREFERRED','VIP')),
  preferred_vehicle TEXT CHECK (preferred_vehicle IN ('EXECUTIVE_SUV','PREMIER_SUV')),
  preferred_driver TEXT,
  usual_pickup TEXT,
  usual_dropoff TEXT,
  dietary_restrictions TEXT,
  preferred_restaurants TEXT[] NOT NULL DEFAULT '{}',
  communication_preference TEXT NOT NULL DEFAULT 'sms' CHECK (communication_preference IN ('sms','email','both')),
  special_dates JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  total_rides INTEGER NOT NULL DEFAULT 0,
  total_spent_cents INTEGER NOT NULL DEFAULT 0,
  last_ride_date TIMESTAMPTZ,
  last_checkin_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_contact ON client_profiles(contact_id);
CREATE INDEX idx_profiles_vip ON client_profiles(vip_tier);
CREATE INDEX idx_profiles_checkin ON client_profiles(last_checkin_date)
  WHERE vip_tier IN ('PREFERRED', 'VIP');

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON client_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Enable RLS on all new tables
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_flights ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;

-- Service role policies (full access for server-side operations)
CREATE POLICY "Service role full access" ON invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON tracked_flights FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON venues FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON client_profiles FOR ALL USING (true) WITH CHECK (true);

-- Public read access for venues (they're public info)
CREATE POLICY "Public read venues" ON venues FOR SELECT USING (active = true);
