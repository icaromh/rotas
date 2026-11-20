import { PMTiles } from 'pmtiles';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';

const STAC_CATALOG_URL = 'https://stac.overturemaps.org/catalog.json';
const FALLBACK_RELEASE = '2026-11-18.0';
const OVERTURE_TILES_BASE = 'https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com/tiles';

const RELEASE_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const ROAD_GRAPH_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const TARGET_ZOOM = 14;
const MAX_TILES_PER_REQUEST = 16;

let cachedRelease: { version: string; expiresAt: number } | null = null;
const pmtilesInstances = new Map<string, PMTiles>();

export interface RoadQueryRequest {
  /** [minLat, minLng, maxLat, maxLng] */
  bbox: [number, number, number, number];
  mode: 'bike' | 'walk';
  safety: 'any' | 'safe' | 'strict';
}

export interface OsmNodeElement {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
}

export interface OsmWayElement {
  type: 'way';
  id: number;
  nodes: number[];
  tags: Record<string, string>;
}

export interface RoadGraphResponse {
  elements: (OsmNodeElement | OsmWayElement)[];
  source: 'overture';
  release: string;
}

/**
 * Resolves the latest Overture Maps release string from the official STAC catalog,
 * caching it in-memory for 6 hours (with fallback if STAC is unreachable).
 */
export async function getLatestOvertureRelease(): Promise<string> {
  if (cachedRelease && Date.now() < cachedRelease.expiresAt) {
    return cachedRelease.version;
  }

  try {
    const res = await fetch(STAC_CATALOG_URL, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const catalog = (await res.json()) as {
        latest?: string;
        links?: { rel?: string; title?: string }[];
      };
      const version =
        catalog.latest ||
        catalog.links
          ?.filter((l) => l.rel === 'child' && l.title)
          .pop()
          ?.title?.split(' ')[0];

      if (version && /^\d{4}-\d{2}-\d{2}\.\d+$/.test(version)) {
        cachedRelease = {
          version,
          expiresAt: Date.now() + RELEASE_CACHE_TTL_MS,
        };
        return version;
      }
    }
  } catch (err) {
    console.warn('[overture] Failed to fetch STAC catalog, using fallback release:', err);
  }

  return FALLBACK_RELEASE;
}

/**
 * Converts lon/lat to XYZ slippy tile indices at zoom z.
 */
export function lonLatToTile(lon: number, lat: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

/**
 * Computes all XYZ tiles covering a [minLat, minLng, maxLat, maxLng] bounding box.
 */
export function bboxToTiles(
  bbox: [number, number, number, number],
  z = TARGET_ZOOM
): { z: number; x: number; y: number }[] {
  const [minLat, minLng, maxLat, maxLng] = bbox;
  const nw = lonLatToTile(minLng, maxLat, z);
  const se = lonLatToTile(maxLng, minLat, z);

  const tiles: { z: number; x: number; y: number }[] = [];
  for (let x = Math.min(nw.x, se.x); x <= Math.max(nw.x, se.x); x++) {
    for (let y = Math.min(nw.y, se.y); y <= Math.max(nw.y, se.y); y++) {
      tiles.push({ z, x, y });
    }
  }
  return tiles;
}

const BIKE_ANY_CLASSES = new Set([
  'primary',
  'secondary',
  'tertiary',
  'unclassified',
  'residential',
  'living_street',
  'pedestrian',
  'cycleway',
]);

const BIKE_SAFE_CLASSES = new Set([
  'secondary',
  'tertiary',
  'unclassified',
  'residential',
  'living_street',
  'pedestrian',
  'cycleway',
]);

const WALK_CLASSES = new Set([
  'primary',
  'secondary',
  'tertiary',
  'unclassified',
  'residential',
  'living_street',
  'pedestrian',
]);

/**
 * Returns true if an Overture transportation segment matches the requested mode & safety filter.
 */
export function matchesRoadFilter(
  properties: Record<string, unknown>,
  mode: 'bike' | 'walk',
  safety: 'any' | 'safe' | 'strict'
): boolean {
  if (properties.subtype !== 'road') return false;
  const roadClass = String(properties.class || '');

  if (mode === 'bike') {
    if (safety === 'strict') {
      return roadClass === 'cycleway';
    }
    if (safety === 'safe') {
      return BIKE_SAFE_CLASSES.has(roadClass);
    }
    return BIKE_ANY_CLASSES.has(roadClass);
  }

  return WALK_CLASSES.has(roadClass);
}

/**
 * Parses Overture `access_restrictions` JSON to determine one-way directionality for cycling.
 * Returns:
 * - 'forward': one-way in geometry order (standard `oneway=yes`)
 * - 'backward': one-way opposite to geometry order (reverse nodes + `oneway=yes`)
 * - 'both': bidirectional
 */
export function parseOnewayDirection(
  accessRestrictionsRaw: unknown,
  mode: 'bike' | 'walk'
): 'forward' | 'backward' | 'both' {
  if (mode === 'walk' || typeof accessRestrictionsRaw !== 'string') {
    return 'both';
  }

  try {
    const rules = JSON.parse(accessRestrictionsRaw) as {
      access_type?: string;
      when?: {
        heading?: string;
        mode?: string[];
      };
    }[];

    if (!Array.isArray(rules)) return 'both';

    let deniedBackward = false;
    let deniedForward = false;
    let bicycleExplicitlyAllowedBoth = false;

    for (const rule of rules) {
      const modes = rule.when?.mode;
      const appliesToBike = !modes || modes.length === 0 || modes.includes('bicycle');

      if (
        rule.access_type === 'allowed' &&
        modes?.includes('bicycle') &&
        !rule.when?.heading
      ) {
        bicycleExplicitlyAllowedBoth = true;
      }

      if (rule.access_type === 'denied' && appliesToBike) {
        if (rule.when?.heading === 'backward') deniedBackward = true;
        if (rule.when?.heading === 'forward') deniedForward = true;
      }
    }

    if (bicycleExplicitlyAllowedBoth) return 'both';
    if (deniedBackward && !deniedForward) return 'forward';
    if (deniedForward && !deniedBackward) return 'backward';
  } catch {
    // Ignore malformed JSON
  }

  return 'both';
}

function getPMTilesClient(release: string): PMTiles {
  const url = `${OVERTURE_TILES_BASE}/${release}/transportation.pmtiles`;
  let client = pmtilesInstances.get(url);
  if (!client) {
    client = new PMTiles(url);
    pmtilesInstances.set(url, client);
  }
  return client;
}

/**
 * Decodes Overture MVT tiles and builds an Overpass-compatible `{ elements }` road graph.
 * Vertices are snapped to a 1e-5° (~1.1m) spatial grid so intersections and tile boundaries
 * share identical node IDs.
 */
export function buildOsmElementsFromTiles(
  decodedTiles: { z: number; x: number; y: number; data: ArrayBuffer }[],
  bbox: [number, number, number, number],
  mode: 'bike' | 'walk',
  safety: 'any' | 'safe' | 'strict'
): (OsmNodeElement | OsmWayElement)[] {
  const [minLat, minLng, maxLat, maxLng] = bbox;

  const nodeIdByCoord = new Map<string, number>();
  const nodes: OsmNodeElement[] = [];
  const ways: OsmWayElement[] = [];
  const seenEdges = new Set<string>();

  let nextNodeId = 1;
  let nextWayId = 1;

  const getOrCreateNodeId = (lng: number, lat: number): number => {
    // Snap to 1e-5° (~1.1m) to guarantee shared nodes at intersections and tile seams
    const key = `${Math.round(lat * 1e5)},${Math.round(lng * 1e5)}`;
    const existing = nodeIdByCoord.get(key);
    if (existing !== undefined) return existing;

    const id = nextNodeId++;
    nodeIdByCoord.set(key, id);
    nodes.push({ type: 'node', id, lat, lon: lng });
    return id;
  };

  for (const tile of decodedTiles) {
    const vt = new VectorTile(new PbfReader(new Uint8Array(tile.data)));
    const segmentLayer = vt.layers.segment;
    if (!segmentLayer) continue;

    for (let i = 0; i < segmentLayer.length; i++) {
      const feature = segmentLayer.feature(i);
      const props = feature.properties as Record<string, unknown>;

      if (!matchesRoadFilter(props, mode, safety)) continue;

      const geojson = feature.toGeoJSON(tile.x, tile.y, tile.z);
      const lines: number[][][] =
        geojson.geometry.type === 'LineString'
          ? [geojson.geometry.coordinates]
          : geojson.geometry.type === 'MultiLineString'
            ? geojson.geometry.coordinates
            : [];

      const onewayDir = parseOnewayDirection(props.access_restrictions, mode);
      const tags: Record<string, string> = {
        highway: String(props.class || 'road'),
      };
      if (onewayDir !== 'both') {
        tags.oneway = 'yes';
      }

      for (const rawLine of lines) {
        if (rawLine.length < 2) continue;

        // Quick bbox reject
        let intersectsBbox = false;
        for (const pt of rawLine) {
          const [lng, lat] = pt;
          if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
            intersectsBbox = true;
            break;
          }
        }
        if (!intersectsBbox) continue;

        const orderedLine = onewayDir === 'backward' ? [...rawLine].reverse() : rawLine;
        const wayNodes: number[] = [];

        for (const [lng, lat] of orderedLine) {
          const nodeId = getOrCreateNodeId(lng, lat);
          if (wayNodes.length === 0 || wayNodes[wayNodes.length - 1] !== nodeId) {
            wayNodes.push(nodeId);
          }
        }

        if (wayNodes.length < 2) continue;

        // Deduplicate identical edge runs across tile buffer overlaps
        const edgeSig = `${wayNodes.join('-')}:${tags.oneway || '0'}`;
        if (seenEdges.has(edgeSig)) continue;
        seenEdges.add(edgeSig);

        ways.push({
          type: 'way',
          id: nextWayId++,
          nodes: wayNodes,
          tags,
        });
      }
    }
  }

  return [...nodes, ...ways];
}

export async function fetchRoadGraphFromOverture(
  req: RoadQueryRequest
): Promise<RoadGraphResponse> {
  const tiles = bboxToTiles(req.bbox, TARGET_ZOOM);
  if (tiles.length === 0 || tiles.length > MAX_TILES_PER_REQUEST) {
    throw new Error(
      `Requested area spans ${tiles.length} tiles (limit: ${MAX_TILES_PER_REQUEST}).`
    );
  }

  const release = await getLatestOvertureRelease();
  const pm = getPMTilesClient(release);

  const fetched = await Promise.all(
    tiles.map(async (t) => {
      const result = await pm.getZxy(t.z, t.x, t.y);
      return result?.data ? { ...t, data: result.data } : null;
    })
  );

  const validTiles = fetched.filter(
    (t): t is { z: number; x: number; y: number; data: ArrayBuffer } => t !== null
  );

  const elements = buildOsmElementsFromTiles(validTiles, req.bbox, req.mode, req.safety);

  return {
    elements,
    source: 'overture',
    release,
  };
}

/**
 * HTTP handler for POST /api/roads with Cloudflare Cache API caching.
 */
export async function handleRoadsRequest(
  request: Request,
  ctx: ExecutionContext
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed. Use POST.' }, { status: 405 });
  }

  try {
    const body = (await request.json()) as Partial<RoadQueryRequest>;
    if (
      !Array.isArray(body.bbox) ||
      body.bbox.length !== 4 ||
      body.bbox.some((v) => typeof v !== 'number' || !Number.isFinite(v))
    ) {
      return Response.json({ error: 'Invalid bbox. Expected [minLat, minLng, maxLat, maxLng].' }, { status: 400 });
    }

    const mode: 'bike' | 'walk' = body.mode === 'walk' ? 'walk' : 'bike';
    const safety: 'any' | 'safe' | 'strict' =
      body.safety === 'safe' || body.safety === 'strict' ? body.safety : 'any';

    // Quantize bbox to 4 decimal places (~11m) for better edge cache hit rates
    const quantizedBbox = body.bbox.map((v) => Math.round(v * 1e4) / 1e4) as [
      number,
      number,
      number,
      number,
    ];

    const cacheKey = new Request(
      `https://rotas-roads-cache.internal/v1/${mode}/${safety}/${quantizedBbox.join(',')}`,
      { method: 'GET' }
    );

    const cache = typeof caches !== 'undefined' ? caches.default : undefined;
    if (cache) {
      const cached = await cache.match(cacheKey);
      if (cached) {
        const headers = new Headers(cached.headers);
        headers.set('X-Rotas-Cache', 'HIT');
        return new Response(cached.body, { status: 200, headers });
      }
    }

    const graph = await fetchRoadGraphFromOverture({
      bbox: quantizedBbox,
      mode,
      safety,
    });

    const payload = JSON.stringify(graph);
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${ROAD_GRAPH_CACHE_TTL_SECONDS}`,
      'X-Rotas-Cache': 'MISS',
      'X-Rotas-Road-Source': `overture:${graph.release}`,
    };

    if (cache) {
      ctx.waitUntil(
        cache.put(
          cacheKey,
          new Response(payload, {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': `public, max-age=${ROAD_GRAPH_CACHE_TTL_SECONDS}`,
              'X-Rotas-Road-Source': `overture:${graph.release}`,
            },
          })
        )
      );
    }

    return new Response(payload, { status: 200, headers });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[overture] Road graph request failed:', message);
    return Response.json({ error: message }, { status: 502 });
  }
}
