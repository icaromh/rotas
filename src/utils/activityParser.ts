import { gunzipSync, unzipSync } from 'fflate';

export interface LocalActivity {
  id: string;
  name: string;
  /** GeoJSON order: [lng, lat][] */
  coordinates: [number, number][];
  importedAt: string;
}

export interface ActivityFeatureCollection {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    geometry: {
      type: 'LineString';
      coordinates: [number, number][];
    };
    properties: {
      id: string;
      name: string;
    };
  }[];
}

const MAX_POINTS_PER_ACTIVITY = 600;

/**
 * Evenly downsamples a coordinate array while preserving the first and last points.
 */
export function simplifyCoordinates(
  coords: [number, number][],
  maxPoints = MAX_POINTS_PER_ACTIVITY
): [number, number][] {
  if (coords.length <= maxPoints) return coords;
  const result: [number, number][] = [coords[0]];
  const step = (coords.length - 1) / (maxPoints - 1);
  for (let i = 1; i < maxPoints - 1; i++) {
    result.push(coords[Math.round(i * step)]);
  }
  result.push(coords[coords.length - 1]);
  return result;
}

/**
 * Parses a GPX XML string into a LocalActivity (or null if < 2 points).
 */
export function parseGpx(xmlText: string, fallbackName: string): LocalActivity | null {
  const nameMatch = xmlText.match(/<name[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/name>/i);
  const name = (nameMatch?.[1]?.trim() || fallbackName).replace(/\.gpx(\.gz)?$/i, '');

  const coords: [number, number][] = [];
  const ptRegex = /<(?:trkpt|rtept)\b[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = ptRegex.exec(xmlText)) !== null) {
    const tag = match[0];
    const latMatch = tag.match(/\blat=["']([^"']+)["']/i);
    const lonMatch = tag.match(/\blon=["']([^"']+)["']/i);
    if (latMatch && lonMatch) {
      const lat = Number(latMatch[1]);
      const lng = Number(lonMatch[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        coords.push([lng, lat]);
      }
    }
  }

  if (coords.length < 2) return null;

  return {
    id: crypto.randomUUID(),
    name,
    coordinates: simplifyCoordinates(coords),
    importedAt: new Date().toISOString(),
  };
}

/**
 * Parses a TCX XML string into a LocalActivity (or null if < 2 points).
 */
export function parseTcx(xmlText: string, fallbackName: string): LocalActivity | null {
  const nameMatch =
    xmlText.match(/<Notes[^>]*>([\s\S]*?)<\/Notes>/i) ||
    xmlText.match(/<Id[^>]*>([\s\S]*?)<\/Id>/i);
  const name = (nameMatch?.[1]?.trim() || fallbackName).replace(/\.tcx(\.gz)?$/i, '');

  const coords: [number, number][] = [];
  const posRegex =
    /<Position[^>]*>[\s\S]*?<LatitudeDegrees[^>]*>([^<]+)<\/LatitudeDegrees>[\s\S]*?<LongitudeDegrees[^>]*>([^<]+)<\/LongitudeDegrees>[\s\S]*?<\/Position>/gi;
  let match: RegExpExecArray | null;

  while ((match = posRegex.exec(xmlText)) !== null) {
    const lat = Number(match[1].trim());
    const lng = Number(match[2].trim());
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      coords.push([lng, lat]);
    }
  }

  if (coords.length < 2) return null;

  return {
    id: crypto.randomUUID(),
    name,
    coordinates: simplifyCoordinates(coords),
    importedAt: new Date().toISOString(),
  };
}

/**
 * Parses a GeoJSON FeatureCollection, Feature, or LineString/MultiLineString into LocalActivities.
 */
export function parseGeoJson(jsonText: string, fallbackName: string): LocalActivity[] {
  const parsed = JSON.parse(jsonText);
  const activities: LocalActivity[] = [];
  const now = new Date().toISOString();

  const extractGeometry = (geometry: any, name: string) => {
    if (!geometry) return;
    if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) {
      const coords = geometry.coordinates
        .filter((c: any) => Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]))
        .map((c: any) => [Number(c[0]), Number(c[1])] as [number, number]);
      if (coords.length >= 2) {
        activities.push({
          id: crypto.randomUUID(),
          name,
          coordinates: simplifyCoordinates(coords),
          importedAt: now,
        });
      }
    } else if (geometry.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) {
      geometry.coordinates.forEach((line: any, idx: number) => {
        extractGeometry({ type: 'LineString', coordinates: line }, `${name} #${idx + 1}`);
      });
    }
  };

  if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
    parsed.features.forEach((feature: any, idx: number) => {
      const name = feature?.properties?.name || `${fallbackName} #${idx + 1}`;
      extractGeometry(feature?.geometry, name);
    });
  } else if (parsed.type === 'Feature') {
    extractGeometry(parsed.geometry, parsed?.properties?.name || fallbackName);
  } else {
    extractGeometry(parsed, fallbackName);
  }

  return activities;
}

const decoder = new TextDecoder();

/**
 * Parses a single binary payload by filename (.gpx, .gpx.gz, .tcx, .tcx.gz, .geojson, .json, .zip).
 */
export function parseActivityBytes(bytes: Uint8Array, fileName: string): LocalActivity[] {
  const lower = fileName.toLowerCase();

  if (lower.endsWith('.zip')) {
    const entries = unzipSync(bytes);
    const results: LocalActivity[] = [];
    for (const [entryPath, entryBytes] of Object.entries(entries)) {
      const baseName = entryPath.split('/').pop() || entryPath;
      if (baseName.startsWith('.') || entryPath.includes('__MACOSX')) continue;
      if (
        baseName.toLowerCase().endsWith('.gpx') ||
        baseName.toLowerCase().endsWith('.gpx.gz') ||
        baseName.toLowerCase().endsWith('.tcx') ||
        baseName.toLowerCase().endsWith('.tcx.gz') ||
        baseName.toLowerCase().endsWith('.geojson')
      ) {
        try {
          results.push(...parseActivityBytes(entryBytes, baseName));
        } catch {
          // Skip malformed entries inside bulk export archives
        }
      }
    }
    return results;
  }

  const rawBytes = lower.endsWith('.gz') ? gunzipSync(bytes) : bytes;
  const unwrappedName = lower.endsWith('.gz') ? fileName.slice(0, -3) : fileName;
  const unwrappedLower = unwrappedName.toLowerCase();
  const text = decoder.decode(rawBytes);

  if (unwrappedLower.endsWith('.gpx')) {
    const act = parseGpx(text, unwrappedName);
    return act ? [act] : [];
  }

  if (unwrappedLower.endsWith('.tcx')) {
    const act = parseTcx(text, unwrappedName);
    return act ? [act] : [];
  }

  if (unwrappedLower.endsWith('.geojson') || unwrappedLower.endsWith('.json')) {
    return parseGeoJson(text, unwrappedName);
  }

  return [];
}

/**
 * Parses one or more browser File objects into LocalActivities.
 */
export async function parseActivityFiles(files: FileList | File[]): Promise<LocalActivity[]> {
  const results: LocalActivity[] = [];
  for (const file of Array.from(files)) {
    const buffer = await file.arrayBuffer();
    const parsed = parseActivityBytes(new Uint8Array(buffer), file.name);
    results.push(...parsed);
  }
  return results;
}

/**
 * Converts stored LocalActivities into a GeoJSON FeatureCollection for Leaflet.
 */
export function activitiesToFeatureCollection(
  activities: LocalActivity[]
): ActivityFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: activities.map((activity) => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: activity.coordinates,
      },
      properties: {
        id: activity.id,
        name: activity.name,
      },
    })),
  };
}
