-- Update profiles RLS to:
-- - Allow all authenticated users to SELECT profiles in their own congregation
-- - Restrict UPDATE to admins or elders (still only on their own row)

-- Ensure RLS is enabled (idempotent)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 1) Read: allow seeing all profiles in my congregation (plus keep existing "read own" behavior)
DROP POLICY IF EXISTS "Profiles: Read congregation" ON public.profiles;
CREATE POLICY "Profiles: Read congregation"
ON public.profiles
FOR SELECT
USING (
  -- Same congregation as current user
  congregation_id = public.my_congregation_id()
);

-- Keep existing "Profiles: Read own" and "Profiles: Admin all" policies from base schema.

-- 2) Update: only admins or elders may update profiles, and only their own row
DROP POLICY IF EXISTS "Profiles: Update own" ON public.profiles;
CREATE POLICY "Profiles: Update own (admin/elder only)"
ON public.profiles
FOR UPDATE
USING (
  id = auth.uid()
  AND (public.is_admin(auth.uid()) OR public.is_elder(auth.uid()))
)
WITH CHECK (
  id = auth.uid()
  AND (public.is_admin(auth.uid()) OR public.is_elder(auth.uid()))
);

