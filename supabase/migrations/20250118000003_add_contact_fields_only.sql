-- Add contact information fields to profiles table only
-- This migration only adds the contact fields without conflicting triggers

-- Add contact information fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address_latitude numeric(10, 8);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address_longitude numeric(11, 8);

-- Create index for coordinate-based queries
CREATE INDEX IF NOT EXISTS profiles_coordinates_idx 
ON public.profiles(address_latitude, address_longitude) 
WHERE address_latitude IS NOT NULL AND address_longitude IS NOT NULL;
