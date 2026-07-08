import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createClient } from '@supabase/supabase-js';
import polyline from '@mapbox/polyline';

type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  STRAVA_CLIENT_ID: string;
  STRAVA_CLIENT_SECRET: string;
  STRAVA_REDIRECT_URI: string;
  STRAVA_SYNC_QUEUE: Queue;
};

type SyncMessage = {
  userId: string;
  accessToken: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors());

// --- ROUTES ---

// 1. Initiate Strava Auth
app.get('/api/auth/strava', (c) => {
  const redirectUri = encodeURIComponent(c.env.STRAVA_REDIRECT_URI);
  const scope = 'read,activity:read_all';
  const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${c.env.STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}&approval_prompt=force`;
  return c.json({ url: stravaAuthUrl });
});

// 2. Auth Callback
app.post('/api/auth/callback', async (c) => {
  const { code } = await c.req.json();
  if (!code) return c.json({ error: 'Authorization code is required' }, 400);

  try {
    const tokenResponse = await fetch('https://www.strava.com/api/v3/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: c.env.STRAVA_CLIENT_ID,
        client_secret: c.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();
    if (tokenData.errors) return c.json({ error: tokenData.message }, 400);

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

    const expiresAt = new Date(tokenData.expires_at * 1000).toISOString();
    const profileUrl = tokenData.athlete.profile;

    const { data, error } = await supabase
      .from('users')
      .upsert({
        strava_athlete_id: tokenData.athlete.id,
        strava_access_token: tokenData.access_token,
        strava_refresh_token: tokenData.refresh_token,
        token_expires_at: expiresAt,
        sync_status: 'idle'
      }, { onConflict: 'strava_athlete_id' })
      .select('id')
      .single();

    if (error) throw error;

    return c.json({
      userId: data.id,
      accessToken: tokenData.access_token,
      profileUrl
    });

  } catch (error: any) {
    console.error('Callback error:', error);
    return c.json({ error: 'Failed to authenticate with Strava' }, 500);
  }
});

// 3. Initiate Sync (Producer)
app.post('/api/sync', async (c) => {
  const { userId, accessToken } = await c.req.json();
  if (!userId || !accessToken) return c.json({ error: 'Missing credentials' }, 400);

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

  // Set user sync status to queued
  await supabase
    .from('users')
    .update({ sync_status: 'queued', sync_progress: 0 })
    .eq('id', userId);

  // Send message to the Cloudflare Queue
  await c.env.STRAVA_SYNC_QUEUE.send({ userId, accessToken });

  return c.json({ status: 'queued', inserted: 0 });
});

// 4. Check Sync Status
app.get('/api/sync/status', async (c) => {
  const userId = c.req.query('userId');
  if (!userId) return c.json({ error: 'User ID required' }, 400);

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase
    .from('users')
    .select('sync_status, sync_progress, rate_limit_reset_at')
    .eq('id', userId)
    .single();

  if (error || !data) return c.json({ status: 'idle', inserted: 0 });

  return c.json({
    status: data.sync_status || 'idle',
    inserted: data.sync_progress || 0,
    rateLimitResetAt: data.rate_limit_reset_at
  });
});

// 5. Get Paths
app.get('/api/paths', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase.from('activities').select('id, name, path');
  
  if (error) return c.json({ error: error.message }, 500);

  const geoJson = {
    type: 'FeatureCollection',
    features: data.map(activity => ({
      type: 'Feature',
      geometry: activity.path,
      properties: { id: activity.id, name: activity.name }
    }))
  };

  return c.json(geoJson);
});

// --- QUEUE CONSUMER (IMPORTER) ---

export default {
  fetch: app.fetch,
  
  async queue(batch: MessageBatch<SyncMessage>, env: Bindings): Promise<void> {
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    for (const msg of batch.messages) {
      const { userId, accessToken } = msg.body;

      try {
        // 1. Check Rate Limit status before starting
        const { data: userRecord } = await supabase
          .from('users')
          .select('rate_limit_reset_at, sync_status, sync_progress')
          .eq('id', userId)
          .single();

        if (userRecord?.rate_limit_reset_at) {
          const resetTime = new Date(userRecord.rate_limit_reset_at).getTime();
          if (Date.now() < resetTime) {
            console.log(`Rate limited until ${userRecord.rate_limit_reset_at}. Re-queuing.`);
            // Retry later
            const delaySeconds = Math.ceil((resetTime - Date.now()) / 1000);
            msg.retry({ delaySeconds });
            continue;
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
              
              // Retry in 15 minutes
              msg.retry({ delaySeconds: 15 * 60 });
              return; 
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
              coordinates: decoded.map(([lat, lng]) => [lng, lat]) // polyline is [lat, lng], GeoJSON is [lng, lat]
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

        msg.ack(); // Acknowledge successful processing

      } catch (error: any) {
        console.error('Queue Processing Error:', error);
        await supabase.from('users').update({ sync_status: 'error' }).eq('id', userId);
        msg.retry(); // Will retry up to max_retries defined in wrangler.toml
      }
    }
  }
};
