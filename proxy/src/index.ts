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
      // Optional: you can add searchParams support or allow selecting the target Overpass API
      const targetUrl = 'https://overpass-api.de/api/interpreter';

      // Read the original request body
      const bodyText = await request.text();

      // Forward request to Overpass API
      const overpassResponse = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': request.headers.get('Content-Type') || 'application/x-www-form-urlencoded',
          'Accept': '*/*',
          'User-Agent': 'RotasOptimizer/1.0 (https://rotas-dusky.vercel.app/)',
        },
        body: bodyText,
      });

      // Get the body from the Overpass response
      const responseBody = await overpassResponse.text();

      // Return the new response with the injected CORS headers, keeping the original status code
      return new Response(responseBody, {
        status: overpassResponse.status,
        headers: {
          ...corsHeaders,
          'Content-Type': overpassResponse.headers.get('Content-Type') || 'application/json',
        },
      });

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
