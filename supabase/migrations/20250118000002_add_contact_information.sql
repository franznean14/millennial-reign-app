-- Add contact information fields to profiles table
-- This migration adds phone number, address, and coordinates for emergency contact purposes

-- Add contact information fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address_latitude numeric(10, 8);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address_longitude numeric(11, 8);

-- Create index for coordinate-based queries
CREATE INDEX IF NOT EXISTS profiles_coordinates_idx 
ON public.profiles(address_latitude, address_longitude) 
WHERE address_latitude IS NOT NULL AND address_longitude IS NOT NULL;

-- Helper function for elder access to contact information
CREATE OR REPLACE FUNCTION public.can_view_contact_info(
  viewer_id uuid,
  profile_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  viewer_profile profiles%ROWTYPE;
  target_profile profiles%ROWTYPE;
BEGIN
  -- User can always view their own contact info
  IF viewer_id = profile_id THEN
    RETURN true;
  END IF;
  
  -- Get profiles
  SELECT * INTO viewer_profile FROM profiles WHERE id = viewer_id;
  SELECT * INTO target_profile FROM profiles WHERE id = profile_id;
  
  -- Elders can view contact info of users in their congregation
  IF 'Elder' = ANY(viewer_profile.privileges) 
     AND viewer_profile.congregation_id = target_profile.congregation_id
     AND viewer_profile.congregation_id IS NOT NULL THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;
