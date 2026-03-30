-- Remove a publisher from their current congregation (clear assignment; does not delete auth user).
-- Elders of the same congregation, admin_users, or profiles with role admin/superadmin may run.

CREATE OR REPLACE FUNCTION public.remove_user_from_congregation(target_user uuid)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_cong uuid;
  allowed boolean;
  res public.profiles;
BEGIN
  SELECT congregation_id INTO target_cong FROM public.profiles WHERE id = target_user;
  IF target_cong IS NULL THEN
    RAISE EXCEPTION 'User is not assigned to a congregation';
  END IF;

  SELECT (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND (
          (me.privileges @> array['Elder']::text[] AND me.congregation_id = target_cong)
          OR me.role IN ('admin', 'superadmin')
        )
    )
  ) INTO allowed;

  IF NOT COALESCE(allowed, false) THEN
    RAISE EXCEPTION 'insufficient privilege: only an elder of this congregation or an admin may remove a publisher';
  END IF;

  DELETE FROM public.congregation_guest_name_inheritances
  WHERE profile_id = target_user AND congregation_id = target_cong;

  DELETE FROM public.business_participants
  WHERE user_id = target_user AND congregation_id = target_cong;

  UPDATE public.profiles SET
    congregation_id = NULL,
    group_name = NULL,
    is_congregation_guest = false,
    updated_at = now()
  WHERE id = target_user
  RETURNING * INTO res;

  RETURN res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_user_from_congregation(uuid) TO authenticated;
