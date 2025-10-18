-- Comprehensive migration to fix all database conflicts
-- This migration safely handles existing objects and applies all necessary changes

-- ==============================================
-- Fix Push Subscriptions RLS (with conflict handling)
-- ==============================================

-- Drop existing policies first
DROP POLICY IF EXISTS "Users manage own subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Admins read all subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Service role can read all subscriptions" ON public.push_subscriptions;

-- Create more permissive policies for testing
CREATE POLICY "Users manage own subscriptions"
ON public.push_subscriptions
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow service role to read all subscriptions (for sending notifications)
CREATE POLICY "Service role can read all subscriptions"
ON public.push_subscriptions
FOR SELECT
TO service_role
USING (true);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT SELECT ON public.push_subscriptions TO service_role;

-- Ensure the table exists with proper structure
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create index for performance
CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx 
ON public.push_subscriptions(user_id);

-- Create trigger for updated_at (drop first to avoid conflicts)
DROP TRIGGER IF EXISTS push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==============================================
-- Add Contact Information Fields (safe to run multiple times)
-- ==============================================

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
