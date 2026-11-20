/**
 * Overpass API proxy with per-endpoint timeouts, multi-instance fallback,
 * and Cloudflare Cache API edge caching.
 */

export const ALLOWED_ORIGINS = [
  'https://rotas.cc',
  'https://www.rotas.cc',
  'https://rotas.icaromh.com',
];

/**
 * Public Overpass API instances with global data coverage.
 * Ordered by reliability and capacity.
 */
export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

export const PER_ENDPOINT_TIMEOUT_MS = 15_000;
export const ROAD_NETWORK_CACHE_TTL_SECONDS = 60 * 60 * 24; // 24 hours
export const NEIGHBORHOOD_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export function isAllowedOrigin(origin: string | null, requestUrl?: string): boolean {
  if (!origin) return true; // Same-origin or non-browser request without Origin header

  if (requestUrl) {
    try {
      if (new URL(requestUrl).origin === origin) {
        return true;
      }
    } catch {
      // Ignore malformed URL
    }
  }

  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
    return true;
  }

  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * Status codes that should trigger a fallback to the next Overpass instance:
 * - 406: anti-bot firewall
 * - 408: request timeout
 * - 429: rate-limited
 * - 5xx: server-side overload or gateway timeout
 */
export function shouldFallback(status: number): boolean {
  return status === 406 || status === 408 || status === 429 || status >= 500;
}

/**
 * Normalizes whitespace in an Overpass QL query for deterministic cache keys.
 */
export function normalizeOverpassQuery(bodyText: string): string {
  return bodyText.replace(/\s+/g, ' ').trim();
}

/**
 * Determines cache TTL based on query type (neighborhood boundaries change rarely).
 */
export function getCacheTtlSeconds(bodyText: string): number {
  const decoded = decodeURIComponentSafe(bodyText);
  if (decoded.includes('admin_level') || decoded.includes('neighbourhood')) {
    return NEIGHBORHOOD_CACHE_TTL_SECONDS;
  }
  return ROAD_NETWORK_CACHE_TTL_SECONDS;
}

function decodeURIComponentSafe(input: string): string {
  try {
    return decodeURIComponent(input);
  } catch {
    return input;
  }
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function handleOverpassRequest(
  request: Request,
  ctx: ExecutionContext
): Promise<Response> {
  const origin = request.headers.get('Origin');

  if (origin && !isAllowedOrigin(origin, request.url)) {
    return new Response('Forbidden: CORS policy does not allow this origin.', { status: 403 });
  }

  const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed. Use POST.', {
      status: 405,
      headers: corsHeaders,
    });
  }

  try {
    const bodyText = await request.text();
    const contentType = request.headers.get('Content-Type') || 'application/x-www-form-urlencoded';
    const normalizedBody = normalizeOverpassQuery(bodyText);
    const cacheHash = await sha256Hex(normalizedBody);
    const cacheKey = new Request(`https://rotas-overpass-cache.internal/${cacheHash}`, {
      method: 'GET',
    });

    // 1. Check Cloudflare Cache API (if available in runtime)
    const cache = typeof caches !== 'undefined' ? caches.default : undefined;
    if (cache) {
      const cached = await cache.match(cacheKey);
      if (cached) {
        const headers = new Headers(cached.headers);
        Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
        headers.set('X-Rotas-Cache', 'HIT');
        return new Response(cached.body, {
          status: cached.status,
          headers,
        });
      }
    }

    // 2. Fallback loop across Overpass endpoints with per-endpoint timeout
    let lastResponse: Response | null = null;
    let lastError: string | null = null;

    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const overpassResponse = await fetchWithTimeout(
          endpoint,
          {
            method: 'POST',
            headers: {
              'Content-Type': contentType,
              Accept: 'application/json, */*',
              'User-Agent': 'RotasOptimizer/2.0 (https://rotas.cc/)',
              Referer: 'https://rotas.cc/',
            },
            body: bodyText,
          },
          PER_ENDPOINT_TIMEOUT_MS
        );

        if (!shouldFallback(overpassResponse.status)) {
          const responseBody = await overpassResponse.text();
          const responseContentType =
            overpassResponse.headers.get('Content-Type') || 'application/json';
          const ttl = getCacheTtlSeconds(normalizedBody);

          const clientResponse = new Response(responseBody, {
            status: overpassResponse.status,
            headers: {
              ...corsHeaders,
              'Content-Type': responseContentType,
              'X-Rotas-Cache': 'MISS',
              'X-Overpass-Upstream': new URL(endpoint).hostname,
              ...(overpassResponse.ok
                ? { 'Cache-Control': `public, max-age=${ttl}` }
                : {}),
            },
          });

          // Cache successful JSON responses at the edge
          if (cache && overpassResponse.ok && responseContentType.includes('json')) {
            const cacheable = new Response(responseBody, {
              status: 200,
              headers: {
                'Content-Type': responseContentType,
                'Cache-Control': `public, max-age=${ttl}`,
                'X-Overpass-Upstream': new URL(endpoint).hostname,
              },
            });
            ctx.waitUntil(cache.put(cacheKey, cacheable));
          }

          return clientResponse;
        }

        console.warn(`[overpass] ${endpoint} returned ${overpassResponse.status} — trying next`);
        lastResponse = overpassResponse;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        lastError = message;
        console.warn(`[overpass] ${endpoint} failed (${message}) — trying next`);
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

    return new Response(
      JSON.stringify({
        error: 'All Overpass API endpoints failed to respond.',
        details: lastError,
      }),
      {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: 'Proxy fetch failed', details: message }),
      {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}
