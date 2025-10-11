-- Add delete_householder function to bypass RLS for householder deletion
-- This function allows marking householders as deleted even when RLS policies would prevent it

CREATE OR REPLACE FUNCTION public.delete_householder(
  householder_id uuid,
  deleted_by uuid
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
    deleted_by = deleted_by
  WHERE id = householder_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_householder(uuid, uuid) TO authenticated;
