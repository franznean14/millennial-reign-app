-- Allow elders (same congregation) and platform admins to set is_congregation_guest / manage
-- assignment when updating another user's row. The previous logic only bypassed when the
-- *target* was admin, so marking an existing publisher as Guest always failed.

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
    IF OLD.id = auth.uid() THEN
      RAISE EXCEPTION 'congregation assignment cannot be changed from profile';
    END IF;

    IF NOT (
      public.is_admin(auth.uid())
      OR (
        NEW.congregation_id IS NOT DISTINCT FROM OLD.congregation_id
        AND EXISTS (
          SELECT 1 FROM public.profiles me
          WHERE me.id = auth.uid()
            AND me.privileges @> array['Elder']::text[]
            AND me.congregation_id IS NOT NULL
            AND me.congregation_id = OLD.congregation_id
        )
      )
    ) THEN
      RAISE EXCEPTION 'congregation assignment cannot be changed from profile';
    END IF;
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
