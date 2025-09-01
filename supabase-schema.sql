-- Profiles table stores user basic info and role
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  middle_name text,
  date_of_birth date,
  date_of_baptism date,
  privileges text[] not null default '{}',
  avatar_url text,
  role text not null default 'user' check (role in ('user','admin','superadmin')),
  time_zone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- migrate existing schema if needed
alter table public.profiles
  add column if not exists date_of_birth date,
  add column if not exists avatar_url text,
  add column if not exists time_zone text;
-- Username (optional), unique case-insensitive
alter table public.profiles
  add column if not exists username text;
create unique index if not exists profiles_username_unique_ci on public.profiles (lower(username)) where username is not null;
alter table public.profiles
  drop column if exists age;
alter table public.profiles
  add column if not exists role text not null default 'user' check (role in ('user','admin','superadmin'));

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Reset all policies on profiles to avoid legacy recursion
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='profiles' loop
    execute format('drop policy if exists %I on public.profiles', p.policyname);
  end loop;
end $$;

-- Re-create minimal, non-recursive policies on profiles
create policy "Profiles: Read own" on public.profiles for select using (id = auth.uid());
create policy "Profiles: Insert own" on public.profiles for insert with check (id = auth.uid());
create policy "Profiles: Update own" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Admin users list (no RLS to avoid recursion in policies)
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users a where a.user_id = uid
  );
$$;

grant execute on function public.is_admin(uuid) to anon, authenticated;

-- Allow admins to read/write any profile
drop policy if exists "Profiles: Admin all" on public.profiles;
create policy "Profiles: Admin all" on public.profiles
  for all using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- (role change enforcement trigger is defined later together with congregation rules)

-- Monthly ministry records
create extension if not exists pgcrypto;

create table if not exists public.monthly_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  month text not null, -- YYYY-MM
  hours numeric not null default 0,
  bible_studies integer not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint month_format check (month ~ '^[0-9]{4}-[0-9]{2}$')
);

create unique index if not exists monthly_records_user_month_idx on public.monthly_records(user_id, month);

drop trigger if exists trg_month_records_updated_at on public.monthly_records;
create trigger trg_month_records_updated_at before update on public.monthly_records
for each row execute function public.set_updated_at();

alter table public.monthly_records enable row level security;

-- Owner policies
drop policy if exists "Monthly: Read own" on public.monthly_records;
create policy "Monthly: Read own" on public.monthly_records for select using (user_id = auth.uid());

drop policy if exists "Monthly: Write own" on public.monthly_records;
create policy "Monthly: Write own" on public.monthly_records for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Admin policies
drop policy if exists "Monthly: Admin read" on public.monthly_records;
create policy "Monthly: Admin read" on public.monthly_records
  for select using (public.is_admin(auth.uid()));

-- Daily field service records
create table if not exists public.daily_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null, -- YYYY-MM-DD
  hours numeric not null default 0,
  bible_studies text[] not null default '{}',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint date_not_future check (date <= (current_date + interval '1 day'))
);

create unique index if not exists daily_records_user_date_idx on public.daily_records(user_id, date);

drop trigger if exists trg_daily_records_updated_at on public.daily_records;
create trigger trg_daily_records_updated_at before update on public.daily_records
for each row execute function public.set_updated_at();

alter table public.daily_records enable row level security;

-- Owner policies for daily
drop policy if exists "Daily: Read own" on public.daily_records;
create policy "Daily: Read own" on public.daily_records for select using (user_id = auth.uid());

drop policy if exists "Daily: Write own" on public.daily_records;
create policy "Daily: Write own" on public.daily_records for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Admin read (optional)
drop policy if exists "Daily: Admin read" on public.daily_records;
create policy "Daily: Admin read" on public.daily_records for select using (public.is_admin(auth.uid()));

-- Auto-create a minimal profile row when a new auth.user is created
create or replace function public.handle_new_user()
returns trigger as $$
declare
  meta jsonb;
  given text;
  family text;
  full_name_str text;
  f text := '';
  l text := '';
  pic text;
  bdate text;
  dob date;
begin
  meta := new.raw_user_meta_data;
  given := coalesce(meta->>'given_name', meta->>'first_name');
  family := coalesce(meta->>'family_name', meta->>'last_name');
  full_name_str := coalesce(meta->>'name', meta->>'full_name');
  pic := meta->>'picture';
  bdate := coalesce(meta->>'birthdate', meta->>'dob');
  if bdate is not null and length(bdate) = 10 then
    begin
      dob := to_date(bdate, 'YYYY-MM-DD');
    exception when others then
      dob := null;
    end;
  end if;

  if given is not null and length(trim(given)) > 0 then
    f := trim(given);
  end if;
  if family is not null and length(trim(family)) > 0 then
    l := trim(family);
  end if;
  if (f = '' or l = '') and full_name_str is not null and length(trim(full_name_str)) > 0 then
    f := split_part(trim(full_name_str), ' ', 1);
    l := split_part(trim(full_name_str), ' ', array_length(string_to_array(trim(full_name_str), ' '), 1));
    if l = '' then l := f; end if;
  end if;

  insert into public.profiles (id, first_name, last_name, middle_name, date_of_birth, avatar_url)
  values (new.id, f, l, null, dob, pic)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RPC: get current user's profile (bypasses policy complexity via SECURITY DEFINER)
create or replace function public.get_my_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select p.* from public.profiles p where p.id = auth.uid();
$$;

grant execute on function public.get_my_profile() to anon, authenticated;

-- Remove legacy profile upsert RPCs (client uses table upsert under RLS)
do $$
begin
  begin
    drop function if exists public.upsert_my_profile_v2(text, text, text, date, date, text[], text, text, text);
  exception when undefined_function then null; end;
  begin
    drop function if exists public.upsert_my_profile(text, text, text, date, date, text[], text, text);
  exception when undefined_function then null; end;
  begin
    drop function if exists public.upsert_my_profile_v3(text, text, text, date, date, text[], text, text, text, public.gender_t, boolean, public.pioneer_t);
  exception when undefined_function then null; end;
end $$;

-- Lookup email by username to support username login
create or replace function public.get_email_by_username(u text)
returns text
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  uid uuid;
  em text;
begin
  select id into uid from public.profiles where lower(username) = lower(u) limit 1;
  if uid is null then
    return null;
  end if;
  select email into em from auth.users where id = uid;
  return em;
end;
$$;

grant execute on function public.get_email_by_username(text) to anon, authenticated;

-- RPC: is a username available (case-insensitive)?
create or replace function public.is_username_available(u text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles p
    where lower(p.username) = lower(u)
      and p.id <> auth.uid()
  );
$$;

grant execute on function public.is_username_available(text) to authenticated;

-- RPC: does current user have an email/password identity?
create or replace function public.has_password_auth()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from auth.identities i where i.user_id = auth.uid() and i.provider = 'email'
  );
$$;

grant execute on function public.has_password_auth() to authenticated;

-- RPC: does current user have a password set (encrypted_password not null)?
create or replace function public.has_encrypted_password()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(u.encrypted_password is not null, false)
  from auth.users u
  where u.id = auth.uid();
$$;

grant execute on function public.has_encrypted_password() to authenticated;

-- ==============================================
-- Congregations, roles, and eligibility rules
-- ==============================================

-- Enums
do $$ begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'gender_t' and n.nspname = 'public'
  ) then
    create type public.gender_t as enum ('male','female');
  end if;
end $$;

do $$ begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'pioneer_t' and n.nspname = 'public'
  ) then
    create type public.pioneer_t as enum ('none','auxiliary','regular');
  end if;
end $$;

do $$ begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'congregation_role_t' and n.nspname = 'public'
  ) then
    create type public.congregation_role_t as enum ('unbaptized_publisher','publisher','ministerial_servant','elder');
  end if;
end $$;

-- Congregations
create table if not exists public.congregations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  address text,
  -- Optional GPS coordinates for maps/directions
  lat numeric(9,6),
  lng numeric(9,6),
  -- 0=Sun,1=Mon,...,6=Sat
  midweek_day smallint not null check (midweek_day between 1 and 5),
  midweek_start time without time zone not null default '19:00',
  weekend_day smallint not null check (weekend_day in (0,6)),
  weekend_start time without time zone not null default '10:00',
  meeting_duration_minutes integer not null default 105,
  -- Feature flags
  business_witnessing_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_congregations_updated_at on public.congregations;
create trigger trg_congregations_updated_at before update on public.congregations
for each row execute function public.set_updated_at();

alter table public.congregations enable row level security;

-- Backfill-safe: add columns if not present (idempotent)
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='congregations' and column_name='lat'
  ) then
    alter table public.congregations add column lat numeric(9,6);
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='congregations' and column_name='lng'
  ) then
    alter table public.congregations add column lng numeric(9,6);
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='congregations' and column_name='business_witnessing_enabled'
  ) then
    alter table public.congregations add column business_witnessing_enabled boolean not null default false;
  end if;
end $$;

-- Extend profiles with congregation fields and constraints (must exist before policies below)
alter table public.profiles
  add column if not exists congregation_id uuid references public.congregations(id),
  add column if not exists gender public.gender_t;

-- Helpful index when scoping queries by congregation
create index if not exists profiles_congregation_idx on public.profiles(congregation_id);

-- Only members of a congregation (or admins) can read it
drop policy if exists "Congregations: Read own" on public.congregations;
create policy "Congregations: Read own" on public.congregations
  for select using (
    public.is_admin(auth.uid())
    or exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.congregation_id = public.congregations.id
    )
  );

-- Only admins can create/delete congregations; elders can update their own congregation
drop policy if exists "Congregations: Admin write" on public.congregations;
create policy "Congregations: Admin write" on public.congregations
  for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

drop policy if exists "Congregations: Elder update" on public.congregations;
create policy "Congregations: Elder update" on public.congregations
  for update using (
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid()
        and me.privileges @> array['Elder']::text[]
        and me.congregation_id = public.congregations.id
    )
  ) with check (
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid()
        and me.privileges @> array['Elder']::text[]
        and me.congregation_id = public.congregations.id
    )
  );
-- Eligibility rules (added NOT VALID to avoid breaking existing data before backfill)
-- Note: Postgres < 16 doesn't support IF NOT EXISTS on ADD CONSTRAINT, so
-- add them conditionally via a DO block for idempotency.
-- Remove legacy constraints/columns in favor of array-based privileges
do $$
begin
  -- Drop old constraints if present
  perform 1 from pg_constraint where conname = 'profiles_ck_pioneer_requires_baptized' and conrelid = 'public.profiles'::regclass;
  if found then alter table public.profiles drop constraint profiles_ck_pioneer_requires_baptized; end if;
  perform 1 from pg_constraint where conname = 'profiles_ck_role_requires_baptized' and conrelid = 'public.profiles'::regclass;
  if found then alter table public.profiles drop constraint profiles_ck_role_requires_baptized; end if;
  perform 1 from pg_constraint where conname = 'profiles_ck_ms_elder_male_baptized' and conrelid = 'public.profiles'::regclass;
  if found then alter table public.profiles drop constraint profiles_ck_ms_elder_male_baptized; end if;
  perform 1 from pg_constraint where conname = 'profiles_ck_unbap_no_pioneer' and conrelid = 'public.profiles'::regclass;
  if found then alter table public.profiles drop constraint profiles_ck_unbap_no_pioneer; end if;

  -- Drop redundant columns if they exist
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='baptized') then
    alter table public.profiles drop column baptized;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='pioneer_type') then
    alter table public.profiles drop column pioneer_type;
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='congregation_role') then
    alter table public.profiles drop column congregation_role;
  end if;
end $$;

-- New array-based privilege constraints
do $$
begin
  -- Allowed values only
  if not exists (
    select 1 from pg_constraint where conname='profiles_ck_privileges_allowed' and conrelid='public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_ck_privileges_allowed
    check (
      privileges <@ array['Elder','Ministerial Servant','Regular Pioneer','Auxiliary Pioneer','Secretary','Coordinator','Group Overseer']::text[]
    ) not valid;
  end if;

  -- Mutually exclusive: Regular vs Auxiliary Pioneer
  if not exists (
    select 1 from pg_constraint where conname='profiles_ck_pioneer_mutex' and conrelid='public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_ck_pioneer_mutex
    check (
      not (privileges @> array['Regular Pioneer']::text[] and privileges @> array['Auxiliary Pioneer']::text[])
    ) not valid;
  end if;

  -- Mutually exclusive: MS vs Elder
  if not exists (
    select 1 from pg_constraint where conname='profiles_ck_ms_elder_mutex' and conrelid='public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_ck_ms_elder_mutex
    check (
      not (privileges @> array['Ministerial Servant']::text[] and privileges @> array['Elder']::text[])
    ) not valid;
  end if;

  -- Elder-only privileges require Elder
  if not exists (
    select 1 from pg_constraint where conname='profiles_ck_elder_only_privs' and conrelid='public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_ck_elder_only_privs
    check (
      (not privileges @> array['Secretary']::text[] or privileges @> array['Elder']::text[]) and
      (not privileges @> array['Coordinator']::text[] or privileges @> array['Elder']::text[]) and
      (not privileges @> array['Group Overseer']::text[] or privileges @> array['Elder']::text[])
    ) not valid;
  end if;

  -- Male required for MS/Elder
  if not exists (
    select 1 from pg_constraint where conname='profiles_ck_male_required_for_ms_elder' and conrelid='public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_ck_male_required_for_ms_elder
    check (
      case when privileges @> array['Ministerial Servant']::text[] or privileges @> array['Elder']::text[] then gender = 'male'::public.gender_t else true end
    ) not valid;
  end if;
end $$;

-- Helper: is the caller an elder?
create or replace function public.is_elder(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p where p.id = uid and p.privileges @> array['Elder']::text[]
  );
$$;

grant execute on function public.is_elder(uuid) to anon, authenticated;

-- Helper: are two users in the same congregation?
create or replace function public.same_congregation(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(pa.congregation_id = pb.congregation_id, false)
  from public.profiles pa, public.profiles pb
  where pa.id = a and pb.id = b;
$$;

grant execute on function public.same_congregation(uuid, uuid) to anon, authenticated;

-- Helper: get my congregation id (avoids recursive self-joins in policies)
create or replace function public.my_congregation_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.congregation_id from public.profiles p where p.id = auth.uid();
$$;

grant execute on function public.my_congregation_id() to anon, authenticated;

-- Relax: drop strict gender requirement until data is backfilled
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'profiles_gender_required'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles drop constraint profiles_gender_required;
  end if;
end $$;

-- Tighten profile edit privileges: allow only admins or elders-in-congregation to change congregation_id / congregation_role
-- Simplify the trigger to avoid recursion
create or replace function public.enforce_privileges_update_privilege()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only allow admins to change privileges (role escalation)
  if new.privileges is distinct from old.privileges then
    if not public.is_admin(auth.uid()) then
      raise exception 'insufficient_privilege: cannot change privileges';
    end if;
  end if;
  
  -- For congregation changes, we'll rely on RLS policies instead of triggers
  -- This avoids the infinite recursion issue
  
  return new;
end;
$$;

-- Remove the old trigger
drop trigger if exists trg_profiles_enforce_role on public.profiles;
drop trigger if exists trg_profiles_enforce_privileges on public.profiles;

-- Create the simplified trigger
create trigger trg_profiles_enforce_privileges before update on public.profiles
for each row execute function public.enforce_privileges_update_privilege();

-- Profiles: Elders may read/update members in their congregation (admins handled separately)
-- IMPORTANT: Avoid recursive references to public.profiles inside its own policies.
-- Elder policies removed to fix "infinite recursion detected in policy for relation 'profiles'".
drop policy if exists "Profiles: Elder read congregation" on public.profiles;
drop policy if exists "Profiles: Elder update congregation" on public.profiles;

-- Monthly/Daily records: elders can read within congregation
drop policy if exists "Monthly: Elder read congregation" on public.monthly_records;
create policy "Monthly: Elder read congregation" on public.monthly_records
  for select using (
    public.is_elder(auth.uid()) and public.same_congregation(auth.uid(), public.monthly_records.user_id)
  );

drop policy if exists "Daily: Elder read congregation" on public.daily_records;
create policy "Daily: Elder read congregation" on public.daily_records
  for select using (
    public.is_elder(auth.uid()) and public.same_congregation(auth.uid(), public.daily_records.user_id)
  );

-- Ensure policies referencing public.profiles can be evaluated by the authenticated role
do $$ begin
  begin
    grant select on table public.profiles to authenticated;
  exception when others then null;
  end;
end $$;

-- RPC: move a user to a different congregation (elder or admin only)
create or replace function public.transfer_user_to_congregation(target_user uuid, new_congregation uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean;
  res public.profiles;
begin
  -- Ensure target congregation exists
  if not exists (select 1 from public.congregations c where c.id = new_congregation) then
    raise exception 'invalid_congregation';
  end if;

  -- Admins always allowed; elders only for their own congregation members
  select (
    public.is_admin(auth.uid())
    or exists (
      select 1 from public.profiles me, public.profiles p
      where me.id = auth.uid() and p.id = target_user
        and me.privileges @> array['Elder']::text[]
        and me.congregation_id = p.congregation_id
    )
  ) into allowed;

  if not coalesce(allowed, false) then
    raise exception 'insufficient_privilege: only an elder of the user''s current congregation or an admin may transfer';
  end if;

  update public.profiles set congregation_id = new_congregation, updated_at = now()
  where id = target_user
  returning * into res;
  return res;
end;
$$;

grant execute on function public.transfer_user_to_congregation(uuid, uuid) to authenticated;

-- RPC: fetch my congregation
create or replace function public.get_my_congregation()
returns public.congregations
language sql
stable
security definer
set search_path = public
as $$
  select c.* from public.congregations c
  join public.profiles p on p.congregation_id = c.id
  where p.id = auth.uid();
$$;

grant execute on function public.get_my_congregation() to authenticated;

-- ==============================================
-- Business Witnessing
-- ==============================================

-- Participants who can access the feature in a congregation
create table if not exists public.business_participants (
  congregation_id uuid not null references public.congregations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  active boolean not null default true,
  added_at timestamptz not null default now(),
  primary key (congregation_id, user_id)
);

-- Establishments tracked under a congregation
do $$ begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'business_establishment_status_t' and n.nspname = 'public'
  ) then
    create type public.business_establishment_status_t as enum (
      'for_scouting','for_follow_up','accepted_rack','declined_rack','has_bible_studies'
    );
  end if;
end $$;

-- Drop the existing table if it exists
DROP TABLE IF EXISTS public.business_establishments CASCADE;

-- Create the updated table with statuses array
CREATE TABLE public.business_establishments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  congregation_id uuid NOT NULL,
  name text NOT NULL,
  area text NULL,
  lat numeric(9, 6) NULL,
  lng numeric(9, 6) NULL,
  floor text NULL,
  statuses text[] NOT NULL DEFAULT ARRAY['for_scouting']::text[],
  note text NULL,
  created_by uuid NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  description text NULL,
  is_archived boolean NOT NULL DEFAULT false,
  archived_at timestamp with time zone NULL,
  archived_by uuid NULL,
  is_deleted boolean NOT NULL DEFAULT false,
  deleted_at timestamp with time zone NULL,
  deleted_by uuid NULL,
  CONSTRAINT business_establishments_pkey PRIMARY KEY (id),
  CONSTRAINT business_establishments_archived_by_fkey FOREIGN KEY (archived_by) REFERENCES profiles (id),
  CONSTRAINT business_establishments_congregation_id_fkey FOREIGN KEY (congregation_id) REFERENCES congregations (id) ON DELETE CASCADE,
  CONSTRAINT business_establishments_created_by_fkey FOREIGN KEY (created_by) REFERENCES profiles (id),
  CONSTRAINT business_establishments_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES profiles (id)
) TABLESPACE pg_default;

-- Create the updated trigger
CREATE TRIGGER trg_business_establishments_updated_at 
  BEFORE UPDATE ON business_establishments 
  FOR EACH ROW 
  EXECUTE FUNCTION set_updated_at();

-- Add RLS policies for the updated table
ALTER TABLE public.business_establishments ENABLE ROW LEVEL SECURITY;

-- Policy for users to see establishments in their congregation
CREATE POLICY "Users can view establishments in their congregation" ON public.business_establishments
  FOR SELECT USING (
    congregation_id IN (
      SELECT congregation_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy for users to insert establishments in their congregation
CREATE POLICY "Users can insert establishments in their congregation" ON public.business_establishments
  FOR INSERT WITH CHECK (
    congregation_id IN (
      SELECT congregation_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy for users to update establishments in their congregation
CREATE POLICY "Users can update establishments in their congregation" ON public.business_establishments
  FOR UPDATE USING (
    congregation_id IN (
      SELECT congregation_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy for users to delete establishments in their congregation
CREATE POLICY "Users can delete establishments in their congregation" ON public.business_establishments
  FOR DELETE USING (
    congregation_id IN (
      SELECT congregation_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Householders associated with an establishment
do $$ begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'business_householder_status_t' and n.nspname = 'public'
  ) then
    create type public.business_householder_status_t as enum (
      'interested','return_visit','bible_study','do_not_call'
    );
  end if;
end $$;

create table if not exists public.business_householders (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.business_establishments(id) on delete cascade,
  name text not null,
  status public.business_householder_status_t not null default 'interested',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_business_householders_updated_at on public.business_householders;
create trigger trg_business_householders_updated_at before update on public.business_householders
for each row execute function public.set_updated_at();

-- Visit updates applicable to either an establishment or a householder
create table if not exists public.business_visits (
  id uuid primary key default gen_random_uuid(),
  congregation_id uuid not null references public.congregations(id) on delete cascade,
  establishment_id uuid references public.business_establishments(id) on delete set null,
  householder_id uuid references public.business_householders(id) on delete set null,
  note text,
  publisher_id uuid references public.profiles(id),
  partner_id uuid references public.profiles(id),
  visit_date date not null default (current_date),
  created_at timestamptz not null default now()
);

-- RLS: members of congregation only
alter table public.business_participants enable row level security;
alter table public.business_establishments enable row level security;
alter table public.business_householders enable row level security;
alter table public.business_visits enable row level security;

drop policy if exists "Business: participants read" on public.business_participants;
create policy "Business: participants read" on public.business_participants
  for select using (
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.congregation_id = public.business_participants.congregation_id
    )
  );

drop policy if exists "Business: participants write" on public.business_participants;
create policy "Business: participants write" on public.business_participants
  for insert with check (
    public.is_admin(auth.uid())
  );

drop policy if exists "Business: est read" on public.business_establishments;
create policy "Business: est read" on public.business_establishments
  for select using (
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.congregation_id = public.business_establishments.congregation_id
    )
    and not public.business_establishments.is_deleted
  );

drop policy if exists "Business: est write" on public.business_establishments;
create policy "Business: est write" on public.business_establishments
  for all using (
    exists (
      select 1 from public.business_participants bp
      join public.profiles me on me.id = auth.uid()
      where bp.congregation_id = public.business_establishments.congregation_id
        and bp.user_id = auth.uid() and bp.active = true and me.congregation_id = bp.congregation_id
    )
  ) with check (
    exists (
      select 1 from public.business_participants bp
      join public.profiles me on me.id = auth.uid()
      where bp.congregation_id = public.business_establishments.congregation_id
        and bp.user_id = auth.uid() and bp.active = true and me.congregation_id = bp.congregation_id
    )
  );

drop policy if exists "Business: hh read" on public.business_householders;
create policy "Business: hh read" on public.business_householders
  for select using (
    exists (
      select 1 from public.business_establishments e, public.profiles me
      where e.id = public.business_householders.establishment_id and me.id = auth.uid() and me.congregation_id = e.congregation_id
    )
  );

drop policy if exists "Business: hh write" on public.business_householders;
create policy "Business: hh write" on public.business_householders
  for all using (
    exists (
      select 1 from public.business_establishments e, public.business_participants bp, public.profiles me
      where e.id = public.business_householders.establishment_id and bp.user_id = auth.uid() and me.id = auth.uid()
        and bp.congregation_id = e.congregation_id and me.congregation_id = e.congregation_id and bp.active = true
    )
  ) with check (
    exists (
      select 1 from public.business_establishments e, public.business_participants bp, public.profiles me
      where e.id = public.business_householders.establishment_id and bp.user_id = auth.uid() and me.id = auth.uid()
        and bp.congregation_id = e.congregation_id and me.congregation_id = e.congregation_id and bp.active = true
    )
  );

drop policy if exists "Business: visit read" on public.business_visits;
create policy "Business: visit read" on public.business_visits
  for select using (
    exists (
      select 1 from public.profiles me
      where me.id = auth.uid() and me.congregation_id = public.business_visits.congregation_id
    )
  );

drop policy if exists "Business: visit write" on public.business_visits;
create policy "Business: visit write" on public.business_visits
  for insert with check (
    exists (
      select 1 from public.business_participants bp, public.profiles me
      where bp.user_id = auth.uid() and me.id = auth.uid()
        and me.congregation_id = bp.congregation_id and bp.active = true
        and bp.congregation_id = public.business_visits.congregation_id
    )
  );

-- Helper RPCs
create or replace function public.is_business_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(c.business_witnessing_enabled, false)
  from public.profiles p
  left join public.congregations c on c.id = p.congregation_id
  where p.id = auth.uid();
$$;

grant execute on function public.is_business_enabled() to authenticated;

create or replace function public.is_business_participant()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.business_participants bp
    join public.profiles p on p.id = auth.uid()
    where bp.user_id = auth.uid() and bp.active = true and p.congregation_id = bp.congregation_id
  );
$$;

grant execute on function public.is_business_participant() to authenticated;

-- Legacy profile upsert RPCs removed; client performs table upsert under RLS

-- Function to toggle business participation for current user
create or replace function public.toggle_business_participation()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  user_congregation_id uuid;
  is_participant boolean;
begin
  -- Get user's congregation
  select congregation_id into user_congregation_id
  from public.profiles
  where id = auth.uid();
  
  if user_congregation_id is null then
    raise exception 'User not assigned to a congregation';
  end if;
  
  -- Check if user is already a participant
  select exists (
    select 1 from public.business_participants
    where user_id = auth.uid() 
    and congregation_id = user_congregation_id 
    and active = true
  ) into is_participant;
  
  if is_participant then
    -- Remove participation
    delete from public.business_participants
    where user_id = auth.uid() 
    and congregation_id = user_congregation_id;
    return false;
  else
    -- Add participation
    insert into public.business_participants (congregation_id, user_id, active)
    values (user_congregation_id, auth.uid(), true)
    on conflict (congregation_id, user_id) 
    do update set active = true;
    return true;
  end if;
end;
$$;

grant execute on function public.toggle_business_participation() to authenticated;

-- Add missing foreign key constraint for business_visits.establishment_id
ALTER TABLE public.business_visits 
ADD CONSTRAINT business_visits_establishment_id_fkey 
FOREIGN KEY (establishment_id) REFERENCES business_establishments (id) ON DELETE SET NULL;

-- Add missing foreign key constraint for business_householders.establishment_id
ALTER TABLE public.business_householders 
ADD CONSTRAINT business_householders_establishment_id_fkey 
FOREIGN KEY (establishment_id) REFERENCES business_establishments (id) ON DELETE CASCADE;
