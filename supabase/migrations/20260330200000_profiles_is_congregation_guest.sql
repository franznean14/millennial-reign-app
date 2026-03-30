-- Flag publishers who are temporary / guest members of the congregation (UI badge + "Guest" filter tab).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_congregation_guest boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_congregation_guest IS 'When true, congregation UI shows a Guest badge and the member can appear under the Guest filter.';
