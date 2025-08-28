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

-- Allow users to select their own profile
drop policy if exists "Profiles: Read own" on public.profiles;
create policy "Profiles: Read own" on public.profiles
  for select using (id = auth.uid());

-- Allow users to insert their own profile (first row)
drop policy if exists "Profiles: Insert own" on public.profiles;
create policy "Profiles: Insert own" on public.profiles
  for insert with check (id = auth.uid());

-- Allow users to update their own profile but not escalate role
-- Allow users to update their own profile
drop policy if exists "Profiles: Update own" on public.profiles;
create policy "Profiles: Update own" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

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

-- Prevent non-admins from changing the role column
create or replace function public.enforce_role_update_privilege()
returns trigger as $$
begin
  if new.role is distinct from old.role then
    if not public.is_admin(auth.uid()) then
      raise exception 'insufficient_privilege: cannot change role';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_profiles_enforce_role on public.profiles;
create trigger trg_profiles_enforce_role before update on public.profiles
for each row execute function public.enforce_role_update_privilege();

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

-- RPC: upsert current user's profile (no role changes)
create or replace function public.upsert_my_profile(
  first_name text,
  last_name text,
  middle_name text,
  date_of_birth date,
  date_of_baptism date,
  privileges text[],
  avatar_url text,
  time_zone text
)
returns public.profiles
language sql
security definer
set search_path = public
as $$
  insert into public.profiles (id, first_name, last_name, middle_name, date_of_birth, date_of_baptism, privileges, avatar_url, time_zone)
  values (
    auth.uid(),
    coalesce(first_name, ''),
    coalesce(last_name, ''),
    nullif(middle_name, ''),
    date_of_birth,
    date_of_baptism,
    coalesce(privileges, '{}'),
    nullif(avatar_url, ''),
    nullif(time_zone, '')
  )
  on conflict (id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    middle_name = excluded.middle_name,
    date_of_birth = excluded.date_of_birth,
    date_of_baptism = excluded.date_of_baptism,
    privileges = excluded.privileges,
    avatar_url = excluded.avatar_url,
    time_zone = excluded.time_zone,
    updated_at = now()
  returning *;
$$;

grant execute on function public.upsert_my_profile(text, text, text, date, date, text[], text, text) to authenticated;

-- v2 function name to avoid schema cache issues in clients
create or replace function public.upsert_my_profile_v2(
  first_name text,
  last_name text,
  middle_name text,
  date_of_birth date,
  date_of_baptism date,
  privileges text[],
  avatar_url text,
  time_zone text,
  username text
)
returns public.profiles
language sql
security definer
set search_path = public
as $$
  insert into public.profiles (id, first_name, last_name, middle_name, date_of_birth, date_of_baptism, privileges, avatar_url, time_zone, username)
  values (
    auth.uid(),
    coalesce(first_name, ''),
    coalesce(last_name, ''),
    nullif(middle_name, ''),
    date_of_birth,
    date_of_baptism,
    coalesce(privileges, '{}'),
    nullif(avatar_url, ''),
    nullif(time_zone, ''),
    nullif(username, '')
  )
  on conflict (id) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    middle_name = excluded.middle_name,
    date_of_birth = excluded.date_of_birth,
    date_of_baptism = excluded.date_of_baptism,
    privileges = excluded.privileges,
    avatar_url = excluded.avatar_url,
    time_zone = excluded.time_zone,
    username = excluded.username,
    updated_at = now()
  returning *;
$$;

grant execute on function public.upsert_my_profile_v2(text, text, text, date, date, text[], text, text, text) to authenticated;

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
