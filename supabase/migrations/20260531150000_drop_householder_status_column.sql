-- Contacts use statuses[] only; drop legacy scalar status column.
-- Drop contacts view first (SELECT * binds to status column).

DROP VIEW IF EXISTS public.contacts;

ALTER TABLE public.householders
  DROP COLUMN IF EXISTS status;
