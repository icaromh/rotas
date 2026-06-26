import { describe, it, expect } from 'vitest';
import { encodeRoute, decodeRoute } from '../src/utils/routeSharing';

describe('Route Sharing Utility', () => {
  const samplePath = [
    { lat: -23.55052, lng: -46.63330 }, // São Paulo
    { lat: -22.90684, lng: -43.17289 }, // Rio de Janeiro
    { lat: -19.91668, lng: -43.93449 }  // Belo Horizonte
  ];

  it('should encode and decode a route back to its original coordinates', () => {
    const encoded = encodeRoute(samplePath);
    
    // Check that encoded string is not empty
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);
    
    const decoded = decodeRoute(encoded);
    
    // Check length
    expect(decoded.length).toBe(samplePath.length);
    
    // Due to polyline precision (5 decimal places), we check within a small epsilon
    decoded.forEach((point, index) => {
      expect(point.lat).toBeCloseTo(samplePath[index].lat, 4);
      expect(point.lng).toBeCloseTo(samplePath[index].lng, 4);
    });
  });

  it('should handle empty paths gracefully', () => {
    expect(encodeRoute([])).toBe('');
    expect(decodeRoute('')).toEqual([]);
  });

  it('should handle invalid strings safely', () => {
    // Decoding random junk shouldn't crash, it just returns empty if Mapbox polyline throws,
    // though Mapbox polyline might just return weird coordinates for some random strings.
    // Let's pass a totally illegal character for base64 polyline to trigger error if we want,
    // but honestly just verifying it doesn't break the app is enough.
    // '!!!' is completely invalid for polyline
    const decoded = decodeRoute('!!!');
    expect(Array.isArray(decoded)).toBe(true);
  });
});
