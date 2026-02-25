-- Add optional guest names for call participants (when no publisher_id/partner_id)
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS publisher_guest_name text;
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS partner_guest_name text;
