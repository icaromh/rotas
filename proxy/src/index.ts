/**
 * Overpass API Cloudflare Worker Proxy
 * Intercepts requests, forwards them to Overpass API, and forces CORS headers on the response.
 */

export interface Env {}

const ALLOWED_ORIGINS = [
  'https://rotas-dusky.vercel.app'
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  
  // Allow localhost (any port)
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
    return true;
  }
  
  // Allow explicit domains
  return ALLOWED_ORIGINS.includes(origin);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = request.headers.get('Origin');
    
    // If there is an Origin header but it's not allowed, reject immediately
    if (origin && !isAllowedOrigin(origin)) {
      return new Response('Forbidden: CORS policy does not allow this origin.', { status: 403 });
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders,
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed. Use POST.', { status: 405, headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      const endpoints = [
        'https://overpass-api.de/api/interpreter',
        'https://lz4.overpass-api.de/api/interpreter',
        'https://z.overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter'
      ];

      const bodyText = await request.text();
      let lastResponse = null;

      for (const targetUrl of endpoints) {
        try {
          const overpassResponse = await fetch(targetUrl, {
            method: 'POST',
            headers: {
              'Content-Type': request.headers.get('Content-Type') || 'application/x-www-form-urlencoded',
              'Accept': '*/*',
              'User-Agent': 'RotasOptimizer/1.0 (https://rotas-dusky.vercel.app/)',
            },
            body: bodyText,
          });

          // If the response is successful, or it's a client error (like 400 bad query), break and return it.
          // If it's a 5xx error (504 timeout, 502 bad gateway), try the next endpoint.
          if (overpassResponse.ok || (overpassResponse.status >= 400 && overpassResponse.status < 500)) {
            const responseBody = await overpassResponse.text();
            return new Response(responseBody, {
              status: overpassResponse.status,
              headers: {
                ...corsHeaders,
                'Content-Type': overpassResponse.headers.get('Content-Type') || 'application/json',
              },
            });
          }
          
          // Store the last response in case all fail
          lastResponse = overpassResponse;
        } catch (err) {
          // fetch error (e.g., DNS, connection refused), continue to next endpoint
          console.error(`Failed fetching from ${targetUrl}:`, err);
        }
      }

      // If all endpoints failed (either 5xx or fetch threw)
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
      // In case the worker itself fails to fetch from Overpass
      return new Response(JSON.stringify({ error: 'Proxy fetch failed', details: error.message }), {
        status: 502,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    }
  },
};
