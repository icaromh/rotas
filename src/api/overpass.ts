/**
 * Overpass API client.
 *
 * All requests are routed through the Cloudflare Worker proxy which handles:
 *  - CORS headers
 *  - Fallback across multiple public Overpass instances
 *  - 429 / 5xx retry logic
 */
const API_BASE_URL = 'https://api.rotas.cc/api';

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
 * Fetches data from the proxy using GET.
 */
async function fetchGetApi(url: string): Promise<OverpassResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
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
  const url = `${API_BASE_URL}/neighborhoods?bbox=${encodeURIComponent(bbox)}`;
  return fetchGetApi(url);
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

  const url = `${API_BASE_URL}/roads?bbox=${encodeURIComponent(bbox)}&mode=${encodeURIComponent(mode)}&safety=${encodeURIComponent(safety)}`;
  console.log('[API] Requesting:', url);

  const data = await fetchGetApi(url);
  console.log(`[API] Received ${(data as any).elements?.length ?? 0} elements from Overpass.`);
  return data;
}
