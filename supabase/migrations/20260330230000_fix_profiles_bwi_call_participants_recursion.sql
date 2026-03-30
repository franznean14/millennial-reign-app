-- Fix 42P17: policies on profiles that subquery calls/call_todos re-enter profiles RLS via those
-- tables' policies. Use SECURITY DEFINER so existence checks run without RLS recursion.

CREATE OR REPLACE FUNCTION public.profile_visible_via_bwi_calls(target_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles me
    WHERE me.id = auth.uid()
      AND me.congregation_id IS NOT NULL
      AND (
        EXISTS (
          SELECT 1 FROM public.calls c
          WHERE c.congregation_id = me.congregation_id
            AND (c.publisher_id = target_profile_id OR c.partner_id = target_profile_id)
        )
        OR EXISTS (
          SELECT 1 FROM public.call_todos t
          LEFT JOIN public.calls c ON c.id = t.call_id
          WHERE (t.publisher_id = target_profile_id OR t.partner_id = target_profile_id)
            AND COALESCE(t.congregation_id, c.congregation_id) = me.congregation_id
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.profile_visible_via_bwi_calls(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Profiles: Read BWI call participants" ON public.profiles;
CREATE POLICY "Profiles: Read BWI call participants"
ON public.profiles
FOR SELECT
USING (public.profile_visible_via_bwi_calls(profiles.id));
