-- Allow future dates in daily records.
-- Removes legacy CHECK constraints that enforced date <= CURRENT_DATE + 1 day.

DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.daily_records'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%date <=%'
  LOOP
    EXECUTE format('ALTER TABLE public.daily_records DROP CONSTRAINT IF EXISTS %I', c.conname);
  END LOOP;
END $$;

