-- Allow congregation members to read profiles that appear as publisher/partner on calls or
-- call_todos in their congregation, even after remove_user_from_congregation (target profile
-- may have congregation_id NULL while historical calls still reference them).

DROP POLICY IF EXISTS "Profiles: Read BWI call participants" ON public.profiles;
CREATE POLICY "Profiles: Read BWI call participants"
ON public.profiles
FOR SELECT
USING (
  public.my_congregation_id() IS NOT NULL
  AND (
    EXISTS (
      SELECT 1
      FROM public.calls c
      WHERE c.congregation_id = public.my_congregation_id()
        AND (c.publisher_id = profiles.id OR c.partner_id = profiles.id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.call_todos t
      LEFT JOIN public.calls c ON c.id = t.call_id
      WHERE (t.publisher_id = profiles.id OR t.partner_id = profiles.id)
        AND COALESCE(t.congregation_id, c.congregation_id) = public.my_congregation_id()
    )
  )
);
