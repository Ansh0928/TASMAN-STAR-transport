-- Enable required extensions
create extension if not exists "pg_net" with schema extensions;

-- =============================================================================
-- ENUMS
-- =============================================================================

create type public.user_role as enum ('customer', 'driver', 'admin');
create type public.booking_status as enum (
  'pending', 'confirmed', 'en_route', 'at_pickup', 'in_transit', 'delivered', 'cancelled'
);
create type public.photo_type as enum ('item', 'pickup', 'delivery');
create type public.signature_type as enum ('pickup', 'delivery');
create type public.notification_status as enum ('sent', 'failed');

-- =============================================================================
-- PROFILES
-- =============================================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  phone text,
  role public.user_role not null default 'customer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile on auth.users insert
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'phone',
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'customer')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- ROUTES
-- =============================================================================

create table public.routes (
  id uuid primary key default gen_random_uuid(),
  origin text not null,
  destination text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Seed default routes
insert into public.routes (origin, destination) values
  ('Gold Coast', 'Sydney'),
  ('Sydney', 'Gold Coast');

-- =============================================================================
-- PRICING
-- =============================================================================

create table public.pricing (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  item_type text not null,
  price_cents integer not null check (price_cents >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (route_id, item_type)
);

-- =============================================================================
-- BOOKINGS
-- =============================================================================

-- Sequence for booking numbers
create sequence public.booking_number_seq;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_number text not null unique,
  customer_id uuid not null references public.profiles(id),
  driver_id uuid references public.profiles(id),
  route_id uuid not null references public.routes(id),
  status public.booking_status not null default 'pending',
  pickup_address text not null,
  pickup_lat double precision not null,
  pickup_lng double precision not null,
  dropoff_address text not null,
  dropoff_lat double precision not null,
  dropoff_lng double precision not null,
  pickup_datetime timestamptz not null,
  dropoff_datetime timestamptz not null,
  item_type text not null,
  weight_kg numeric(10,2) not null check (weight_kg > 0),
  length_cm numeric(10,2) not null check (length_cm > 0),
  width_cm numeric(10,2) not null check (width_cm > 0),
  height_cm numeric(10,2) not null check (height_cm > 0),
  special_instructions text,
  price_cents integer not null check (price_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pickup_before_dropoff check (pickup_datetime < dropoff_datetime)
);

-- Auto-generate booking number: TT-YYYYMMDD-NNNN
create or replace function public.generate_booking_number()
returns trigger
language plpgsql
as $$
declare
  seq_val integer;
begin
  seq_val := nextval('public.booking_number_seq');
  new.booking_number := 'TT-' || to_char(now() at time zone 'Australia/Brisbane', 'YYYYMMDD') || '-' || lpad(seq_val::text, 4, '0');
  return new;
end;
$$;

create trigger set_booking_number
  before insert on public.bookings
  for each row execute function public.generate_booking_number();

-- =============================================================================
-- BOOKING PHOTOS
-- =============================================================================

create table public.booking_photos (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  photo_type public.photo_type not null,
  storage_path text not null,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- =============================================================================
-- BOOKING SIGNATURES
-- =============================================================================

create table public.booking_signatures (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  signature_type public.signature_type not null,
  storage_path text not null,
  signed_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- =============================================================================
-- DRIVER LOCATIONS
-- =============================================================================

create table public.driver_locations (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references public.profiles(id),
  booking_id uuid not null references public.bookings(id),
  latitude double precision not null,
  longitude double precision not null,
  heading double precision,
  speed double precision,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Index for efficient location queries
create index idx_driver_locations_booking on public.driver_locations(booking_id, recorded_at desc);
create index idx_driver_locations_driver on public.driver_locations(driver_id, recorded_at desc);

-- =============================================================================
-- NOTIFICATIONS LOG
-- =============================================================================

create table public.notifications_log (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  recipient_email text not null,
  notification_type text not null,
  status public.notification_status not null,
  error_message text,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- UPDATED_AT TRIGGERS
-- =============================================================================

create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

create trigger update_pricing_updated_at
  before update on public.pricing
  for each row execute function public.update_updated_at();

create trigger update_bookings_updated_at
  before update on public.bookings
  for each row execute function public.update_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all tables
alter table public.profiles enable row level security;
alter table public.routes enable row level security;
alter table public.pricing enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_photos enable row level security;
alter table public.booking_signatures enable row level security;
alter table public.driver_locations enable row level security;
alter table public.notifications_log enable row level security;

-- Helper function to get current user's role
create or replace function public.get_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- PROFILES policies
create policy "Users can view own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.get_user_role() = 'admin');

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Admins can update all profiles"
  on public.profiles for update
  using (public.get_user_role() = 'admin');

create policy "Admins can insert profiles"
  on public.profiles for insert
  with check (public.get_user_role() = 'admin');

-- ROUTES policies (readable by all authenticated users)
create policy "Authenticated users can view active routes"
  on public.routes for select
  using (auth.uid() is not null);

create policy "Admins can manage routes"
  on public.routes for all
  using (public.get_user_role() = 'admin');

-- PRICING policies
create policy "Authenticated users can view active pricing"
  on public.pricing for select
  using (auth.uid() is not null and is_active = true);

create policy "Admins can view all pricing"
  on public.pricing for select
  using (public.get_user_role() = 'admin');

create policy "Admins can manage pricing"
  on public.pricing for all
  using (public.get_user_role() = 'admin');

-- BOOKINGS policies
create policy "Customers can view own bookings"
  on public.bookings for select
  using (customer_id = auth.uid());

create policy "Drivers can view assigned bookings"
  on public.bookings for select
  using (driver_id = auth.uid());

create policy "Admins can view all bookings"
  on public.bookings for select
  using (public.get_user_role() = 'admin');

create policy "Customers can create bookings"
  on public.bookings for insert
  with check (customer_id = auth.uid() and public.get_user_role() = 'customer');

create policy "Admins can manage bookings"
  on public.bookings for all
  using (public.get_user_role() = 'admin');

create policy "Drivers can update assigned bookings"
  on public.bookings for update
  using (driver_id = auth.uid() and public.get_user_role() = 'driver');

-- BOOKING PHOTOS policies
create policy "Users can view photos for their bookings"
  on public.booking_photos for select
  using (
    exists (
      select 1 from public.bookings
      where bookings.id = booking_photos.booking_id
      and (bookings.customer_id = auth.uid() or bookings.driver_id = auth.uid())
    )
  );

create policy "Admins can view all photos"
  on public.booking_photos for select
  using (public.get_user_role() = 'admin');

create policy "Authenticated users can upload photos"
  on public.booking_photos for insert
  with check (uploaded_by = auth.uid());

-- BOOKING SIGNATURES policies
create policy "Users can view signatures for their bookings"
  on public.booking_signatures for select
  using (
    exists (
      select 1 from public.bookings
      where bookings.id = booking_signatures.booking_id
      and (bookings.customer_id = auth.uid() or bookings.driver_id = auth.uid())
    )
  );

create policy "Admins can view all signatures"
  on public.booking_signatures for select
  using (public.get_user_role() = 'admin');

create policy "Authenticated users can add signatures"
  on public.booking_signatures for insert
  with check (signed_by = auth.uid());

-- DRIVER LOCATIONS policies
create policy "Drivers can insert own locations"
  on public.driver_locations for insert
  with check (driver_id = auth.uid());

create policy "Users can view locations for their bookings"
  on public.driver_locations for select
  using (
    exists (
      select 1 from public.bookings
      where bookings.id = driver_locations.booking_id
      and (bookings.customer_id = auth.uid() or bookings.driver_id = auth.uid())
    )
  );

create policy "Admins can view all locations"
  on public.driver_locations for select
  using (public.get_user_role() = 'admin');

-- NOTIFICATIONS LOG policies
create policy "Admins can view all notifications"
  on public.notifications_log for select
  using (public.get_user_role() = 'admin');

create policy "Service role can insert notifications"
  on public.notifications_log for insert
  with check (true);

-- =============================================================================
-- STORAGE BUCKETS
-- =============================================================================

insert into storage.buckets (id, name, public)
values
  ('booking-photos', 'booking-photos', false),
  ('booking-signatures', 'booking-signatures', false);

-- Storage policies for booking-photos
create policy "Authenticated users can upload photos"
  on storage.objects for insert
  with check (bucket_id = 'booking-photos' and auth.uid() is not null);

create policy "Users can view photos for their bookings"
  on storage.objects for select
  using (bucket_id = 'booking-photos' and auth.uid() is not null);

-- Storage policies for booking-signatures
create policy "Authenticated users can upload signatures"
  on storage.objects for insert
  with check (bucket_id = 'booking-signatures' and auth.uid() is not null);

create policy "Users can view signatures"
  on storage.objects for select
  using (bucket_id = 'booking-signatures' and auth.uid() is not null);
