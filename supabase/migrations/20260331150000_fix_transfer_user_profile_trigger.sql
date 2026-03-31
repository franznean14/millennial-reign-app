DROP FUNCTION IF EXISTS public.transfer_user_to_congregation(uuid, uuid);

-- 1) Profile self-update trigger must NOT block congregation updates done inside trusted SECURITY DEFINER RPCs
--    (transfer_user_to_congregation, remove_user_from_congregation). Those RPCs set a transaction-local GUC.
-- 2) Elders may add a user with no congregation into their own congregation (previous check required same congregation).

CREATE OR REPLACE FUNCTION public.profiles_enforce_self_update_bounds()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_other text[];
  new_other text[];
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RETURN NEW;
  END IF;

  -- Trusted RPCs (transfer / remove congregation) set this for the transaction
  IF current_setting('app.allow_profile_congregation_update', true) = '1' THEN
    RETURN NEW;
  END IF;

  IF public.is_admin(NEW.id) OR OLD.role IN ('admin', 'superadmin') THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'role cannot be changed';
  END IF;

  IF NEW.congregation_id IS DISTINCT FROM OLD.congregation_id
     OR COALESCE(NEW.is_congregation_guest, false) IS DISTINCT FROM COALESCE(OLD.is_congregation_guest, false) THEN
    RAISE EXCEPTION 'congregation assignment cannot be changed from profile';
  END IF;

  IF NEW.privileges IS DISTINCT FROM OLD.privileges THEN
    IF OLD.privileges @> array['Elder']::text[] THEN
      NULL;
    ELSE
      SELECT COALESCE(array_agg(x ORDER BY x), '{}')
      INTO old_other
      FROM unnest(OLD.privileges) AS x
      WHERE x NOT IN ('Regular Pioneer', 'Auxiliary Pioneer');

      SELECT COALESCE(array_agg(x ORDER BY x), '{}')
      INTO new_other
      FROM unnest(NEW.privileges) AS x
      WHERE x NOT IN ('Regular Pioneer', 'Auxiliary Pioneer');

      IF old_other IS DISTINCT FROM new_other THEN
        RAISE EXCEPTION 'Only elders may change congregation privileges';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_user_to_congregation(
  target_user uuid,
  new_congregation uuid,
  p_is_congregation_guest boolean DEFAULT NULL,
  p_group_name text DEFAULT NULL
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed boolean;
  res public.profiles;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.congregations c WHERE c.id = new_congregation) THEN
    RAISE EXCEPTION 'invalid_congregation';
  END IF;

  SELECT (
    public.is_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.profiles me, public.profiles p
      WHERE me.id = auth.uid() AND p.id = target_user
        AND me.privileges @> array['Elder']::text[]
        AND (
          (me.congregation_id IS NOT NULL AND me.congregation_id = p.congregation_id)
          OR (p.congregation_id IS NULL AND me.congregation_id = new_congregation)
        )
    )
  ) INTO allowed;

  IF NOT COALESCE(allowed, false) THEN
    RAISE EXCEPTION 'insufficient_privilege: only an elder of the user''s current congregation or an admin may transfer';
  END IF;

  PERFORM set_config('app.allow_profile_congregation_update', '1', true);

  UPDATE public.profiles
  SET
    congregation_id = new_congregation,
    is_congregation_guest = CASE
      WHEN p_is_congregation_guest IS NOT NULL THEN p_is_congregation_guest
      ELSE is_congregation_guest
    END,
    group_name = CASE
      WHEN p_is_congregation_guest IS NOT NULL AND p_is_congregation_guest THEN NULL
      WHEN p_group_name IS NOT NULL THEN p_group_name
      ELSE group_name
    END,
    updated_at = now()
  WHERE id = target_user
  RETURNING * INTO res;

  RETURN res;
END;
$$;

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

  PERFORM set_config('app.allow_profile_congregation_update', '1', true);

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

GRANT EXECUTE ON FUNCTION public.transfer_user_to_congregation(uuid, uuid, boolean, text) TO authenticated;
