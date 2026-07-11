-- Enable pg_net for webhooks
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to trigger the Edge Function via HTTP POST
CREATE OR REPLACE FUNCTION trigger_strava_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_url text;
BEGIN
  -- Try to read the production webhook URL from Supabase Vault secrets
  SELECT decrypted_secret INTO request_url
  FROM vault.decrypted_secrets 
  WHERE name = 'STRAVA_SYNC_WEBHOOK_URL' 
  LIMIT 1;

  -- Fallback to local development URL if no secret is found
  IF request_url IS NULL OR request_url = '' THEN
    request_url := 'http://kong:8000/functions/v1/strava-sync';
  END IF;

  PERFORM net.http_post(
    url := request_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('msg_id', NEW.msg_id, 'userId', NEW.message->>'userId'), timeout_milliseconds := 30000
  );
  
  RETURN NEW;
END;
$$;

-- Create the trigger on the pgmq queue table
DROP TRIGGER IF EXISTS on_strava_sync_queued ON pgmq.q_strava_sync;
CREATE TRIGGER on_strava_sync_queued
  AFTER INSERT ON pgmq.q_strava_sync
  FOR EACH ROW
  EXECUTE FUNCTION trigger_strava_sync();

-- Create RPC to delete messages from the queue upon successful completion
CREATE OR REPLACE FUNCTION delete_strava_sync_message(msg_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM pgmq.delete('strava_sync', msg_id);
  RETURN true;
END;
$$;
