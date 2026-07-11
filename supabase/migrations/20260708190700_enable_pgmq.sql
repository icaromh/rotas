-- Enable pgmq extension
create extension if not exists pgmq cascade;

-- Create the strava_sync queue if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pgmq.meta WHERE queue_name = 'strava_sync') THEN
    PERFORM pgmq.create('strava_sync');
  END IF;
END $$;

-- Create an RPC to safely enqueue messages
create or replace function send_strava_sync_message(user_id uuid)
returns bigint as $$
begin
  return pgmq.send('strava_sync', jsonb_build_object('userId', user_id));
end;
$$ language plpgsql security definer;
