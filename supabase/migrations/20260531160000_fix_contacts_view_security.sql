-- contacts view bypassed householders RLS (default security definer / owner privileges).
-- Recreate as security_invoker so queries use the caller's permissions and RLS applies.
-- App reads/writes public.householders directly; this view is an optional SQL alias only.

DROP VIEW IF EXISTS public.contacts;

CREATE VIEW public.contacts
WITH (security_invoker = true)
AS
  SELECT * FROM public.householders;

COMMENT ON VIEW public.contacts IS
  'Read-only alias for householders. security_invoker ensures householders RLS applies.';

REVOKE ALL ON public.contacts FROM PUBLIC;
REVOKE ALL ON public.contacts FROM anon;
GRANT SELECT ON public.contacts TO authenticated;
