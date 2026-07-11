-- Add historical_sync_completed column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS historical_sync_completed boolean DEFAULT false;

-- If there are users who already have activities, we should ensure the backfill starts properly
-- However, since the user just dropped activities in production, default false is correct.
