-- ==============================================
-- Millennial Reign App - Safe Database Schema
-- Can be run multiple times without data loss
-- ==============================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==============================================
-- Core Functions
-- ==============================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- Enums
-- ==============================================

DO $$ BEGIN
  CREATE TYPE public.gender_t AS ENUM ('male','female');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.business_establishment_status_t AS ENUM (
    'for_scouting','for_follow_up','accepted_rack','declined_rack','has_bible_studies'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.business_householder_status_t AS ENUM (
    'interested','return_visit','bible_study','do_not_call'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ==============================================
-- Tables
-- ==============================================

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  middle_name text,
  date_of_birth date,
  date_of_baptism date,
  privileges text[] NOT NULL DEFAULT '{}',
  avatar_url text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin','superadmin')),
  time_zone text,
  username text,
  congregation_id uuid,
  gender public.gender_t,
  group_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add columns if they don't exist (safe for existing tables)
DO $$ BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS group_name text;
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Username unique index
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_ci 
ON public.profiles (lower(username)) WHERE username IS NOT NULL;

-- Congregation index
CREATE INDEX IF NOT EXISTS profiles_congregation_idx ON public.profiles(congregation_id);

-- Group index
CREATE INDEX IF NOT EXISTS profiles_group_idx ON public.profiles(group_name);

-- Admin users
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Congregations
CREATE TABLE IF NOT EXISTS public.congregations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  address text,
  lat numeric(9,6),
  lng numeric(9,6),
  midweek_day smallint NOT NULL CHECK (midweek_day BETWEEN 1 AND 5),
  midweek_start time WITHOUT TIME ZONE NOT NULL DEFAULT '19:00',
  weekend_day smallint NOT NULL CHECK (weekend_day IN (0,6)),
  weekend_start time WITHOUT TIME ZONE NOT NULL DEFAULT '10:00',
  meeting_duration_minutes integer NOT NULL DEFAULT 105,
  business_witnessing_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Monthly records
CREATE TABLE IF NOT EXISTS public.monthly_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month text NOT NULL CHECK (month ~ '^[0-9]{4}-[0-9]{2}$'),
  hours numeric NOT NULL DEFAULT 0,
  bible_studies integer NOT NULL DEFAULT 0,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS monthly_records_user_month_idx 
ON public.monthly_records(user_id, month);

-- Daily records
CREATE TABLE IF NOT EXISTS public.daily_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date date NOT NULL CHECK (date <= (CURRENT_DATE + INTERVAL '1 day')),
  hours numeric NOT NULL DEFAULT 0,
  bible_studies text[] NOT NULL DEFAULT '{}',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS daily_records_user_date_idx 
ON public.daily_records(user_id, date);

-- Business participants
CREATE TABLE IF NOT EXISTS public.business_participants (
  congregation_id uuid NOT NULL REFERENCES public.congregations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (congregation_id, user_id)
);

-- Business establishments
CREATE TABLE IF NOT EXISTS public.business_establishments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  congregation_id uuid NOT NULL REFERENCES public.congregations(id) ON DELETE CASCADE,
  name text NOT NULL,
  area text,
  lat numeric(9,6),
  lng numeric(9,6),
  floor text,
  statuses text[] NOT NULL DEFAULT ARRAY['for_scouting']::text[],
  note text,
  description text,
  created_by uuid REFERENCES public.profiles(id),
  archived_by uuid REFERENCES public.profiles(id),
  deleted_by uuid REFERENCES public.profiles(id),
  is_archived boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add columns if they don't exist
DO $$ BEGIN
  ALTER TABLE public.business_establishments ADD COLUMN IF NOT EXISTS statuses text[] NOT NULL DEFAULT ARRAY['for_scouting']::text[];
EXCEPTION
  WHEN duplicate_column THEN null;
END $$;

-- Business householders
CREATE TABLE IF NOT EXISTS public.business_householders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.business_establishments(id) ON DELETE CASCADE,
  name text NOT NULL,
  status public.business_householder_status_t NOT NULL DEFAULT 'interested',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Business visits
CREATE TABLE IF NOT EXISTS public.business_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  congregation_id uuid NOT NULL REFERENCES public.congregations(id) ON DELETE CASCADE,
  establishment_id uuid REFERENCES public.business_establishments(id) ON DELETE SET NULL,
  householder_id uuid REFERENCES public.business_householders(id) ON DELETE SET NULL,
  note text,
  publisher_id uuid REFERENCES public.profiles(id),
  partner_id uuid REFERENCES public.profiles(id),
  visit_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================================
-- Triggers
-- ==============================================

-- Profiles updated_at trigger
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at 
  BEFORE UPDATE ON public.profiles 
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Congregations updated_at trigger
DROP TRIGGER IF EXISTS trg_congregations_updated_at ON public.congregations;
CREATE TRIGGER trg_congregations_updated_at 
  BEFORE UPDATE ON public.congregations 
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Monthly records updated_at trigger
DROP TRIGGER IF EXISTS trg_monthly_records_updated_at ON public.monthly_records;
CREATE TRIGGER trg_monthly_records_updated_at 
  BEFORE UPDATE ON public.monthly_records 
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Daily records updated_at trigger
DROP TRIGGER IF EXISTS trg_daily_records_updated_at ON public.daily_records;
CREATE TRIGGER trg_daily_records_updated_at 
  BEFORE UPDATE ON public.daily_records 
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Business establishments updated_at trigger
DROP TRIGGER IF EXISTS trg_business_establishments_updated_at ON public.business_establishments;
CREATE TRIGGER trg_business_establishments_updated_at 
  BEFORE UPDATE ON public.business_establishments 
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Business householders updated_at trigger
DROP TRIGGER IF EXISTS trg_business_householders_updated_at ON public.business_householders;
CREATE TRIGGER trg_business_householders_updated_at 
  BEFORE UPDATE ON public.business_householders 
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on auth.user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  meta jsonb;
  given text;
  family text;
  full_name_str text;
  f text := '';
  l text := '';
  pic text;
  bdate text;
  dob date;
BEGIN
  meta := NEW.raw_user_meta_data;
  given := COALESCE(meta->>'given_name', meta->>'first_name');
  family := COALESCE(meta->>'family_name', meta->>'last_name');
  full_name_str := COALESCE(meta->>'name', meta->>'full_name');
  pic := meta->>'picture';
  bdate := COALESCE(meta->>'birthdate', meta->>'dob');
  
  IF bdate IS NOT NULL AND length(bdate) = 10 THEN
    BEGIN
      dob := to_date(bdate, 'YYYY-MM-DD');
    EXCEPTION WHEN others THEN
      dob := null;
    END;
  END IF;

  IF given IS NOT NULL AND length(trim(given)) > 0 THEN
    f := trim(given);
  END IF;
  IF family IS NOT NULL AND length(trim(family)) > 0 THEN
    l := trim(family);
  END IF;
  IF (f = '' OR l = '') AND full_name_str IS NOT NULL AND length(trim(full_name_str)) > 0 THEN
    f := split_part(trim(full_name_str), ' ', 1);
    l := split_part(trim(full_name_str), ' ', array_length(string_to_array(trim(full_name_str), ' '), 1));
    IF l = '' THEN l := f; END IF;
  END IF;

  INSERT INTO public.profiles (id, first_name, last_name, middle_name, date_of_birth, avatar_url)
  VALUES (NEW.id, f, l, null, dob, pic)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================
-- Constraints
-- ==============================================

-- Profiles privileges constraints
DO $$
BEGIN
  -- Drop existing constraints if they exist
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_ck_privileges_allowed' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_ck_privileges_allowed;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_ck_pioneer_mutex' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_ck_pioneer_mutex;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_ck_ms_elder_mutex' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_ck_ms_elder_mutex;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_ck_elder_only_privs' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_ck_elder_only_privs;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_ck_male_required_for_ms_elder' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_ck_male_required_for_ms_elder;
  END IF;

  -- Add new constraints
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_ck_privileges_allowed
  CHECK (privileges <@ array['Elder','Ministerial Servant','Regular Pioneer','Auxiliary Pioneer','Secretary','Coordinator','Group Overseer','Group Assistant']::text[]) NOT VALID;

  ALTER TABLE public.profiles ADD CONSTRAINT profiles_ck_pioneer_mutex
  CHECK (NOT (privileges @> array['Regular Pioneer']::text[] AND privileges @> array['Auxiliary Pioneer']::text[])) NOT VALID;

  ALTER TABLE public.profiles ADD CONSTRAINT profiles_ck_ms_elder_mutex
  CHECK (NOT (privileges @> array['Ministerial Servant']::text[] AND privileges @> array['Elder']::text[])) NOT VALID;

  ALTER TABLE public.profiles ADD CONSTRAINT profiles_ck_elder_only_privs
  CHECK (
    (NOT privileges @> array['Secretary']::text[] OR privileges @> array['Elder']::text[]) AND
    (NOT privileges @> array['Coordinator']::text[] OR privileges @> array['Elder']::text[]) AND
    (NOT privileges @> array['Group Overseer']::text[] OR privileges @> array['Elder']::text[])
  ) NOT VALID;

  ALTER TABLE public.profiles ADD CONSTRAINT profiles_ck_male_required_for_ms_elder
  CHECK (
    CASE WHEN privileges @> array['Ministerial Servant']::text[] OR privileges @> array['Elder']::text[] 
    THEN gender = 'male'::public.gender_t ELSE true END
  ) NOT VALID;
END $$;

-- ==============================================
-- Row Level Security
-- ==============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.congregations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_establishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_householders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_visits ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- RLS Policies
-- ==============================================

-- Profiles policies
DROP POLICY IF EXISTS "Profiles: Read own" ON public.profiles;
CREATE POLICY "Profiles: Read own" ON public.profiles FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "Profiles: Insert own" ON public.profiles;
CREATE POLICY "Profiles: Insert own" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Profiles: Update own" ON public.profiles;
CREATE POLICY "Profiles: Update own" ON public.profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Profiles: Admin all" ON public.profiles;
CREATE POLICY "Profiles: Admin all" ON public.profiles FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Congregations policies
DROP POLICY IF EXISTS "Congregations: Read own" ON public.congregations;
CREATE POLICY "Congregations: Read own" ON public.congregations FOR SELECT USING (
  public.is_admin(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.congregation_id = public.congregations.id
  )
);

DROP POLICY IF EXISTS "Congregations: Admin write" ON public.congregations;
CREATE POLICY "Congregations: Admin write" ON public.congregations FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Congregations: Elder update" ON public.congregations;
CREATE POLICY "Congregations: Elder update" ON public.congregations FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() 
    AND me.privileges @> array['Elder']::text[] AND me.congregation_id = public.congregations.id
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() 
    AND me.privileges @> array['Elder']::text[] AND me.congregation_id = public.congregations.id
  )
);

-- Monthly records policies
DROP POLICY IF EXISTS "Monthly: Read own" ON public.monthly_records;
CREATE POLICY "Monthly: Read own" ON public.monthly_records FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Monthly: Write own" ON public.monthly_records;
CREATE POLICY "Monthly: Write own" ON public.monthly_records FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Monthly: Admin read" ON public.monthly_records;
CREATE POLICY "Monthly: Admin read" ON public.monthly_records FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Monthly: Elder read congregation" ON public.monthly_records;
CREATE POLICY "Monthly: Elder read congregation" ON public.monthly_records FOR SELECT USING (
  public.is_elder(auth.uid()) AND public.same_congregation(auth.uid(), public.monthly_records.user_id)
);

-- Daily records policies
DROP POLICY IF EXISTS "Daily: Read own" ON public.daily_records;
CREATE POLICY "Daily: Read own" ON public.daily_records FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Daily: Write own" ON public.daily_records;
CREATE POLICY "Daily: Write own" ON public.daily_records FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Daily: Admin read" ON public.daily_records;
CREATE POLICY "Daily: Admin read" ON public.daily_records FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Daily: Elder read congregation" ON public.daily_records;
CREATE POLICY "Daily: Elder read congregation" ON public.daily_records FOR SELECT USING (
  public.is_elder(auth.uid()) AND public.is_elder(auth.uid()) AND public.same_congregation(auth.uid(), public.daily_records.user_id)
);

-- Business policies
DROP POLICY IF EXISTS "Business: participants read" ON public.business_participants;
CREATE POLICY "Business: participants read" ON public.business_participants FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.congregation_id = public.business_participants.congregation_id)
);

DROP POLICY IF EXISTS "Business: participants write" ON public.business_participants;
CREATE POLICY "Business: participants write" ON public.business_participants FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Business: est read" ON public.business_establishments;
CREATE POLICY "Business: est read" ON public.business_establishments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.congregation_id = public.business_establishments.congregation_id)
  AND NOT public.business_establishments.is_deleted
);

DROP POLICY IF EXISTS "Business: est write" ON public.business_establishments;
CREATE POLICY "Business: est write" ON public.business_establishments FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.business_participants bp JOIN public.profiles me ON me.id = auth.uid()
    WHERE bp.congregation_id = public.business_establishments.congregation_id
    AND bp.user_id = auth.uid() AND bp.active = true AND me.congregation_id = bp.congregation_id
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.business_participants bp JOIN public.profiles me ON me.id = auth.uid()
    WHERE bp.congregation_id = public.business_establishments.congregation_id
    AND bp.user_id = auth.uid() AND bp.active = true AND me.congregation_id = bp.congregation_id
  )
);

DROP POLICY IF EXISTS "Business: hh read" ON public.business_householders;
CREATE POLICY "Business: hh read" ON public.business_householders FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.business_establishments e, public.profiles me
    WHERE e.id = public.business_householders.establishment_id AND me.id = auth.uid() AND me.congregation_id = e.congregation_id
  )
);

DROP POLICY IF EXISTS "Business: hh write" ON public.business_householders;
CREATE POLICY "Business: hh write" ON public.business_householders FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.business_establishments e, public.business_participants bp, public.profiles me
    WHERE e.id = public.business_householders.establishment_id AND bp.user_id = auth.uid() AND me.id = auth.uid()
    AND bp.congregation_id = e.congregation_id AND me.congregation_id = e.congregation_id AND bp.active = true
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.business_establishments e, public.business_participants bp, public.profiles me
    WHERE e.id = public.business_householders.establishment_id AND bp.user_id = auth.uid() AND me.id = auth.uid()
    AND bp.congregation_id = e.congregation_id AND me.congregation_id = e.congregation_id AND bp.active = true
  )
);

DROP POLICY IF EXISTS "Business: visit read" ON public.business_visits;
CREATE POLICY "Business: visit read" ON public.business_visits FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.congregation_id = public.business_visits.congregation_id)
);

DROP POLICY IF EXISTS "Business: visit write" ON public.business_visits;
CREATE POLICY "Business: visit write" ON public.business_visits FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.business_participants bp, public.profiles me
    WHERE bp.user_id = auth.uid() AND me.id = auth.uid()
    AND me.congregation_id = bp.congregation_id AND bp.active = true
    AND bp.congregation_id = public.business_visits.congregation_id
  )
);

-- ==============================================
-- Helper Functions
-- ==============================================

-- Admin check
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = uid);
$$;

GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon, authenticated;

-- Elder check
CREATE OR REPLACE FUNCTION public.is_elder(uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = uid AND p.privileges @> array['Elder']::text[]);
$$;

GRANT EXECUTE ON FUNCTION public.is_elder(uuid) TO anon, authenticated;

-- Same congregation check
CREATE OR REPLACE FUNCTION public.same_congregation(a uuid, b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(pa.congregation_id = pb.congregation_id, false)
  FROM public.profiles pa, public.profiles pb WHERE pa.id = a AND pb.id = b;
$$;

GRANT EXECUTE ON FUNCTION public.same_congregation(uuid, uuid) TO anon, authenticated;

-- My congregation ID
CREATE OR REPLACE FUNCTION public.my_congregation_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.congregation_id FROM public.profiles p WHERE p.id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.my_congregation_id() TO anon, authenticated;

-- Get my profile
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS public.profiles LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.* FROM public.profiles p WHERE p.id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_profile() TO anon, authenticated;

-- Username functions
CREATE OR REPLACE FUNCTION public.get_email_by_username(u text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  uid uuid;
  em text;
BEGIN
  SELECT id INTO uid FROM public.profiles WHERE lower(username) = lower(u) LIMIT 1;
  IF uid IS NULL THEN RETURN NULL; END IF;
  SELECT email INTO em FROM auth.users WHERE id = uid;
  RETURN em;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_email_by_username(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_username_available(u text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE lower(p.username) = lower(u) AND p.id <> auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO authenticated;

-- Auth functions
CREATE OR REPLACE FUNCTION public.has_password_auth()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT EXISTS (SELECT 1 FROM auth.identities i WHERE i.user_id = auth.uid() AND i.provider = 'email');
$$;

GRANT EXECUTE ON FUNCTION public.has_password_auth() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.has_encrypted_password()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT COALESCE(u.encrypted_password IS NOT NULL, false) FROM auth.users u WHERE u.id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.has_encrypted_password() TO anon, authenticated;

-- Congregation functions
CREATE OR REPLACE FUNCTION public.transfer_user_to_congregation(target_user uuid, new_congregation uuid)
RETURNS public.profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  allowed boolean;
  res public.profiles;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.congregations c WHERE c.id = new_congregation) THEN
    RAISE EXCEPTION 'invalid_congregation';
  END IF;

  SELECT (
    public.is_admin(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.profiles me, public.profiles p
      WHERE me.id = auth.uid() AND p.id = target_user
      AND me.privileges @> array['Elder']::text[] AND me.congregation_id = p.congregation_id
    )
  ) INTO allowed;

  IF NOT COALESCE(allowed, false) THEN
    RAISE EXCEPTION 'insufficient_privilege: only an elder of the user''s current congregation or an admin may transfer';
  END IF;

  UPDATE public.profiles SET congregation_id = new_congregation, updated_at = now()
  WHERE id = target_user RETURNING * INTO res;
  RETURN res;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_user_to_congregation(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_congregation()
RETURNS public.congregations LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT c.* FROM public.congregations c JOIN public.profiles p ON p.id = c.id WHERE p.id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_congregation() TO authenticated;

-- Business functions
CREATE OR REPLACE FUNCTION public.is_business_enabled()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(c.business_witnessing_enabled, false)
  FROM public.profiles p LEFT JOIN public.congregations c ON c.id = p.congregation_id WHERE p.id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.is_business_enabled() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_business_participant()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_participants bp JOIN public.profiles p ON p.id = auth.uid()
    WHERE bp.user_id = auth.uid() AND bp.active = true AND p.congregation_id = bp.congregation_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_business_participant() TO authenticated;

CREATE OR REPLACE FUNCTION public.toggle_business_participation()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_congregation_id uuid;
  is_participant boolean;
BEGIN
  SELECT congregation_id INTO user_congregation_id FROM public.profiles WHERE id = auth.uid();
  IF user_congregation_id IS NULL THEN RAISE EXCEPTION 'User not assigned to a congregation'; END IF;
  
  SELECT EXISTS (
    SELECT 1 FROM public.business_participants
    WHERE user_id = auth.uid() AND congregation_id = user_congregation_id AND active = true
  ) INTO is_participant;
  
  IF is_participant THEN
    DELETE FROM public.business_participants WHERE user_id = auth.uid() AND congregation_id = user_congregation_id;
    RETURN false;
  ELSE
    INSERT INTO public.business_participants (congregation_id, user_id, active)
    VALUES (user_congregation_id, auth.uid(), true)
    ON CONFLICT (congregation_id, user_id) DO UPDATE SET active = true;
    RETURN true;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_business_participation() TO authenticated;

-- Group functions
CREATE OR REPLACE FUNCTION public.get_users_by_group(group_name_param text)
RETURNS TABLE (
  id uuid, first_name text, last_name text, avatar_url text, privileges text[], congregation_id uuid
) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.first_name, p.last_name, p.avatar_url, p.privileges, p.congregation_id
  FROM public.profiles p
  WHERE p.group_name = group_name_param AND p.congregation_id = public.my_congregation_id()
  ORDER BY 
    CASE 
      WHEN p.privileges @> array['Group Overseer']::text[] THEN 1
      WHEN p.privileges @> array['Group Assistant']::text[] THEN 2
      ELSE 3
    END,
    p.last_name, p.first_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_users_by_group(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_congregation_groups()
RETURNS TABLE (
  group_name text, member_count bigint, overseer_name text, assistant_name text
) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT 
    p.group_name, COUNT(*) as member_count,
    MAX(CASE WHEN p.privileges @> array['Group Overseer']::text[] THEN p.first_name || ' ' || p.last_name END) as overseer_name,
    MAX(CASE WHEN p.privileges @> array['Group Assistant']::text[] THEN p.first_name || ' ' || p.last_name END) as assistant_name
  FROM public.profiles p
  WHERE p.group_name IS NOT NULL AND p.congregation_id = public.my_congregation_id()
  GROUP BY p.group_name ORDER BY p.group_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_congregation_groups() TO authenticated;

-- ==============================================
-- Grants
-- ==============================================

GRANT SELECT ON TABLE public.profiles TO authenticated;
