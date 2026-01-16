-- ==============================================
-- Migration: Rename business_householders to householders
-- Add support for personal householders (not tied to establishments)
-- Add lat/lng for location mapping
-- Add publisher_id for personal assignment
-- ==============================================

-- Step 1: Add new columns to existing table (backward compatible)
DO $$ BEGIN
  ALTER TABLE public.business_householders ADD COLUMN IF NOT EXISTS lat numeric(9,6);
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.business_householders ADD COLUMN IF NOT EXISTS lng numeric(10,8);
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE public.business_householders ADD COLUMN IF NOT EXISTS publisher_id uuid REFERENCES public.profiles(id);
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Step 2: Create new enum type (rename from business_householder_status_t)
DO $$ BEGIN
  CREATE TYPE public.householder_status_t AS ENUM (
    'potential','interested','return_visit','bible_study','do_not_call'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 3: Make establishment_id nullable (but require either establishment_id OR publisher_id)
-- First, update existing data to ensure no NULL establishment_id exists without publisher_id
-- (This shouldn't be needed as establishment_id is currently NOT NULL, but being safe)
UPDATE public.business_householders 
SET establishment_id = establishment_id 
WHERE establishment_id IS NOT NULL;

-- Now make establishment_id nullable
ALTER TABLE public.business_householders 
ALTER COLUMN establishment_id DROP NOT NULL;

-- Add constraint: must have either establishment_id OR publisher_id
ALTER TABLE public.business_householders 
DROP CONSTRAINT IF EXISTS householders_establishment_or_publisher_check;

ALTER TABLE public.business_householders 
ADD CONSTRAINT householders_establishment_or_publisher_check 
CHECK (establishment_id IS NOT NULL OR publisher_id IS NOT NULL);

-- Step 4: Rename the table
ALTER TABLE public.business_householders RENAME TO householders;

-- Step 5: Update foreign key constraint names
-- The foreign key from business_visits will automatically update
-- But we need to update the constraint name for establishment_id
DO $$ 
DECLARE
  old_constraint_name text;
  new_constraint_name text := 'householders_establishment_id_fkey';
BEGIN
  -- Find the old constraint name
  SELECT conname INTO old_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.householders'::regclass
    AND confrelid = 'public.business_establishments'::regclass
    AND contype = 'f';
  
  -- Rename if found
  IF old_constraint_name IS NOT NULL AND old_constraint_name != new_constraint_name THEN
    EXECUTE format('ALTER TABLE public.householders RENAME CONSTRAINT %I TO %I', old_constraint_name, new_constraint_name);
  END IF;
END $$;

-- Step 6: Update the status column to use new enum type
-- First, add a new column with the new enum type
ALTER TABLE public.householders 
ADD COLUMN IF NOT EXISTS status_new public.householder_status_t;

-- Copy data from old column to new column
UPDATE public.householders 
SET status_new = status::text::public.householder_status_t
WHERE status_new IS NULL;

-- Make new column NOT NULL
ALTER TABLE public.householders 
ALTER COLUMN status_new SET NOT NULL,
ALTER COLUMN status_new SET DEFAULT 'interested';

-- Drop old column
ALTER TABLE public.householders DROP COLUMN IF EXISTS status;

-- Rename new column to status
ALTER TABLE public.householders RENAME COLUMN status_new TO status;

-- Step 7: Update trigger name
DROP TRIGGER IF EXISTS trg_business_householders_updated_at ON public.householders;
CREATE TRIGGER trg_householders_updated_at 
  BEFORE UPDATE ON public.householders 
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Step 8: Update RLS policies
DROP POLICY IF EXISTS "Business: hh read" ON public.householders;
DROP POLICY IF EXISTS "Business: hh write" ON public.householders;

-- New read policy: allow access if:
-- 1. Business householder (has establishment_id) - existing logic
-- 2. Personal householder (has publisher_id) - publisher can access their own
CREATE POLICY "Householders: read" ON public.householders FOR SELECT USING (
  NOT is_deleted AND NOT is_archived AND (
    -- Business householder access (existing logic)
    (establishment_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.business_establishments e, public.profiles me
      WHERE e.id = public.householders.establishment_id 
      AND me.id = auth.uid() 
      AND me.congregation_id = e.congregation_id
      AND NOT e.is_deleted
    ))
    OR
    -- Personal householder access (publisher owns it)
    (publisher_id IS NOT NULL AND publisher_id = auth.uid())
  )
);

-- New write policy: allow writes if:
-- 1. Business participant (existing logic) for business householders
-- 2. Publisher owns the householder for personal householders
CREATE POLICY "Householders: write" ON public.householders FOR ALL USING (
  NOT is_deleted AND (
    -- Business householder write (existing logic)
    (establishment_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.business_establishments e, public.business_participants bp, public.profiles me
      WHERE e.id = public.householders.establishment_id 
      AND bp.user_id = auth.uid() 
      AND me.id = auth.uid()
      AND bp.congregation_id = e.congregation_id 
      AND me.congregation_id = e.congregation_id 
      AND bp.active = true
      AND NOT e.is_deleted
    ))
    OR
    -- Personal householder write (publisher owns it)
    (publisher_id IS NOT NULL AND publisher_id = auth.uid())
  )
) WITH CHECK (
  -- Same logic for WITH CHECK
  NOT is_deleted AND (
    (establishment_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.business_establishments e, public.business_participants bp, public.profiles me
      WHERE e.id = public.householders.establishment_id 
      AND bp.user_id = auth.uid() 
      AND me.id = auth.uid()
      AND bp.congregation_id = e.congregation_id 
      AND me.congregation_id = e.congregation_id 
      AND bp.active = true
      AND NOT e.is_deleted
    ))
    OR
    (publisher_id IS NOT NULL AND publisher_id = auth.uid())
  )
);

-- Step 9: Update delete_householder function
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
  UPDATE public.householders
  SET 
    is_deleted = true,
    deleted_at = now(),
    deleted_by = deleted_by_user
  WHERE id = householder_id;
END;
$$;

-- Step 10: Add indexes for performance
CREATE INDEX IF NOT EXISTS householders_publisher_id_idx ON public.householders(publisher_id) WHERE publisher_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS householders_coordinates_idx ON public.householders(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Step 11: Update business_visits foreign key (it should auto-update, but verify)
-- The foreign key constraint name might need updating
DO $$ 
DECLARE
  old_constraint_name text;
  new_constraint_name text := 'business_visits_householder_id_fkey';
BEGIN
  -- Find the old constraint name
  SELECT conname INTO old_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.business_visits'::regclass
    AND confrelid = 'public.householders'::regclass
    AND contype = 'f';
  
  -- Rename if found and different
  IF old_constraint_name IS NOT NULL AND old_constraint_name != new_constraint_name THEN
    EXECUTE format('ALTER TABLE public.business_visits RENAME CONSTRAINT %I TO %I', old_constraint_name, new_constraint_name);
  END IF;
END $$;

-- Note: The old enum type business_householder_status_t can be dropped later if desired
-- But we'll leave it for now to avoid any potential issues
