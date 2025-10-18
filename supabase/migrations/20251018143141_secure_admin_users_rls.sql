-- ==============================================
-- Secure admin_users Table with RLS
-- ==============================================
-- This migration enables Row Level Security on the admin_users table
-- to prevent unauthorized access while maintaining the is_admin() function's
-- ability to check admin status via SECURITY DEFINER.

-- Enable Row Level Security on admin_users table
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Create policy to block all direct client access
-- The is_admin() function uses SECURITY DEFINER so it bypasses RLS
CREATE POLICY "block_all_client_access" 
ON public.admin_users 
FOR ALL 
TO authenticated, anon
USING (false) 
WITH CHECK (false);

-- Revoke unnecessary grants to prevent direct table access
-- The is_admin() function only needs to be called, not direct table access
REVOKE INSERT, UPDATE, DELETE ON public.admin_users FROM anon, authenticated;

-- Add comment explaining the security model
COMMENT ON TABLE public.admin_users IS 'Admin users table: stores superadmin user IDs. RLS is enabled to prevent direct client access. The is_admin() SECURITY DEFINER function bypasses RLS for privilege checks.';
