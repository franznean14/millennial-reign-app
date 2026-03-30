-- Guest name inheritance: when a user joins a congregation, optionally link one
-- historical *_guest_name string so calls/call_todos rows are updated to profile ids.
-- One normalized guest name per congregation can be claimed once; each profile one claim per congregation.

-- Required by RPCs below (20260225100000 only added these on calls, not call_todos)
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS publisher_guest_name text;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS partner_guest_name text;
ALTER TABLE public.call_todos ADD COLUMN IF NOT EXISTS publisher_guest_name text;
ALTER TABLE public.call_todos ADD COLUMN IF NOT EXISTS partner_guest_name text;

CREATE TABLE IF NOT EXISTS public.congregation_guest_name_inheritances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  congregation_id uuid NOT NULL REFERENCES public.congregations(id) ON DELETE CASCADE,
  guest_name_normalized text NOT NULL,
  guest_name_display text NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT congregation_guest_name_inheritances_cong_norm_uq
    UNIQUE (congregation_id, guest_name_normalized),
  CONSTRAINT congregation_guest_name_inheritances_cong_profile_uq
    UNIQUE (congregation_id, profile_id)
);

CREATE INDEX IF NOT EXISTS congregation_guest_name_inheritances_profile_idx
  ON public.congregation_guest_name_inheritances (profile_id);

-- Elders of the congregation (or admins) see inheritable guest labels from visits/todos.
CREATE OR REPLACE FUNCTION public.list_inheritable_guest_names(congregation_id_param uuid)
RETURNS TABLE (guest_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH allowed AS (
    SELECT (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.profiles me
        WHERE me.id = auth.uid()
          AND me.privileges @> array['Elder']::text[]
          AND me.congregation_id = congregation_id_param
      )
    ) AS ok
  ),
  raw_names AS (
    SELECT DISTINCT trim(c.publisher_guest_name) AS g
    FROM public.calls c
    WHERE c.congregation_id = congregation_id_param
      AND c.publisher_id IS NULL
      AND c.publisher_guest_name IS NOT NULL
      AND trim(c.publisher_guest_name) <> ''
    UNION
    SELECT DISTINCT trim(c.partner_guest_name)
    FROM public.calls c
    WHERE c.congregation_id = congregation_id_param
      AND c.partner_id IS NULL
      AND c.partner_guest_name IS NOT NULL
      AND trim(c.partner_guest_name) <> ''
    UNION
    SELECT DISTINCT trim(t.publisher_guest_name)
    FROM public.call_todos t
    LEFT JOIN public.calls c ON c.id = t.call_id
    WHERE t.publisher_id IS NULL
      AND t.publisher_guest_name IS NOT NULL
      AND trim(t.publisher_guest_name) <> ''
      AND (
        t.congregation_id = congregation_id_param
        OR c.congregation_id = congregation_id_param
      )
    UNION
    SELECT DISTINCT trim(t.partner_guest_name)
    FROM public.call_todos t
    LEFT JOIN public.calls c ON c.id = t.call_id
    WHERE t.partner_id IS NULL
      AND t.partner_guest_name IS NOT NULL
      AND trim(t.partner_guest_name) <> ''
      AND (
        t.congregation_id = congregation_id_param
        OR c.congregation_id = congregation_id_param
      )
  )
  SELECT r.g::text AS guest_name
  FROM raw_names r
  CROSS JOIN allowed a
  WHERE a.ok = true
    AND NOT EXISTS (
      SELECT 1 FROM public.congregation_guest_name_inheritances i
      WHERE i.congregation_id = congregation_id_param
        AND i.guest_name_normalized = lower(trim(r.g))
    )
  ORDER BY lower(trim(r.g));
$$;

GRANT EXECUTE ON FUNCTION public.list_inheritable_guest_names(uuid) TO authenticated;

-- Claim a guest name for a profile: updates calls + call_todos, clears guest text on matched rows.
CREATE OR REPLACE FUNCTION public.inherit_guest_name_on_profile(
  congregation_id_param uuid,
  target_profile uuid,
  guest_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  norm text;
  allowed boolean;
  display_name text;
  n_pub_calls int := 0;
  n_part_calls int := 0;
  n_pub_todos int := 0;
  n_part_todos int := 0;
BEGIN
  IF guest_name IS NULL OR trim(guest_name) = '' THEN
    RAISE EXCEPTION 'Guest name is required for inheritance';
  END IF;

  norm := lower(trim(guest_name));

  SELECT (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.privileges @> array['Elder']::text[]
        AND me.congregation_id = congregation_id_param
    )
  ) INTO allowed;

  IF NOT COALESCE(allowed, false) THEN
    RAISE EXCEPTION 'insufficient privilege: only an elder of this congregation or an admin may link a guest name';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = target_profile AND p.congregation_id = congregation_id_param
  ) THEN
    RAISE EXCEPTION 'User must belong to this congregation before linking a guest name';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.congregation_guest_name_inheritances
    WHERE congregation_id = congregation_id_param AND guest_name_normalized = norm
  ) THEN
    RAISE EXCEPTION 'This guest name is already linked to another user in this congregation';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.congregation_guest_name_inheritances
    WHERE congregation_id = congregation_id_param AND profile_id = target_profile
  ) THEN
    RAISE EXCEPTION 'This user already has a guest name linked in this congregation';
  END IF;

  IF NOT (
    EXISTS (
      SELECT 1 FROM public.calls c
      WHERE c.congregation_id = congregation_id_param
        AND c.publisher_id IS NULL
        AND lower(trim(c.publisher_guest_name)) = norm
    )
    OR EXISTS (
      SELECT 1 FROM public.calls c
      WHERE c.congregation_id = congregation_id_param
        AND c.partner_id IS NULL
        AND lower(trim(c.partner_guest_name)) = norm
    )
    OR EXISTS (
      SELECT 1 FROM public.call_todos t
      LEFT JOIN public.calls c ON c.id = t.call_id
      WHERE t.publisher_id IS NULL
        AND lower(trim(t.publisher_guest_name)) = norm
        AND (
          t.congregation_id = congregation_id_param
          OR c.congregation_id = congregation_id_param
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.call_todos t
      LEFT JOIN public.calls c ON c.id = t.call_id
      WHERE t.partner_id IS NULL
        AND lower(trim(t.partner_guest_name)) = norm
        AND (
          t.congregation_id = congregation_id_param
          OR c.congregation_id = congregation_id_param
        )
    )
  ) THEN
    RAISE EXCEPTION 'No matching guest name found in this congregation visit history';
  END IF;

  SELECT trim(c.publisher_guest_name) INTO display_name
  FROM public.calls c
  WHERE c.congregation_id = congregation_id_param
    AND c.publisher_id IS NULL
    AND lower(trim(c.publisher_guest_name)) = norm
  LIMIT 1;
  IF display_name IS NULL THEN
    SELECT trim(c.partner_guest_name) INTO display_name
    FROM public.calls c
    WHERE c.congregation_id = congregation_id_param
      AND c.partner_id IS NULL
      AND lower(trim(c.partner_guest_name)) = norm
    LIMIT 1;
  END IF;
  IF display_name IS NULL THEN
    SELECT trim(t.publisher_guest_name) INTO display_name
    FROM public.call_todos t
    LEFT JOIN public.calls c ON c.id = t.call_id
    WHERE t.publisher_id IS NULL
      AND lower(trim(t.publisher_guest_name)) = norm
      AND (
        t.congregation_id = congregation_id_param
        OR c.congregation_id = congregation_id_param
      )
    LIMIT 1;
  END IF;
  IF display_name IS NULL THEN
    SELECT trim(t.partner_guest_name) INTO display_name
    FROM public.call_todos t
    LEFT JOIN public.calls c ON c.id = t.call_id
    WHERE t.partner_id IS NULL
      AND lower(trim(t.partner_guest_name)) = norm
      AND (
        t.congregation_id = congregation_id_param
        OR c.congregation_id = congregation_id_param
      )
    LIMIT 1;
  END IF;

  INSERT INTO public.congregation_guest_name_inheritances (
    congregation_id, guest_name_normalized, guest_name_display, profile_id
  ) VALUES (
    congregation_id_param, norm, COALESCE(display_name, trim(guest_name)), target_profile
  );

  UPDATE public.calls
  SET publisher_id = target_profile, publisher_guest_name = NULL
  WHERE congregation_id = congregation_id_param
    AND publisher_id IS NULL
    AND lower(trim(publisher_guest_name)) = norm;
  GET DIAGNOSTICS n_pub_calls = ROW_COUNT;

  UPDATE public.calls
  SET partner_id = target_profile, partner_guest_name = NULL
  WHERE congregation_id = congregation_id_param
    AND partner_id IS NULL
    AND lower(trim(partner_guest_name)) = norm;
  GET DIAGNOSTICS n_part_calls = ROW_COUNT;

  UPDATE public.call_todos t
  SET publisher_id = target_profile, publisher_guest_name = NULL
  WHERE t.publisher_id IS NULL
    AND lower(trim(t.publisher_guest_name)) = norm
    AND (
      t.congregation_id = congregation_id_param
      OR EXISTS (
        SELECT 1 FROM public.calls c
        WHERE c.id = t.call_id AND c.congregation_id = congregation_id_param
      )
    );
  GET DIAGNOSTICS n_pub_todos = ROW_COUNT;

  UPDATE public.call_todos t
  SET partner_id = target_profile, partner_guest_name = NULL
  WHERE t.partner_id IS NULL
    AND lower(trim(t.partner_guest_name)) = norm
    AND (
      t.congregation_id = congregation_id_param
      OR EXISTS (
        SELECT 1 FROM public.calls c
        WHERE c.id = t.call_id AND c.congregation_id = congregation_id_param
      )
    );
  GET DIAGNOSTICS n_part_todos = ROW_COUNT;

  RETURN jsonb_build_object(
    'calls_publisher_updated', n_pub_calls,
    'calls_partner_updated', n_part_calls,
    'todos_publisher_updated', n_pub_todos,
    'todos_partner_updated', n_part_todos
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.inherit_guest_name_on_profile(uuid, uuid, text) TO authenticated;