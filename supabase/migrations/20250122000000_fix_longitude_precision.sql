-- Fix longitude precision overflow issue
-- Longitude values range from -180 to +180, so we need at least 3 digits before decimal
-- numeric(10,8) only allows 2 digits (max 99.99999999), causing overflow for values >= 100
-- Change to numeric(11,8) which allows 3 digits (max 999.99999999), sufficient for -180 to +180

-- Fix householders.lng column
ALTER TABLE public.householders 
  ALTER COLUMN lng TYPE numeric(11,8);

-- Fix event_schedules.location_lng column
ALTER TABLE public.event_schedules 
  ALTER COLUMN location_lng TYPE numeric(11,8);
