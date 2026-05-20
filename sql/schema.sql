-- Galaxy Social schema for Supabase PostgreSQL
create extension if not exists "pgcrypto";
-- Optional semantic/vector features:
create extension if not exists "vector";

create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  username text unique,
  avatar_url text,
  bio text,
  created_at timestamptz default now()
);

create table if not exists stars (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text default '#ffaa44',
  x_coord float not null,
  y_coord float not null,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz default now()
);

create table if not exists planets (
  id uuid primary key default gen_random_uuid(),
  star_id uuid references stars on delete cascade not null,
  title text not null,
  video_url text not null,
  thumbnail_url text,
  description text,
  created_by uuid references auth.users on delete set null,
  orbit_radius int default 120,
  orbit_speed float default 0.00025,
  created_at timestamptz default now()
);

create table if not exists moons (
  id uuid primary key default gen_random_uuid(),
  planet_id uuid references planets on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

create table if not exists likes (
  id uuid primary key default gen_random_uuid(),
  planet_id uuid references planets on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  created_at timestamptz default now(),
  unique (planet_id, user_id)
);

create index if not exists idx_planets_star on planets(star_id);
create index if not exists idx_moons_planet on moons(planet_id);
create index if not exists idx_likes_planet on likes(planet_id);
create index if not exists idx_stars_name on stars(name);

-- Auto profile creation from auth signup metadata
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Enable RLS
alter table profiles enable row level security;
alter table stars enable row level security;
alter table planets enable row level security;
alter table moons enable row level security;
alter table likes enable row level security;

-- Profiles policies
drop policy if exists "profiles_select_auth" on profiles;
create policy "profiles_select_auth" on profiles
for select to authenticated
using (true);

drop policy if exists "profiles_upsert_self" on profiles;
create policy "profiles_upsert_self" on profiles
for all to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Stars policies
drop policy if exists "stars_select_auth" on stars;
create policy "stars_select_auth" on stars
for select to authenticated
using (true);

drop policy if exists "stars_insert_auth" on stars;
create policy "stars_insert_auth" on stars
for insert to authenticated
with check (auth.uid() = created_by);

drop policy if exists "stars_update_creator" on stars;
create policy "stars_update_creator" on stars
for update to authenticated
using (auth.uid() = created_by)
with check (auth.uid() = created_by);

drop policy if exists "stars_delete_creator" on stars;
create policy "stars_delete_creator" on stars
for delete to authenticated
using (auth.uid() = created_by);

-- Planets policies
drop policy if exists "planets_select_auth" on planets;
create policy "planets_select_auth" on planets
for select to authenticated
using (true);

drop policy if exists "planets_insert_auth" on planets;
create policy "planets_insert_auth" on planets
for insert to authenticated
with check (auth.uid() = created_by);

drop policy if exists "planets_update_creator" on planets;
create policy "planets_update_creator" on planets
for update to authenticated
using (auth.uid() = created_by)
with check (auth.uid() = created_by);

drop policy if exists "planets_delete_creator" on planets;
create policy "planets_delete_creator" on planets
for delete to authenticated
using (auth.uid() = created_by);

-- Moons policies
drop policy if exists "moons_select_auth" on moons;
create policy "moons_select_auth" on moons
for select to authenticated
using (true);

drop policy if exists "moons_insert_auth" on moons;
create policy "moons_insert_auth" on moons
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "moons_delete_owner" on moons;
create policy "moons_delete_owner" on moons
for delete to authenticated
using (auth.uid() = user_id);

-- Likes policies
drop policy if exists "likes_select_auth" on likes;
create policy "likes_select_auth" on likes
for select to authenticated
using (true);

drop policy if exists "likes_insert_auth" on likes;
create policy "likes_insert_auth" on likes
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "likes_delete_owner" on likes;
create policy "likes_delete_owner" on likes
for delete to authenticated
using (auth.uid() = user_id);

-- Storage policies (bucket videos must exist and be public or signed URL enabled)
insert into storage.buckets (id, name, public)
values ('videos', 'videos', true)
on conflict (id) do nothing;

drop policy if exists "videos_select_auth" on storage.objects;
create policy "videos_select_auth" on storage.objects
for select to authenticated
using (bucket_id = 'videos');

drop policy if exists "videos_insert_auth" on storage.objects;
create policy "videos_insert_auth" on storage.objects
for insert to authenticated
with check (bucket_id = 'videos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "videos_update_auth" on storage.objects;
create policy "videos_update_auth" on storage.objects
for update to authenticated
using (bucket_id = 'videos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "videos_delete_auth" on storage.objects;
create policy "videos_delete_auth" on storage.objects
for delete to authenticated
using (bucket_id = 'videos' and auth.uid()::text = (storage.foldername(name))[1]);
