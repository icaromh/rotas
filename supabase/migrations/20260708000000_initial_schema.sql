-- Run this in your Supabase SQL Editor

-- 1. Enable PostGIS extension (usually enabled by default in Supabase, but good to be sure)
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- 2. Create users table for Strava Auth
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    strava_athlete_id BIGINT UNIQUE NOT NULL,
    strava_access_token TEXT NOT NULL,
    strava_refresh_token TEXT NOT NULL,
    token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create activities table with PostGIS geometry
CREATE TABLE IF NOT EXISTS public.activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    strava_activity_id BIGINT UNIQUE NOT NULL,
    name TEXT,
    start_date TIMESTAMP WITH TIME ZONE,
    distance FLOAT,
    moving_time INT,
    path GEOMETRY(LineString, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create an index on the spatial column for faster map queries
CREATE INDEX IF NOT EXISTS activities_path_idx ON public.activities USING GIST (path);

-- 5. Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_modtime ON public.users;
CREATE TRIGGER update_users_modtime
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

-- Optional: Create RLS (Row Level Security) policies if needed later. 
-- For a POC we can leave it accessible via Service Key or anon if configured securely.
