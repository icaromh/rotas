/**
 * Overpass API client.
 *
 * All requests are routed through the same-origin Cloudflare Worker endpoint
 * (`/api/overpass`) which handles:
 *  - Per-endpoint timeouts and fallback across multiple public Overpass instances
 *  - Edge caching via Cloudflare Cache API
 *  - 406 / 408 / 429 / 5xx retry logic
 */
const PROXY_URL = import.meta.env.VITE_OVERPASS_PROXY_URL || '/api/overpass';
const ROADS_API_URL = import.meta.env.VITE_ROADS_API_URL || '/api/roads';

const TIMEOUT_MS = 60_000;

export interface OverpassResponse {
  elements: {
    type: string;
    id: number;
    [key: string]: unknown;
  }[];
  [key: string]: unknown;
}

/**
 * Sends an Overpass QL query through the proxy with a timeout and consistent
 * form-encoded body (`data=<query>`).
 */
async function queryOverpass(query: string): Promise<OverpassResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(query),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Overpass API request timed out after 60 s. Please try again.');
    }
    throw new Error(`Network error reaching Overpass proxy: ${err.message}`);
  }

  clearTimeout(timeoutId);

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error('All Overpass API instances are rate-limiting right now. Please wait a minute and try again.');
    }
    throw new Error(`Overpass proxy returned HTTP ${response.status}.`);
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
      relation["admin_level"~"9|10"](${bbox});
      relation["place"~"neighbourhood|suburb"](${bbox});
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

  const bboxTuple: [number, number, number, number] = [minLat, minLng, maxLat, maxLng];

  // Primary: Overture Maps PMTiles via Cloudflare Worker (/api/roads) — fast, reliable, no rate limits
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);
    const res = await fetch(ROADS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bbox: bboxTuple, mode, safety }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = (await res.json()) as OverpassResponse;
      if (Array.isArray(data.elements) && data.elements.length > 0) {
        console.log(
          `[API] Received ${data.elements.length} elements from Overture Maps (${res.headers.get('X-Rotas-Road-Source') || 'overture'}).`
        );
        return data;
      }
    }
    console.warn(`[API] /api/roads returned HTTP ${res.status} or empty graph — falling back to Overpass.`);
  } catch (err: any) {
    console.warn(`[API] /api/roads failed (${err.message}) — falling back to Overpass.`);
  }

  // Fallback: Overpass API proxy
  const bbox = `${minLat},${minLng},${maxLat},${maxLng}`;
  const query = buildRoadQuery(bbox, mode, safety);
  console.log('[API] Overpass fallback query:', query);

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
