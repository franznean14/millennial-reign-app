-- ==============================================
-- Fix Supabase Security Warnings
-- ==============================================
-- This migration addresses critical security warnings:
-- 1. Fix mutable search_path in SECURITY DEFINER functions
-- 2. Document manual steps for password protection and PostgreSQL upgrade

-- Fix delete_householder function - add SET search_path
CREATE OR REPLACE FUNCTION public.delete_householder(
  householder_id uuid,
  deleted_by_user uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.business_householders
  SET 
    is_deleted = true,
    deleted_at = now(),
    deleted_by = deleted_by_user
  WHERE id = householder_id;
END;
$$;

-- Fix set_updated_at function - add SET search_path
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ==============================================
-- MANUAL STEPS REQUIRED (Cannot be automated via SQL)
-- ==============================================

-- MANUAL STEP 1: Enable Leaked Password Protection
-- This is configured via Supabase Dashboard, not SQL:
-- 1. Go to Authentication > Auth Providers
-- 2. Toggle "Leaked Password Protection" to enabled
-- This protects against known compromised passwords from data breaches

-- MANUAL STEP 2: Upgrade PostgreSQL Version
-- This requires a Supabase support request or automatic update:
-- 1. Go to Database Settings in Supabase Dashboard
-- 2. Check for available PostgreSQL updates
-- 3. Apply updates during maintenance window
-- Or contact Supabase support for managed upgrade
