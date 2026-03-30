-- Allow every user to UPDATE their own profile (name, contact, gender, etc.).
-- The previous "admin/elder only" self-update policy blocked normal publishers and guests (403).
-- A BEFORE UPDATE trigger prevents privilege/role/congregation escalation for non-privileged users.

CREATE OR REPLACE FUNCTION public.profiles_enforce_self_update_bounds()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RETURN NEW;
  END IF;

  -- Platform admins and profile roles admin/superadmin bypass bounds
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

  -- Only current elders may change their privileges array (including removing Elder)
  IF NEW.privileges IS DISTINCT FROM OLD.privileges THEN
    IF NOT (OLD.privileges @> array['Elder']::text[]) THEN
      RAISE EXCEPTION 'Only elders may change privileges';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_self_update_bounds ON public.profiles;
CREATE TRIGGER trg_profiles_self_update_bounds
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_enforce_self_update_bounds();

DROP POLICY IF EXISTS "Profiles: Update own (admin/elder only)" ON public.profiles;
DROP POLICY IF EXISTS "Profiles: Update own" ON public.profiles;
CREATE POLICY "Profiles: Update own"
ON public.profiles
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());
