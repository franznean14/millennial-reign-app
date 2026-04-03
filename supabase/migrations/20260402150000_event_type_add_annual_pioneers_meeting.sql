-- Add congregation event type: Annual Pioneers Meeting (non-ministry schedule).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'event_type_t' AND e.enumlabel = 'annual_pioneers_meeting'
  ) THEN
    ALTER TYPE public.event_type_t ADD VALUE 'annual_pioneers_meeting';
  END IF;
END $$;
