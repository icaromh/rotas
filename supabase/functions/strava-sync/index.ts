import { createClient } from 'npm:@supabase/supabase-js';
import polyline from 'npm:@mapbox/polyline';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

Deno.serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const payload = await req.json();
    // pgmq webhooks / edge function triggers usually send an array of messages or a single wrapped message
    const messages = Array.isArray(payload) ? payload : [payload];

    for (const msg of messages) {
      // Safely extract the userId depending on how pgmq wraps the payload
      const userId = msg.message?.userId || msg.userId || msg.record?.message?.userId;
      
      if (!userId) {
        console.error('Invalid message format, missing userId:', msg);
        continue;
      }

      console.log(`Processing sync for user: ${userId}`);

      // 1. Check Rate Limit status before starting
      const { data: userRecord } = await supabase
        .from('users')
        .select('rate_limit_reset_at, sync_status, sync_progress, strava_access_token')
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
          // In pgmq, if we fail the function (return 500), it might retry automatically.
          // Or we can manually modify visibility timeout via pgmq, but for simplicity, we throw to trigger retry
          throw new Error('Rate limit active. Retrying later.');
        }
      }

      // Set status to syncing
      await supabase.from('users').update({ sync_status: 'syncing' }).eq('id', userId);

      // Fetch latest activity to determine 'after' parameter
      const { data: latestActivity } = await supabase
        .from('activities')
        .select('start_date')
        .eq('user_id', userId)
        .order('start_date', { ascending: false })
        .limit(1)
        .single();

      let afterParam: number | undefined;
      if (latestActivity && latestActivity.start_date) {
        afterParam = Math.floor(new Date(latestActivity.start_date).getTime() / 1000);
      }

      let page = 1;
      const perPage = 200;
      let hasMore = true;
      let totalInserted = userRecord?.sync_progress || 0;

      while (hasMore) {
        const url = new URL('https://www.strava.com/api/v3/athlete/activities');
        url.searchParams.append('page', page.toString());
        url.searchParams.append('per_page', perPage.toString());
        if (afterParam) url.searchParams.append('after', afterParam.toString());

        const response = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${accessToken}` }
        });

        // Check Rate Limits
        const limitHeader = response.headers.get('X-RateLimit-Limit');
        const usageHeader = response.headers.get('X-RateLimit-Usage');
        
        if (limitHeader && usageHeader) {
          const limits = limitHeader.split(',').map(Number);
          const usages = usageHeader.split(',').map(Number);
          
          // 15-minute limits are index 0, daily are index 1
          const fifteenMinUsage = usages[0];
          const fifteenMinLimit = limits[0];
          
          if (fifteenMinUsage >= fifteenMinLimit - 10) {
            console.warn('Approaching Strava 15-min rate limit. Backing off.');
            // 15 min cooldown
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
        if (activities.length === 0) {
          hasMore = false;
          break;
        }

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
            totalInserted++;
          }
        }

        // Update progress in DB after each page
        await supabase.from('users').update({ sync_progress: totalInserted }).eq('id', userId);

        if (activities.length < perPage) {
          hasMore = false;
        } else {
          page++;
        }
      }

      // Sync completed
      await supabase.from('users').update({ 
        sync_status: 'completed', 
        sync_progress: totalInserted,
        last_sync_at: new Date().toISOString()
      }).eq('id', userId);
      
      console.log(`Sync completed for user: ${userId}. Inserted ${totalInserted} activities.`);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (err: any) {
    console.error('Queue processing failed:', err);
    // Returning a 500 will cause Supabase Queues / pgmq to retry the message
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
