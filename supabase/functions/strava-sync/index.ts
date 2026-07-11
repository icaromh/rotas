import { createClient } from 'npm:@supabase/supabase-js';
import polyline from 'npm:@mapbox/polyline';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

Deno.serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const payload = await req.json();
    const messages = Array.isArray(payload) ? payload : [payload];

    for (const msg of messages) {
      const userId = msg.message?.userId || msg.userId || msg.record?.message?.userId;
      
      if (!userId) {
        console.error('Invalid message format, missing userId:', msg);
        continue;
      }

      console.log(`Processing sync for user: ${userId}`);

      const { data: userRecord } = await supabase
        .from('users')
        .select('rate_limit_reset_at, sync_status, sync_progress, strava_access_token, historical_sync_completed')
        .eq('id', userId)
        .single();

      if (!userRecord || !userRecord.strava_access_token) {
        console.error(`User ${userId} not found or missing access token`);
        continue;
      }
      
      const accessToken = userRecord.strava_access_token;

      if (userRecord.rate_limit_reset_at) {
        const resetTime = new Date(userRecord.rate_limit_reset_at).getTime();
        if (Date.now() < resetTime) {
          console.log(`Rate limited until ${userRecord.rate_limit_reset_at}. Skipping for now.`);
          throw new Error('Rate limit active. Retrying later.');
        }
      }

      // Set status to syncing
      await supabase.from('users').update({ sync_status: 'syncing' }).eq('id', userId);

      let totalInserted = userRecord.sync_progress || 0;
      let shouldEnqueueMore = false;
      const perPage = 200;

      const fetchAndProcessPage = async (pageUrl: URL) => {
        const response = await fetch(pageUrl.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        const limitHeader = response.headers.get('X-RateLimit-Limit');
        const usageHeader = response.headers.get('X-RateLimit-Usage');
        
        if (limitHeader && usageHeader) {
          const limits = limitHeader.split(',').map(Number);
          const usages = usageHeader.split(',').map(Number);
          
          if (usages[0] >= limits[0] - 10) {
            console.warn('Approaching Strava 15-min rate limit. Backing off.');
            const resetAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
            await supabase.from('users').update({ 
              sync_status: 'rate_limited',
              rate_limit_reset_at: resetAt
            }).eq('id', userId);
            throw new Error('Strava rate limit reached. Backing off.');
          }
        }

        if (!response.ok) {
          throw new Error(`Strava API error: ${response.status}`);
        }

        const activities = (await response.json()) as any[];
        let insertedInPage = 0;

        for (const activity of activities) {
          if (!activity.map || !activity.map.summary_polyline) continue;

          const decoded = polyline.decode(activity.map.summary_polyline);
          const geoJSONLineString = {
            type: 'LineString',
            coordinates: decoded.map(([lat, lng]) => [lng, lat])
          };

          const { error: insertError } = await supabase
            .from('activities')
            .upsert({
              user_id: userId,
              strava_activity_id: activity.id,
              name: activity.name,
              start_date: activity.start_date,
              distance: activity.distance,
              moving_time: activity.moving_time,
              path: geoJSONLineString
            }, { onConflict: 'strava_activity_id' });

          if (!insertError) {
            insertedInPage++;
          }
        }

        return { countReturned: activities.length, insertedInPage };
      };

      // 1. Sync NEW activities
      const { data: latestActivity } = await supabase
        .from('activities')
        .select('start_date')
        .eq('user_id', userId)
        .order('start_date', { ascending: false })
        .limit(1)
        .single();

      if (latestActivity) {
        const afterParam = Math.floor(new Date(latestActivity.start_date).getTime() / 1000);
        const url = new URL('https://www.strava.com/api/v3/athlete/activities');
        url.searchParams.append('per_page', perPage.toString());
        url.searchParams.append('after', afterParam.toString());

        const { countReturned, insertedInPage } = await fetchAndProcessPage(url);
        totalInserted += insertedInPage;

        if (countReturned === perPage) {
          shouldEnqueueMore = true; 
        }
      }

      // 2. Sync HISTORICAL activities (backfill)
      if (!userRecord.historical_sync_completed && !shouldEnqueueMore) {
        const { data: oldestActivity } = await supabase
          .from('activities')
          .select('start_date')
          .eq('user_id', userId)
          .order('start_date', { ascending: true }) // Oldest first
          .limit(1)
          .single();

        const url = new URL('https://www.strava.com/api/v3/athlete/activities');
        url.searchParams.append('per_page', perPage.toString());
        if (oldestActivity) {
          const beforeParam = Math.floor(new Date(oldestActivity.start_date).getTime() / 1000);
          url.searchParams.append('before', beforeParam.toString());
        }

        const { countReturned, insertedInPage } = await fetchAndProcessPage(url);
        totalInserted += insertedInPage;

        if (countReturned < perPage) {
          await supabase.from('users').update({ historical_sync_completed: true }).eq('id', userId);
        } else {
          shouldEnqueueMore = true;
        }
      }

      // Save progress
      await supabase.from('users').update({ sync_progress: totalInserted }).eq('id', userId);

      // Always delete the processed message from the queue
      if (msg.msg_id) {
        await supabase.rpc('delete_strava_sync_message', { msg_id: msg.msg_id });
        console.log(`Removed message ${msg.msg_id} from queue.`);
      }

      if (shouldEnqueueMore) {
        console.log(`More pages left for user ${userId}. Re-enqueuing sync job.`);
        await supabase.rpc('send_strava_sync_message', { user_id: userId });
      } else {
        await supabase.from('users').update({ 
          sync_status: 'completed', 
          last_sync_at: new Date().toISOString()
        }).eq('id', userId);
        console.log(`Fully synced user: ${userId}. Inserted ${totalInserted} activities.`);
      }
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (err: any) {
    console.error('Queue processing failed:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
