-- Contacts compat layer (additive only — no drops, no data deletes).
-- 1) Multi-status column on householders (if not already applied)
-- 2) delete_contact RPC (alias of delete_householder)
-- 3) contacts view over householders for tooling/SQL

ALTER TABLE public.householders
  ADD COLUMN IF NOT EXISTS statuses public.householder_status_t[] NOT NULL
  DEFAULT ARRAY['interested'::public.householder_status_t];

UPDATE public.householders
SET statuses = ARRAY[status]::public.householder_status_t[]
WHERE cardinality(statuses) = 0
   OR statuses IS NULL;

COMMENT ON TABLE public.householders IS
  'Ministry/BWI contacts (legacy table name householders; app label: contacts).';

-- Primary delete RPC (same behavior as delete_householder)
CREATE OR REPLACE FUNCTION public.delete_contact(
  contact_id uuid,
  deleted_by_user uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.householders
  SET
    is_deleted = true,
    deleted_at = now(),
    deleted_by = deleted_by_user
  WHERE id = contact_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_contact(uuid, uuid) TO authenticated;

-- Backward-compatible alias (existing clients / migrations)
CREATE OR REPLACE FUNCTION public.delete_householder(
  householder_id uuid,
  deleted_by_user uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.delete_contact(householder_id, deleted_by_user);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_householder(uuid, uuid) TO authenticated;

-- Read-only view (optional reporting; RLS on base table still applies to direct table access)
CREATE OR REPLACE VIEW public.contacts AS
  SELECT * FROM public.householders;

COMMENT ON VIEW public.contacts IS
  'Alias view for householders (contacts). Use table householders for writes.';
