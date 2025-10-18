-- ==============================================
-- Add Push Notifications Support
-- ==============================================
-- This migration adds support for Web Push Notifications
-- including push subscriptions table and notification preferences

-- Push subscriptions table
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

-- Users can manage their own subscriptions
CREATE POLICY "Users manage own subscriptions"
ON public.push_subscriptions
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins can read all subscriptions (for sending notifications)
CREATE POLICY "Admins read all subscriptions"
ON public.push_subscriptions
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Index for performance
CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx 
ON public.push_subscriptions(user_id);

-- Trigger for updated_at
CREATE TRIGGER push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Notification preferences in profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS notification_preferences jsonb DEFAULT '{"enabled": true, "types": ["assignment", "reminder", "announcement"]}'::jsonb;

-- Add comment explaining the table
COMMENT ON TABLE public.push_subscriptions IS 'Stores Web Push API subscriptions for sending notifications to users. Each subscription is tied to a user and device.';
