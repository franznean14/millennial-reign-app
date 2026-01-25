-- ==============================================
-- Migration: Fix foreign key constraint names for calls table
-- ==============================================
-- This migration fixes the foreign key constraint names that weren't properly renamed
-- when the business_visits table was renamed to calls

DO $$ 
DECLARE
  constraint_rec record;
  new_name text;
BEGIN
  -- Find and rename all foreign key constraints on the calls table
  FOR constraint_rec IN
    SELECT 
      conname as old_name,
      conrelid::regclass::text as table_name,
      a.attname as column_name,
      confrelid::regclass::text as referenced_table
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE conrelid = 'public.calls'::regclass
      AND contype = 'f'
      AND conname LIKE '%business_visits%'
  LOOP
    -- Generate new constraint name based on column and referenced table
    IF constraint_rec.column_name = 'congregation_id' THEN
      new_name := 'calls_congregation_id_fkey';
    ELSIF constraint_rec.column_name = 'establishment_id' THEN
      new_name := 'calls_establishment_id_fkey';
    ELSIF constraint_rec.column_name = 'householder_id' THEN
      new_name := 'calls_householder_id_fkey';
    ELSIF constraint_rec.column_name = 'publisher_id' THEN
      new_name := 'calls_publisher_id_fkey';
    ELSIF constraint_rec.column_name = 'partner_id' THEN
      new_name := 'calls_partner_id_fkey';
    ELSE
      -- Generic fallback
      new_name := 'calls_' || constraint_rec.column_name || '_fkey';
    END IF;
    
    -- Only rename if the name is different
    IF constraint_rec.old_name != new_name THEN
      EXECUTE format('ALTER TABLE public.calls RENAME CONSTRAINT %I TO %I', constraint_rec.old_name, new_name);
      RAISE NOTICE 'Renamed constraint % to %', constraint_rec.old_name, new_name;
    END IF;
  END LOOP;
END $$;

-- Verify all constraints have been renamed
DO $$
DECLARE
  remaining_count integer;
BEGIN
  SELECT COUNT(*) INTO remaining_count
  FROM pg_constraint
  WHERE conrelid = 'public.calls'::regclass
    AND contype = 'f'
    AND conname LIKE '%business_visits%';
  
  IF remaining_count > 0 THEN
    RAISE WARNING 'There are still % foreign key constraints with old names', remaining_count;
  ELSE
    RAISE NOTICE 'All foreign key constraints have been renamed successfully';
  END IF;
END $$;
