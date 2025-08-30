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

-- Legacy profile upsert RPCs removed; client performs table upsert under RLS
