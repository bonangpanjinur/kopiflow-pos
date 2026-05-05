
-- Enums
create type public.app_role as enum ('super_admin', 'owner', 'cashier', 'barista', 'customer');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);

-- User roles (separate table to avoid privilege escalation)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  shop_id uuid,
  outlet_id uuid,
  created_at timestamptz not null default now(),
  unique (user_id, role, shop_id, outlet_id)
);
alter table public.user_roles enable row level security;

-- Security definer to avoid recursive RLS
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.has_shop_role(_user_id uuid, _role app_role, _shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role and (shop_id = _shop_id or shop_id is null)
  )
$$;

create policy "user_roles_select_own" on public.user_roles for select to authenticated using (auth.uid() = user_id);

-- Coffee shops
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.businesses enable row level security;

create policy "shops_public_read_active" on public.businesses for select using (is_active = true);
create policy "shops_owner_all" on public.businesses for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Outlets
create table public.outlets (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  address text,
  phone text,
  timezone text not null default 'Asia/Jakarta',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.outlets enable row level security;

create policy "outlets_public_read_active" on public.outlets for select
  using (is_active = true and exists (select 1 from public.businesses s where s.id = shop_id and s.is_active = true));

create policy "outlets_owner_all" on public.outlets for all to authenticated
  using (exists (select 1 from public.businesses s where s.id = shop_id and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.businesses s where s.id = shop_id and s.owner_id = auth.uid()));

create policy "outlets_staff_read" on public.outlets for select to authenticated
  using (exists (
    select 1 from public.user_roles r
    where r.user_id = auth.uid()
      and r.role in ('cashier','barista')
      and (r.outlet_id = outlets.id or r.shop_id = outlets.shop_id)
  ));

-- User preferences
create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  default_outlet_id uuid references public.outlets(id) on delete set null,
  active_carts jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_preferences enable row level security;

create policy "prefs_select_own" on public.user_preferences for select to authenticated using (auth.uid() = user_id);
create policy "prefs_upsert_own" on public.user_preferences for insert to authenticated with check (auth.uid() = user_id);
create policy "prefs_update_own" on public.user_preferences for update to authenticated using (auth.uid() = user_id);

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_profiles_updated before update on public.profiles for each row execute function public.touch_updated_at();
create trigger trg_shops_updated before update on public.businesses for each row execute function public.touch_updated_at();
create trigger trg_outlets_updated before update on public.outlets for each row execute function public.touch_updated_at();
create trigger trg_prefs_updated before update on public.user_preferences for each row execute function public.touch_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
