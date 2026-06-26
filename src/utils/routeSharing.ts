import polyline from '@mapbox/polyline';

export interface Point {
  lat: number;
  lng: number;
}

/**
 * Encodes an array of {lat, lng} points into a highly compressed polyline string.
 * This string is safe to be used in URLs.
 */
export function encodeRoute(path: Point[]): string {
  if (!path || path.length === 0) {
    return '';
  }
  
  // mapbox/polyline expects [lat, lng] arrays
  const coordinates: [number, number][] = path.map(p => [p.lat, p.lng]);
  
  // precision of 5 is standard (1 meter accuracy)
  return polyline.encode(coordinates, 5);
}

/**
 * Decodes a polyline string back into an array of {lat, lng} points.
 */
export function decodeRoute(encoded: string): Point[] {
  if (!encoded) {
    return [];
  }
  
  try {
    const coordinates = polyline.decode(encoded, 5);
    return coordinates.map(coord => ({
      lat: coord[0],
      lng: coord[1]
    }));
  } catch (err) {
    console.error('Failed to decode route from URL:', err);
    return [];
  }
}
