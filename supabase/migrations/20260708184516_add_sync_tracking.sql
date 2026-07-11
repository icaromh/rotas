-- Run this in your Supabase SQL Editor to support Cloudflare Queues and Rate Limits

-- 1. Add sync tracking columns to the users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS sync_status VARCHAR(50) DEFAULT 'idle',
ADD COLUMN IF NOT EXISTS sync_progress INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS rate_limit_reset_at TIMESTAMP WITH TIME ZONE;

-- 2. Add last_sync_at to track when the user last synced
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP WITH TIME ZONE;
