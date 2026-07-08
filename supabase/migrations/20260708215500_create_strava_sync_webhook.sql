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
  -- We default to kong:8000 for local docker development. 
  -- In production, this can be overridden via database settings.
  request_url := coalesce(
    current_setting('app.settings.edge_function_url', true), 
    'http://kong:8000/functions/v1/strava-sync'
  );

  PERFORM net.http_post(
    url := request_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('msg_id', NEW.msg_id, 'userId', NEW.message->>'userId')
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
