import polyline from '@mapbox/polyline';
import LZString from 'lz-string';

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
  const encodedPolyline = polyline.encode(coordinates, 5);
  
  // Compress it further for massive routes to prevent HTTP 431 errors
  return LZString.compressToEncodedURIComponent(encodedPolyline);
}

/**
 * Decodes a compressed polyline string back into an array of {lat, lng} points.
 */
export function decodeRoute(encoded: string): Point[] {
  if (!encoded) {
    return [];
  }
  
  try {
    let polylineStr = '';
    
    // URLs may lose their '+' encoding and convert to spaces, fix them
    const safeEncoded = encoded.replace(/ /g, '+');
    
    // LZString compressToEncodedURIComponent strictly uses A-Za-z0-9+-$
    // If the encoded string contains typical polyline ascii characters like ?, @, \, {, }
    // It means this is an old uncompressed URL. We must NOT pass it to decompress.
    if (/[?@\\{}_^~`]/.test(safeEncoded)) {
      polylineStr = safeEncoded;
    } else {
      polylineStr = LZString.decompressFromEncodedURIComponent(safeEncoded) || safeEncoded;
    }
    
    const coordinates = polyline.decode(polylineStr, 5);
    return coordinates.map(coord => ({
      lat: coord[0],
      lng: coord[1]
    }));
  } catch (err) {
    console.error('Failed to decode route from URL:', err);
    return [];
  }
}
