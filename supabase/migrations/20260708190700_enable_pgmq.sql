-- Enable pgmq extension
create extension if not exists pgmq cascade;

-- Create the strava_sync queue
select pgmq.create('strava_sync');

-- Create an RPC to safely enqueue messages
create or replace function send_strava_sync_message(user_id uuid)
returns bigint as $$
begin
  return pgmq.send('strava_sync', jsonb_build_object('userId', user_id));
end;
$$ language plpgsql security definer;
