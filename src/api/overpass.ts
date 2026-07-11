/**
 * Overpass API client.
 *
 * All requests are routed through the Cloudflare Worker proxy which handles:
 *  - CORS headers
 *  - Fallback across multiple public Overpass instances
 *  - 429 / 5xx retry logic
 *
 * The proxy itself forwards to (in order):
 *   1. https://overpass-api.de (FOSSGIS — main instance)
 *   2. https://maps.mail.ru/osm/tools/overpass (VK Maps — no rate limit)
 *   3. https://overpass.private.coffee (Private.coffee — no rate limit)
 */
const PROXY_URL = 'https://api.rotas.cc/proxy';

const TIMEOUT_MS = 60_000;

export interface OverpassResponse {
  elements: {
    type: string;
    id: number;
    [key: string]: unknown;
  }[];
  [key: string]: unknown;
}

const FALLBACK_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

/**
 * Sends an Overpass QL query through the proxy with a timeout and consistent
 * form-encoded body (`data=<query>`). Falls back to public APIs if proxy fails.
 */
async function queryOverpass(query: string): Promise<OverpassResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const fetchOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query),
    signal: controller.signal,
  };

  let response: Response | undefined;
  
  // 1. Tentar o Proxy
  try {
    response = await fetch(PROXY_URL, fetchOptions);
  } catch (err: any) {
    console.warn(`[API] Erro ao acessar proxy ${PROXY_URL}:`, err.message);
  }

  // 2. Se o proxy falhou na rede ou retornou erro (ex: DNS down), tenta os fallbacks
  if (!response || !response.ok) {
    if (response && response.status === 429) {
      clearTimeout(timeoutId);
      throw new Error('All Overpass API instances are rate-limiting right now. Please wait a minute and try again.');
    }
    
    console.warn(`[API] Iniciando fallback para endpoints públicos do Overpass...`);
    for (const endpoint of FALLBACK_ENDPOINTS) {
      try {
        const fbResponse = await fetch(endpoint, fetchOptions);
        if (fbResponse.ok) {
          response = fbResponse;
          console.log(`[API] Fallback bem sucedido com ${endpoint}`);
          break;
        } else {
          console.warn(`[API] Fallback ${endpoint} retornou ${fbResponse.status}`);
        }
      } catch (fbErr: any) {
        console.warn(`[API] Fallback ${endpoint} falhou:`, fbErr.message);
      }
    }
  }

  clearTimeout(timeoutId);

  if (!response) {
    throw new Error('Network error reaching Overpass proxy and all fallbacks failed.');
  }

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('All Overpass API instances are rate-limiting right now. Please wait a minute and try again.');
    }
    throw new Error(`Overpass proxy and fallbacks returned HTTP ${response.status}.`);
  }

  return response.json() as Promise<OverpassResponse>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function fetchNeighborhoods(bbox: string): Promise<OverpassResponse> {
  const query = `
    [out:json][timeout:25];
    (
      way["admin_level"~"9|10|11"](${bbox});
      relation["admin_level"~"9|10|11"](${bbox});
      way["place"~"neighbourhood|suburb|quarter"](${bbox});
      relation["place"~"neighbourhood|suburb|quarter"](${bbox});
    );
    out geom;
  `;

  return queryOverpass(query);
}

export async function fetchRoadNetwork(
  polygon: { lat: number; lng: number }[],
  mode: 'bike' | 'walk',
  bufferMeters = 20,
  safety = 'any'
): Promise<OverpassResponse> {
  console.log(`[API] fetchRoadNetwork — mode: ${mode}, buffer: ${bufferMeters}m, safety: ${safety}`);

  // Build bounding box from polygon vertices + fetch buffer
  let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
  for (const p of polygon) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  const fetchBufferDegrees = Math.max(0.001, bufferMeters * 0.00001 + 0.001);
  minLat -= fetchBufferDegrees;
  maxLat += fetchBufferDegrees;
  minLng -= fetchBufferDegrees;
  maxLng += fetchBufferDegrees;

  const bbox = `${minLat},${minLng},${maxLat},${maxLng}`;

  const query = buildRoadQuery(bbox, mode, safety);
  console.log('[API] Overpass query:', query);

  const data = await queryOverpass(query);
  console.log(`[API] Received ${(data as any).elements?.length ?? 0} elements from Overpass.`);
  return data;
}

// ---------------------------------------------------------------------------
// Query builders
// ---------------------------------------------------------------------------

function buildRoadQuery(bbox: string, mode: 'bike' | 'walk', safety: string): string {
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
      way${wayFilter}(${bbox});
    );
    out body;
    >;
    out skel qt;
  `;
}
