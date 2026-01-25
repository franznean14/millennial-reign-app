-- ==============================================
-- Migration: Rename business_visits table to calls
-- ==============================================

-- Step 1: Rename the table
ALTER TABLE public.business_visits RENAME TO calls;

-- Step 2: Rename foreign key constraints
DO $$ 
DECLARE
  old_constraint_name text;
  new_constraint_name text;
BEGIN
  -- Rename congregation_id foreign key
  SELECT conname INTO old_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.calls'::regclass
    AND confrelid = 'public.congregations'::regclass
    AND contype = 'f'
    AND conkey::text LIKE '%1%'; -- congregation_id is first column
  
  IF old_constraint_name IS NOT NULL THEN
    new_constraint_name := 'calls_congregation_id_fkey';
    IF old_constraint_name != new_constraint_name THEN
      EXECUTE format('ALTER TABLE public.calls RENAME CONSTRAINT %I TO %I', old_constraint_name, new_constraint_name);
    END IF;
  END IF;

  -- Rename establishment_id foreign key
  SELECT conname INTO old_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.calls'::regclass
    AND confrelid = 'public.business_establishments'::regclass
    AND contype = 'f';
  
  IF old_constraint_name IS NOT NULL THEN
    new_constraint_name := 'calls_establishment_id_fkey';
    IF old_constraint_name != new_constraint_name THEN
      EXECUTE format('ALTER TABLE public.calls RENAME CONSTRAINT %I TO %I', old_constraint_name, new_constraint_name);
    END IF;
  END IF;

  -- Rename householder_id foreign key
  SELECT conname INTO old_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.calls'::regclass
    AND confrelid = 'public.householders'::regclass
    AND contype = 'f';
  
  IF old_constraint_name IS NOT NULL THEN
    new_constraint_name := 'calls_householder_id_fkey';
    IF old_constraint_name != new_constraint_name THEN
      EXECUTE format('ALTER TABLE public.calls RENAME CONSTRAINT %I TO %I', old_constraint_name, new_constraint_name);
    END IF;
  END IF;

  -- Rename publisher_id foreign key
  SELECT conname INTO old_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.calls'::regclass
    AND confrelid = 'public.profiles'::regclass
    AND contype = 'f'
    AND (conkey::text LIKE '%4%' OR conkey::text LIKE '%5%'); -- publisher_id or partner_id
  
  IF old_constraint_name IS NOT NULL AND old_constraint_name LIKE '%publisher%' THEN
    new_constraint_name := 'calls_publisher_id_fkey';
    IF old_constraint_name != new_constraint_name THEN
      EXECUTE format('ALTER TABLE public.calls RENAME CONSTRAINT %I TO %I', old_constraint_name, new_constraint_name);
    END IF;
  END IF;

  -- Rename partner_id foreign key
  IF old_constraint_name IS NOT NULL AND old_constraint_name LIKE '%partner%' THEN
    new_constraint_name := 'calls_partner_id_fkey';
    IF old_constraint_name != new_constraint_name THEN
      EXECUTE format('ALTER TABLE public.calls RENAME CONSTRAINT %I TO %I', old_constraint_name, new_constraint_name);
    END IF;
  END IF;
END $$;

-- Step 3: Rename RLS policies
DROP POLICY IF EXISTS "Business: visit read" ON public.calls;
CREATE POLICY "Business: visit read" ON public.calls FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.congregation_id = public.calls.congregation_id)
);

DROP POLICY IF EXISTS "Business: visit write" ON public.calls;
CREATE POLICY "Business: visit write" ON public.calls FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.business_participants bp, public.profiles me
    WHERE bp.user_id = auth.uid() AND me.id = auth.uid()
    AND me.congregation_id = bp.congregation_id AND bp.active = true
    AND bp.congregation_id = public.calls.congregation_id
  )
);

DROP POLICY IF EXISTS "Business: visit update" ON public.calls;
CREATE POLICY "Business: visit update" ON public.calls FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.business_participants bp, public.profiles me
    WHERE bp.user_id = auth.uid() AND me.id = auth.uid()
    AND me.congregation_id = bp.congregation_id AND bp.active = true
    AND bp.congregation_id = public.calls.congregation_id
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.business_participants bp, public.profiles me
    WHERE bp.user_id = auth.uid() AND me.id = auth.uid()
    AND me.congregation_id = bp.congregation_id AND bp.active = true
    AND bp.congregation_id = public.calls.congregation_id
  )
);

DROP POLICY IF EXISTS "Business: visit delete" ON public.calls;
CREATE POLICY "Business: visit delete" ON public.calls FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.business_participants bp, public.profiles me
    WHERE bp.user_id = auth.uid() AND me.id = auth.uid()
    AND me.congregation_id = bp.congregation_id AND bp.active = true
    AND bp.congregation_id = public.calls.congregation_id
  )
);

-- Step 4: Update any indexes (if they reference the table name)
-- Note: Index names typically don't need to change, but we'll check for any that do

-- Step 5: Verify the table was renamed successfully
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'calls') THEN
    RAISE EXCEPTION 'Table calls was not created successfully';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'business_visits') THEN
    RAISE EXCEPTION 'Old table business_visits still exists';
  END IF;
END $$;
