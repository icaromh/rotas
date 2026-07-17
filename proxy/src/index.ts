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

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;

  // Allow localhost (any port)
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
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

function buildRoadQuery(bbox: string, mode: string, safety: string): string {
  if (mode === 'bike') {
    if (safety === 'safe') {
      return `
        [out:json][timeout:25];
        (
          way["highway"~"^(secondary|tertiary|unclassified|residential|living_street|pedestrian|cycleway)$"](${bbox});
          way["cycleway"](${bbox});
          way["highway"="primary"]["cycleway"](${bbox});
        );
        out body;
        >;
        out skel qt;
      `;
    }

    if (safety === 'strict') {
      return `
        [out:json][timeout:25];
        (
          way["highway"="cycleway"](${bbox});
          way["cycleway"](${bbox});
          way["bicycle_road"="yes"](${bbox});
        );
        out body;
        >;
        out skel qt;
      `;
    }
  }

  // Default: walk or bike/any
  const wayFilter = mode === 'bike'
    ? `["highway"~"^(primary|secondary|tertiary|unclassified|residential|living_street|pedestrian|cycleway)$"]`
    : `["highway"~"^(primary|secondary|tertiary|unclassified|residential|living_street|pedestrian)$"]`;

  return `
    [out:json][timeout:25];
    (
      way${wayFilter}((${bbox}));
    );
    out body;
    >;
    out skel qt;
  `.replace(/\(\(/g, '(').replace(/\)\)/g, ')'); 
  // ensure we just have one pair of parentheses around bbox as in old query
}

function buildNeighborhoodsQuery(bbox: string): string {
  return `
    [out:json][timeout:25];
    (
      relation["admin_level"~"9|10"](${bbox});
      relation["place"~"neighbourhood|suburb"](${bbox});
    );
    out geom;
  `;
}

const openApiSchema = {
  openapi: "3.0.0",
  info: {
    title: "Rotas Overpass API",
    version: "1.0.0"
  },
  paths: {
    "/api/neighborhoods": {
      get: {
        summary: "Get neighborhoods in bounding box",
        parameters: [
          { name: "bbox", in: "query", required: true, schema: { type: "string" } }
        ],
        responses: {
          "200": { description: "Overpass API JSON response" }
        }
      }
    },
    "/api/roads": {
      get: {
        summary: "Get road network in bounding box",
        parameters: [
          { name: "bbox", in: "query", required: true, schema: { type: "string" } },
          { name: "mode", in: "query", schema: { type: "string", enum: ["walk", "bike"] } },
          { name: "safety", in: "query", schema: { type: "string", enum: ["any", "safe", "strict"] } }
        ],
        responses: {
          "200": { description: "Overpass API JSON response" }
        }
      }
    }
  }
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = request.headers.get('Origin');

    if (origin && !isAllowedOrigin(origin)) {
      return new Response('Forbidden: CORS policy does not allow this origin.', { status: 403 });
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    if (url.pathname === '/api/openapi.json' && request.method === 'GET') {
      return new Response(JSON.stringify(openApiSchema), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let overpassQuery = '';
    let isGetApi = false;

    if (request.method === 'GET') {
      if (url.pathname === '/api/neighborhoods') {
        const bbox = url.searchParams.get('bbox');
        if (!bbox) return new Response('Missing bbox parameter', { status: 400, headers: corsHeaders });
        overpassQuery = buildNeighborhoodsQuery(bbox);
        isGetApi = true;
      } else if (url.pathname === '/api/roads') {
        const bbox = url.searchParams.get('bbox');
        const mode = url.searchParams.get('mode') || 'walk';
        const safety = url.searchParams.get('safety') || 'any';
        if (!bbox) return new Response('Missing bbox parameter', { status: 400, headers: corsHeaders });
        overpassQuery = buildRoadQuery(bbox, mode, safety);
        isGetApi = true;
      }
    }

    if (!isGetApi && request.method !== 'POST') {
      return new Response('Method not allowed.', { status: 405, headers: corsHeaders });
    }

    try {
      let bodyText = '';
      let contentType = 'application/x-www-form-urlencoded';

      if (isGetApi) {
        bodyText = 'data=' + encodeURIComponent(overpassQuery);
      } else {
        bodyText = await request.text();
        contentType = request.headers.get('Content-Type') || 'application/x-www-form-urlencoded';
      }

      let lastResponse: Response | null = null;

      for (const endpoint of ENDPOINTS) {
        try {
          const overpassResponse = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': contentType,
              'Accept': '*/*',
              'User-Agent': 'RotasOptimizer/1.0 (https://rotas.cc/)',
              'Referer': 'https://rotas.cc/',
            },
            body: bodyText,
          });

          if (!shouldFallback(overpassResponse.status)) {
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
          console.error(`[proxy] fetch error for ${endpoint}:`, err);
        }
      }

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
