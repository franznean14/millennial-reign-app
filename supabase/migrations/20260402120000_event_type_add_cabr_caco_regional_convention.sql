-- Add congregation event types: CABR, CACO, Regional Convention (non-ministry schedules).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'event_type_t' AND e.enumlabel = 'cabr'
  ) THEN
    ALTER TYPE public.event_type_t ADD VALUE 'cabr';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'event_type_t' AND e.enumlabel = 'caco'
  ) THEN
    ALTER TYPE public.event_type_t ADD VALUE 'caco';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'event_type_t' AND e.enumlabel = 'regional_convention'
  ) THEN
    ALTER TYPE public.event_type_t ADD VALUE 'regional_convention';
  END IF;
END $$;
