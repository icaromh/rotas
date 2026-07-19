-- Create saved_routes table
CREATE TABLE public.saved_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    trajectory JSONB NOT NULL,
    duration INTEGER, -- duration in seconds
    distance NUMERIC, -- distance in meters
    preview_image TEXT, -- URL or reference if we use screenshots in the future
    is_public BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.saved_routes ENABLE ROW LEVEL SECURITY;

-- Create Policies

-- SELECT: users can see their own routes, or any route that is public
CREATE POLICY "Users can view their own or public routes" 
ON public.saved_routes
FOR SELECT
USING (
    auth.uid() = user_id OR is_public = true
);

-- INSERT: users can only insert their own routes
CREATE POLICY "Users can insert their own routes" 
ON public.saved_routes
FOR INSERT
WITH CHECK (
    auth.uid() = user_id
);

-- UPDATE: users can only update their own routes
CREATE POLICY "Users can update their own routes" 
ON public.saved_routes
FOR UPDATE
USING (
    auth.uid() = user_id
)
WITH CHECK (
    auth.uid() = user_id
);

-- DELETE: users can only delete their own routes
CREATE POLICY "Users can delete their own routes" 
ON public.saved_routes
FOR DELETE
USING (
    auth.uid() = user_id
);
