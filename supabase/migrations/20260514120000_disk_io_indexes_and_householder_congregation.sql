-- Disk IO: hot-path indexes + householders.congregation_id for scoped Realtime filters.
-- Additive only: CREATE INDEX / ADD COLUMN / UPDATE backfill / trigger. No DELETE of user data.

-- Establishment list queries: congregation + active rows
CREATE INDEX IF NOT EXISTS business_establishments_congregation_active_idx
  ON public.business_establishments(congregation_id)
  WHERE is_deleted = false AND is_archived = false;

-- Denormalized congregation on householders (realtime filter: congregation_id=eq.<uuid>)
DO $$ BEGIN
  ALTER TABLE public.householders ADD COLUMN IF NOT EXISTS congregation_id uuid REFERENCES public.congregations(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN null;
END $$;

CREATE INDEX IF NOT EXISTS householders_congregation_id_idx ON public.householders(congregation_id) WHERE congregation_id IS NOT NULL;

UPDATE public.householders h
SET congregation_id = e.congregation_id
FROM public.business_establishments e
WHERE h.establishment_id = e.id
  AND (h.congregation_id IS NULL OR h.congregation_id IS DISTINCT FROM e.congregation_id);

UPDATE public.householders h
SET congregation_id = p.congregation_id
FROM public.profiles p
WHERE h.publisher_id = p.id
  AND h.establishment_id IS NULL
  AND p.congregation_id IS NOT NULL
  AND (h.congregation_id IS NULL OR h.congregation_id IS DISTINCT FROM p.congregation_id);

CREATE OR REPLACE FUNCTION public.householders_set_congregation_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.establishment_id IS NOT NULL THEN
    SELECT e.congregation_id INTO NEW.congregation_id
    FROM public.business_establishments e
    WHERE e.id = NEW.establishment_id;
  ELSIF NEW.publisher_id IS NOT NULL THEN
    SELECT p.congregation_id INTO NEW.congregation_id
    FROM public.profiles p
    WHERE p.id = NEW.publisher_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_householders_set_congregation ON public.householders;
CREATE TRIGGER trg_householders_set_congregation
  BEFORE INSERT OR UPDATE OF establishment_id, publisher_id ON public.householders
  FOR EACH ROW
  EXECUTE FUNCTION public.householders_set_congregation_id();

-- Calls: congregation-scoped lists, visit aggregates, getMyOpenCallTodos lookups
CREATE INDEX IF NOT EXISTS calls_congregation_id_idx ON public.calls(congregation_id);
CREATE INDEX IF NOT EXISTS calls_establishment_id_idx ON public.calls(establishment_id) WHERE establishment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS calls_householder_id_idx ON public.calls(householder_id) WHERE householder_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS calls_publisher_id_idx ON public.calls(publisher_id) WHERE publisher_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS calls_partner_id_idx ON public.calls(partner_id) WHERE partner_id IS NOT NULL;
