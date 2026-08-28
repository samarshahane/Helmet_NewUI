-- Enable UUID extension if not enabled
create extension if not exists "uuid-ossp";

-- 1. Profiles Table (linked to auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  role text not null check (role in ('admin', 'officer')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Profiles
alter table public.profiles enable row level security;

create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- 2. Officers Table (linked to profiles)
create table public.officers (
  id uuid references public.profiles(id) on delete cascade primary key,
  name text not null,
  badge_id text not null unique,
  role text not null default 'officer' check (role = 'officer'),
  status text not null default 'inactive' check (status in ('active', 'inactive')),
  current_lat double precision,
  current_lng double precision,
  last_updated timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Officers
alter table public.officers enable row level security;

create policy "Officers are viewable by authenticated users"
  on public.officers for select
  using (auth.role() = 'authenticated');

create policy "Officers can update their own status/location"
  on public.officers for update
  using (auth.uid() = id);

-- 3. Alerts Table
create table public.alerts (
  id uuid default gen_random_uuid() primary key,
  type text not null check (type in ('sos', 'crash')),
  source_id uuid references public.profiles(id) on delete set null,
  lat double precision not null,
  lng double precision not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
  resolved boolean not null default false
);

-- Enable RLS for Alerts
alter table public.alerts enable row level security;

create policy "Alerts are viewable by authenticated users"
  on public.alerts for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert alerts"
  on public.alerts for insert
  with check (auth.role() = 'authenticated');

create policy "Admins can resolve alerts"
  on public.alerts for update
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

-- 4. Plate Logs Table
create table public.plate_logs (
  id uuid default gen_random_uuid() primary key,
  officer_id uuid references public.profiles(id) on delete set null,
  plate_number text not null,
  image_url text not null,
  lat double precision not null,
  lng double precision not null,
  timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for Plate Logs
alter table public.plate_logs enable row level security;

create policy "Plate logs are viewable by authenticated users"
  on public.plate_logs for select
  using (auth.role() = 'authenticated');

create policy "Officers can insert plate logs"
  on public.plate_logs for insert
  with check (auth.role() = 'authenticated');

-- Trigger to sync auth users with public profiles & officers
create or replace function public.handle_new_user()
returns trigger as $$
declare
  user_role text;
  user_name text;
  badge_val text;
begin
  user_role := coalesce(new.raw_user_meta_data->>'role', 'officer');
  user_name := coalesce(new.raw_user_meta_data->>'name', 'Unknown User');
  badge_val := coalesce(new.raw_user_meta_data->>'badge_id', 'B-' || floor(random() * 1000000)::text);

  insert into public.profiles (id, name, role)
  values (new.id, user_name, user_role);

  if user_role = 'officer' then
    insert into public.officers (id, name, badge_id, role, status, current_lat, current_lng, last_updated)
    values (new.id, user_name, badge_val, 'officer', 'inactive', 19.0760, 72.8777, now());
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
