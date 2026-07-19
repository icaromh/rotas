-- Create saved_routes table
CREATE TABLE public.saved_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    trajectory JSONB NOT NULL,
    duration INTEGER, -- duration in seconds
    distance NUMERIC, -- distance in meters
    preview_image TEXT, -- URL or reference if we use screenshots in the future
    is_public BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


