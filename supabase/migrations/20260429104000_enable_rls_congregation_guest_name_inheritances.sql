-- Resolve Supabase security advisor warning: rls_disabled_in_public
-- for public.congregation_guest_name_inheritances.
-- Keep access scoped to admins or elders within the same congregation.

ALTER TABLE public.congregation_guest_name_inheritances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Guest inheritances: read" ON public.congregation_guest_name_inheritances;
CREATE POLICY "Guest inheritances: read"
ON public.congregation_guest_name_inheritances
FOR SELECT
USING (
  public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.profiles me
    WHERE me.id = auth.uid()
      AND me.privileges @> array['Elder']::text[]
      AND me.congregation_id = public.congregation_guest_name_inheritances.congregation_id
  )
);

DROP POLICY IF EXISTS "Guest inheritances: write" ON public.congregation_guest_name_inheritances;
CREATE POLICY "Guest inheritances: write"
ON public.congregation_guest_name_inheritances
FOR ALL
USING (
  public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.profiles me
    WHERE me.id = auth.uid()
      AND me.privileges @> array['Elder']::text[]
      AND me.congregation_id = public.congregation_guest_name_inheritances.congregation_id
  )
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.profiles me
    WHERE me.id = auth.uid()
      AND me.privileges @> array['Elder']::text[]
      AND me.congregation_id = public.congregation_guest_name_inheritances.congregation_id
  )
);
