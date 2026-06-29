/**
 * Overpass API Cloudflare Worker Proxy
 * Intercepts requests, forwards them to a list of public Overpass API endpoints
 * with automatic fallback on 5xx errors and 429 rate-limits.
 */

export interface Env {}

const ALLOWED_ORIGINS = [
  'https://rotas-dusky.vercel.app',
  'https://rotas.cc',
  'https://www.rotas.cc',
];

/**
 * Matches Vercel preview deployments for the rotas project.
 * e.g. https://rotas-git-feat-issue-11-walk-boun-44e607-icaro-heimigs-projects.vercel.app
 */
const VERCEL_PREVIEW_RE = /^https:\/\/rotas[a-z0-9-]*\.vercel\.app$/;

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;

  // Allow localhost (any port)
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
    return true;
  }

  // Allow Vercel preview deployments (branch previews, PR previews, etc.)
  if (VERCEL_PREVIEW_RE.test(origin)) {
    return true;
  }

  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * Public Overpass API instances with global data coverage.
 * Order matters — most reliable / highest capacity first.
 *
 * Sources: https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances
 *
 * 1. Main FOSSGIS instance — up to 10 000 req/day, 1 GB/day
 * 2. VK Maps (Russia) — no stated rate limit
 * 3. Private.coffee — no rate limit (formerly kumi.systems)
 */
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

/**
 * Returns true for status codes that should trigger a fallback to the next endpoint.
 * - 5xx: server-side errors (timeouts, overloaded instances)
 * - 429: rate-limited — try another instance instead of giving up
 * - 406: overpass-api.de anti-bot firewall — try another instance
 */
function shouldFallback(status: number): boolean {
  return status === 406 || status === 429 || status >= 500;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = request.headers.get('Origin');

    if (origin && !isAllowedOrigin(origin)) {
      return new Response('Forbidden: CORS policy does not allow this origin.', { status: 403 });
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed. Use POST.', { status: 405, headers: corsHeaders });
    }

    try {
      const bodyText = await request.text();
      const contentType = request.headers.get('Content-Type') || 'application/x-www-form-urlencoded';

      let lastResponse: Response | null = null;

      for (const endpoint of ENDPOINTS) {
        try {
          const overpassResponse = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': contentType,
              'Accept': '*/*',
              // Identify the app as required by OSM usage policy
              'User-Agent': 'RotasOptimizer/1.0 (https://rotas.cc/)',
              'Referer': 'https://rotas.cc/',
            },
            body: bodyText,
          });

          if (!shouldFallback(overpassResponse.status)) {
            // 2xx success OR a definitive client error (400, 403, etc.) — return as-is
            const responseBody = await overpassResponse.text();
            return new Response(responseBody, {
              status: overpassResponse.status,
              headers: {
                ...corsHeaders,
                'Content-Type': overpassResponse.headers.get('Content-Type') || 'application/json',
              },
            });
          }

          console.warn(`[proxy] ${endpoint} returned ${overpassResponse.status} — trying next endpoint`);
          lastResponse = overpassResponse;
        } catch (err) {
          // Network-level failure (DNS, connection refused, etc.)
          console.error(`[proxy] fetch error for ${endpoint}:`, err);
        }
      }

      // All endpoints exhausted — return the last known response (or 502)
      if (lastResponse) {
        const responseBody = await lastResponse.text();
        return new Response(responseBody, {
          status: lastResponse.status,
          headers: {
            ...corsHeaders,
            'Content-Type': lastResponse.headers.get('Content-Type') || 'application/json',
          },
        });
      }

      throw new Error('All Overpass API endpoints failed to respond.');

    } catch (error: any) {
      return new Response(
        JSON.stringify({ error: 'Proxy fetch failed', details: error.message }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  },
};
