-- Fix delete_householder function parameter name to avoid ambiguity
-- The parameter 'deleted_by' was conflicting with the column name 'deleted_by'
-- Need to drop and recreate the function to change parameter names

DROP FUNCTION IF EXISTS public.delete_householder(uuid, uuid);

CREATE OR REPLACE FUNCTION public.delete_householder(
  householder_id uuid,
  deleted_by_user uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.business_householders
  SET 
    is_deleted = true,
    deleted_at = now(),
    deleted_by = deleted_by_user
  WHERE id = householder_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_householder(uuid, uuid) TO authenticated;
