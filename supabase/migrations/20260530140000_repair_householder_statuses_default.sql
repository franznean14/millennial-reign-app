-- Repair statuses[] backfill from the statuses-array migration.
-- ADD COLUMN ... DEFAULT ARRAY['interested'] populated every existing row with interested,
-- but the follow-up UPDATE only ran when cardinality(statuses) = 0, so rows kept the default.

UPDATE public.householders
SET statuses = ARRAY[status]::public.householder_status_t[]
WHERE status IS NOT NULL
  AND statuses = ARRAY['interested'::public.householder_status_t]
  AND status <> 'interested';

ALTER TABLE public.householders
  ALTER COLUMN statuses SET DEFAULT ARRAY['potential'::public.householder_status_t];
