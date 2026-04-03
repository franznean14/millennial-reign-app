-- Venue name + structured address for special event types (CABR, CACO, RC, Memorial, etc.).

ALTER TABLE public.event_schedules ADD COLUMN IF NOT EXISTS venue_name text;
ALTER TABLE public.event_schedules ADD COLUMN IF NOT EXISTS venue_address text;

COMMENT ON COLUMN public.event_schedules.venue_name IS 'Display name for the venue (e.g. convention center).';
COMMENT ON COLUMN public.event_schedules.venue_address IS 'Multi-line postal address; use with location_lat/lng for directions.';
