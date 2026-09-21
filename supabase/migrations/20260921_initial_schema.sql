-- 1. Create Custom Enum Types
CREATE TYPE user_role AS ENUM ('student', 'driver', 'admin');
CREATE TYPE ride_status AS ENUM ('requested', 'accepted', 'in_progress', 'completed', 'cancelled');
CREATE TYPE driver_status AS ENUM ('offline', 'available', 'busy');

-- 2. Profiles Table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone_number TEXT,
  role user_role NOT NULL DEFAULT 'student',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Driver Profiles Table
CREATE TABLE public.driver_profiles (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_plate_number TEXT NOT NULL UNIQUE,
  vehicle_type TEXT NOT NULL DEFAULT 'keke',
  status driver_status NOT NULL DEFAULT 'offline',
  current_hub_id UUID,
  rating NUMERIC(3, 2) DEFAULT 5.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Locations Table (Campus Hubs)
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Routes Table (Connecting Hub to Hub with base pricing)
CREATE TABLE public.routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pickup_location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  dropoff_location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  base_fare NUMERIC(10, 2) NOT NULL DEFAULT 100.00,
  estimated_duration_mins INT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unique_pickup_dropoff UNIQUE (pickup_location_id, dropoff_location_id)
);

-- Add foreign key constraint for driver_profiles current_hub_id
ALTER TABLE public.driver_profiles
  ADD CONSTRAINT fk_driver_current_hub
  FOREIGN KEY (current_hub_id) REFERENCES public.locations(id) ON DELETE SET NULL;

-- 6. Rides Table
CREATE TABLE public.rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.driver_profiles(id) ON DELETE SET NULL,
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE RESTRICT,
  status ride_status NOT NULL DEFAULT 'requested',
  fare NUMERIC(10, 2) NOT NULL,
  pickup_time TIMESTAMPTZ,
  completed_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. Ride Status Logs (Audit trail for lifecycle changes)
CREATE TABLE public.ride_status_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  status ride_status NOT NULL,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. Seed Default FUTA Campus Hubs
INSERT INTO public.locations (name, description) VALUES
  ('North Gate', 'Main Campus Entrance'),
  ('South Gate', 'Obakekere Access Point'),
  ('Obanla Junction', 'Central Campus Transit Hub'),
  ('School of Computing (SOC)', 'Information Technology & Computer Science Blocks'),
  ('Senate Building', 'Administrative Center');