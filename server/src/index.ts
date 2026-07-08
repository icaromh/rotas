import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import polyline from '@mapbox/polyline';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; // Needs service role key to insert without RLS for POC
const supabase = createClient(supabaseUrl, supabaseKey);

// Strava configuration
const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID || '';
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET || '';
const STRAVA_REDIRECT_URI = process.env.STRAVA_REDIRECT_URI || 'http://localhost:5173/auth/callback';

// Track sync background jobs in memory
const syncJobs: Record<string, { status: 'running' | 'completed' | 'error', inserted: number, error?: string }> = {};

/**
 * 1. Auth: Redirect to Strava
 */
app.get('/api/auth/strava', (req, res) => {
    const scope = 'read,activity:read_all';
    const stravaAuthUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(STRAVA_REDIRECT_URI)}&approval_prompt=force&scope=${scope}`;
    res.json({ url: stravaAuthUrl });
});

/**
 * 2. Auth: Handle Callback from Strava
 */
app.post('/api/auth/callback', async (req, res) => {
    const { code } = req.body;
    if (!code) {
        return res.status(400).json({ error: 'Authorization code is required' });
    }

    try {
        const response = await axios.post('https://www.strava.com/oauth/token', {
            client_id: STRAVA_CLIENT_ID,
            client_secret: STRAVA_CLIENT_SECRET,
            code,
            grant_type: 'authorization_code',
        });

        const data = response.data;
        const athleteId = data.athlete.id;
        const accessToken = data.access_token;
        const refreshToken = data.refresh_token;
        const expiresAt = new Date(data.expires_at * 1000).toISOString();

        // Upsert user in Supabase
        const { data: user, error } = await supabase
            .from('users')
            .upsert({
                strava_athlete_id: athleteId,
                strava_access_token: accessToken,
                strava_refresh_token: refreshToken,
                token_expires_at: expiresAt,
            }, { onConflict: 'strava_athlete_id' })
            .select()
            .single();

        if (error) {
            console.error('Supabase Error:', error);
            return res.status(500).json({ error: 'Failed to save user data' });
        }

        res.json({ user, message: 'Authentication successful' });
    } catch (error: any) {
        console.error('Strava Auth Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to authenticate with Strava' });
    }
});

/**
 * 3. Sync Activities
 */
app.post('/api/sync', async (req, res) => {
    const { userId } = req.body;
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    if (syncJobs[userId] && syncJobs[userId].status === 'running') {
        return res.status(409).json({ error: 'Sync already in progress' });
    }

    // Immediately respond that processing started
    res.status(202).json({ message: 'Sync started in background' });

    // Run sync in background (fire and forget)
    syncJobs[userId] = { status: 'running', inserted: 0 };

    (async () => {
        try {
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('id', userId)
                .single();

            if (userError || !user) {
                syncJobs[userId] = { status: 'error', inserted: 0, error: 'User not found' };
                return;
            }

            const accessToken = user.strava_access_token;
            let page = 1;
            const perPage = 200;
            let hasMore = true;
            let totalInserted = 0;

            while (hasMore) {
                console.log(`Fetching Strava activities page ${page}...`);
                const response = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
                    headers: { Authorization: `Bearer ${accessToken}` },
                    params: { page, per_page: perPage }
                });

                const activities = response.data;
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
                            user_id: user.id,
                            strava_activity_id: activity.id,
                            name: activity.name,
                            start_date: activity.start_date,
                            distance: activity.distance,
                            moving_time: activity.moving_time,
                            path: geoJSONLineString
                        }, { onConflict: 'strava_activity_id' });

                    if (!insertError) {
                        totalInserted++;
                        syncJobs[userId].inserted = totalInserted; // Update live count
                    } else {
                        console.error('Insert error for activity', activity.id, insertError);
                    }
                }

                if (activities.length < perPage) {
                    hasMore = false;
                } else {
                    page++;
                }
            }

            syncJobs[userId] = { status: 'completed', inserted: totalInserted };
            console.log(`Sync completed for ${userId}: ${totalInserted} paths inserted`);

        } catch (error: any) {
            console.error('Background Sync Error:', error.response?.data || error.message);
            syncJobs[userId] = { status: 'error', inserted: syncJobs[userId]?.inserted || 0, error: 'Failed to sync activities' };
        }
    })();
});

/**
 * 3.5 Sync Status Check
 */
app.get('/api/sync/status', (req, res) => {
    const userId = req.query.userId as string;
    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    const job = syncJobs[userId] || { status: 'idle', inserted: 0 };
    res.json(job);
});

/**
 * 4. Get Map Paths
 */
app.get('/api/paths', async (req, res) => {
    try {
        // We want to return a GeoJSON FeatureCollection of all paths.
        // We can query the activities table.
        const { data: activities, error } = await supabase
            .from('activities')
            .select('id, name, path'); // 'path' will be returned as GeoJSON if queried via REST

        if (error) {
            throw error;
        }

        const features = activities.map(a => ({
            type: 'Feature',
            properties: { id: a.id, name: a.name },
            geometry: a.path
        }));

        const featureCollection = {
            type: 'FeatureCollection',
            features
        };

        res.json(featureCollection);

    } catch (error: any) {
        console.error('Get Paths Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch paths' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
