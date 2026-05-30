-- Multiple contact statuses (same model as establishment statuses[]); keep status as primary for filters/realtime.

ALTER TABLE public.householders
  ADD COLUMN IF NOT EXISTS statuses public.householder_status_t[] NOT NULL
  DEFAULT ARRAY['interested'::public.householder_status_t];

UPDATE public.householders
SET statuses = ARRAY[status]::public.householder_status_t[]
WHERE cardinality(statuses) = 0
   OR statuses IS NULL;
