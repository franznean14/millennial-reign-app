-- Add soft delete and archive columns to business_householders table
-- This migration adds the same soft delete/archive functionality that exists for business_establishments

-- Add the new columns
ALTER TABLE public.business_householders 
ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS archived_at timestamptz,
ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Add comments for documentation
COMMENT ON COLUMN public.business_householders.is_archived IS 'Whether the householder has been archived (soft delete)';
COMMENT ON COLUMN public.business_householders.is_deleted IS 'Whether the householder has been deleted (soft delete)';
COMMENT ON COLUMN public.business_householders.archived_by IS 'User who archived the householder';
COMMENT ON COLUMN public.business_householders.deleted_by IS 'User who deleted the householder';
COMMENT ON COLUMN public.business_householders.archived_at IS 'When the householder was archived';
COMMENT ON COLUMN public.business_householders.deleted_at IS 'When the householder was deleted';

-- Update RLS policies to include the new soft delete logic
-- First, drop the existing policies
DROP POLICY IF EXISTS "Business: hh read" ON public.business_householders;
DROP POLICY IF EXISTS "Business: hh write" ON public.business_householders;

-- Recreate the read policy with soft delete filtering
CREATE POLICY "Business: hh read" ON public.business_householders FOR SELECT USING (
  NOT is_deleted AND NOT is_archived AND
  EXISTS (
    SELECT 1 FROM public.business_establishments e, public.profiles me
    WHERE e.id = public.business_householders.establishment_id 
    AND me.id = auth.uid() 
    AND me.congregation_id = e.congregation_id
    AND NOT e.is_deleted
  )
);

-- Recreate the write policy with soft delete filtering
CREATE POLICY "Business: hh write" ON public.business_householders FOR ALL USING (
  NOT is_deleted AND
  EXISTS (
    SELECT 1 FROM public.business_establishments e, public.business_participants bp, public.profiles me
    WHERE e.id = public.business_householders.establishment_id 
    AND bp.user_id = auth.uid() 
    AND me.id = auth.uid()
    AND bp.congregation_id = e.congregation_id 
    AND me.congregation_id = e.congregation_id 
    AND bp.active = true
    AND NOT e.is_deleted
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.business_establishments e, public.business_participants bp, public.profiles me
    WHERE e.id = public.business_householders.establishment_id 
    AND bp.user_id = auth.uid() 
    AND me.id = auth.uid()
    AND bp.congregation_id = e.congregation_id 
    AND me.congregation_id = e.congregation_id 
    AND bp.active = true
    AND NOT e.is_deleted
  )
);
