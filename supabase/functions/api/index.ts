import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { createClient } from 'npm:@supabase/supabase-js';

const app = new Hono();
app.use('*', cors());

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const STRAVA_CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID') || '';
const STRAVA_CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET') || '';
const STRAVA_REDIRECT_URI = Deno.env.get('STRAVA_REDIRECT_URI') || 'http://localhost:5173/auth/callback';

// 1. Initiate Strava Auth
app.get('/api/auth/strava', (c) => {
  const origin = c.req.query('origin');
  const baseUri = origin ? `${origin}/auth/callback` : STRAVA_REDIRECT_URI;
  const redirectUri = encodeURIComponent(baseUri);
  const scope = 'read,activity:read_all';
  const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}&approval_prompt=force`;
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
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code'
      })
    });

    const tokenData = await tokenResponse.json();
    if (tokenData.errors) return c.json({ error: tokenData.message }, 400);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
  const { userId } = await c.req.json();
  if (!userId) return c.json({ error: 'Missing credentials' }, 400);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Set user sync status to queued
  await supabase
    .from('users')
    .update({ sync_status: 'queued', sync_progress: 0 })
    .eq('id', userId);

  // Send message to the Supabase pgmq Queue
  await supabase.rpc('send_strava_sync_message', { user_id: userId });

  return c.json({ status: 'queued', inserted: 0 }, 202);
});

// 4. Check Sync Status
app.get('/api/sync/status', async (c) => {
  const userId = c.req.query('userId');
  if (!userId) return c.json({ error: 'User ID required' }, 400);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
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
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
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

Deno.serve(app.fetch);
