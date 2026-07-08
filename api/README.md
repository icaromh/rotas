# Rotas API - Cloudflare Worker Setup Guide

This directory contains the serverless API for the Rotas application, powered by [Cloudflare Workers](https://workers.cloudflare.com/), [Hono](https://hono.dev/), and [Cloudflare Queues](https://developers.cloudflare.com/queues/).

Follow these instructions to deploy the API to your Cloudflare production environment.

## Prerequisites

1. You must have a Cloudflare account.
2. Ensure you have Node.js and npm installed.
3. You must be on a paid Cloudflare Workers plan ($5/mo) because **Cloudflare Queues** are not available on the free tier.

## 1. Authenticate with Cloudflare

Run the following command and log in via your browser:
```bash
npx wrangler login
```

## 2. Create the Cloudflare Queue

Before deploying, you need to provision the Queue that handles the background Strava syncs.

Run the following command to create the queue:
```bash
npx wrangler queues create strava-sync-queue
```

*Note: If you name the queue differently, make sure to update the `queue` fields in `wrangler.toml`.*

## 3. Set Production Secrets

Your worker needs secure access to Supabase and Strava. You must upload these secrets to Cloudflare so they are encrypted and injected at runtime.

Run the following commands and paste the respective keys when prompted:

```bash
# Your Supabase Service Role Key (used to bypass RLS for background syncing)
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY

# Your Strava API Client Secret
npx wrangler secret put STRAVA_CLIENT_SECRET
```

## 4. Configure Public Variables

Open `wrangler.toml` and ensure your public variables are correct for production:
- `SUPABASE_URL`: Your Supabase project URL.
- `STRAVA_CLIENT_ID`: Your Strava API Client ID.
- `STRAVA_REDIRECT_URI`: Ensure this points to your **production URL** (e.g., `https://rotas.yourdomain.com/auth/callback`) instead of localhost!

## 5. Deploy to Production

Once the queue is created and secrets are uploaded, you can deploy the worker to Cloudflare's global edge network:

```bash
npm run deploy
# or manually:
npx wrangler deploy
```

Wrangler will output the live URL of your worker (e.g., `https://rotas-api.<your-username>.workers.dev`). 

## 6. Update Frontend Proxy (Production)

If your frontend is hosted on Vercel, Netlify, or another provider, make sure it knows where your new Cloudflare Worker lives. 

You should configure your frontend deployment to route `/api/*` requests to your new Worker URL, or update your API client to fetch directly from the Worker URL.

## Local Development

To run the worker locally, you do not need to deploy anything to Cloudflare. Just ensure you have an `api/.dev.vars` file with your secrets:

```env
SUPABASE_SERVICE_ROLE_KEY=your_key_here
STRAVA_CLIENT_SECRET=your_secret_here
```

Then run:
```bash
npx wrangler dev
```
Wrangler will emulate the Queue and Worker locally on `http://localhost:8787`.
