-- Add subscription cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_user_subscriptions(
  target_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Remove all subscriptions for the user except the most recent one
  WITH latest_subscription AS (
    SELECT endpoint
    FROM public.push_subscriptions
    WHERE user_id = target_user_id
    ORDER BY created_at DESC
    LIMIT 1
  )
  DELETE FROM public.push_subscriptions
  WHERE user_id = target_user_id
    AND endpoint NOT IN (SELECT endpoint FROM latest_subscription);
END;
$$;

-- Add function to handle subscription upsert with cleanup
CREATE OR REPLACE FUNCTION public.upsert_push_subscription(
  p_user_id uuid,
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Clean up old subscriptions for this user
  DELETE FROM public.push_subscriptions
  WHERE user_id = p_user_id;
  
  -- Insert new subscription
  INSERT INTO public.push_subscriptions (
    user_id,
    endpoint,
    p256dh,
    auth,
    user_agent
  ) VALUES (
    p_user_id,
    p_endpoint,
    p_p256dh,
    p_auth,
    p_user_agent
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.cleanup_user_subscriptions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_push_subscription(uuid, text, text, text, text) TO authenticated;
