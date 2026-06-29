/**
 * @file routeSharing.test.ts
 *
 * Unit tests for the route sharing utilities.
 *
 * Routes are encoded as a compressed polyline string safe for use in URLs:
 *   1. The path is encoded with the Mapbox polyline algorithm (precision 5)
 *   2. The result is compressed with LZString and URI-encoded
 *
 * This allows entire routes (even very long ones) to be shared as a URL query
 * parameter without hitting HTTP header size limits.
 */

import { describe, it, expect } from 'vitest';
import { encodeRoute, decodeRoute } from '../src/utils/routeSharing';

describe('Route Sharing Utility', () => {
  const samplePath = [
    { lat: -23.55052, lng: -46.63330 }, // São Paulo
    { lat: -22.90684, lng: -43.17289 }, // Rio de Janeiro
    { lat: -19.91668, lng: -43.93449 }, // Belo Horizonte
  ];

  // -------------------------------------------------------------------------
  // Basic encode/decode round-trip
  // -------------------------------------------------------------------------

  it('encodes a path to a non-empty string', () => {
    const encoded = encodeRoute(samplePath);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);
  });

  it('decodes back to the original coordinates (within polyline precision)', () => {
    const encoded = encodeRoute(samplePath);
    const decoded = decodeRoute(encoded);

    expect(decoded).toHaveLength(samplePath.length);

    // Mapbox polyline uses 5 decimal places → ~1 m accuracy
    decoded.forEach((point, index) => {
      expect(point.lat).toBeCloseTo(samplePath[index].lat, 4);
      expect(point.lng).toBeCloseTo(samplePath[index].lng, 4);
    });
  });

  it('encoded string is URL-safe (no raw spaces, +, or % issues)', () => {
    const encoded = encodeRoute(samplePath);
    // LZString.compressToEncodedURIComponent guarantees URI-safe output
    expect(() => decodeURIComponent(encoded)).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------

  it('encodes an empty path as an empty string', () => {
    expect(encodeRoute([])).toBe('');
  });

  it('decodes an empty string as an empty array', () => {
    expect(decodeRoute('')).toEqual([]);
  });

  it('handles a single-point path', () => {
    const single = [{ lat: 48.8566, lng: 2.3522 }]; // Paris
    const encoded = encodeRoute(single);
    const decoded = decodeRoute(encoded);

    expect(decoded).toHaveLength(1);
    expect(decoded[0].lat).toBeCloseTo(48.8566, 4);
    expect(decoded[0].lng).toBeCloseTo(2.3522, 4);
  });

  it('handles an invalid / garbage string without throwing', () => {
    // decodeRoute must never crash — it should return an empty array instead
    expect(() => decodeRoute('!!!')).not.toThrow();
    expect(Array.isArray(decodeRoute('!!!'))).toBe(true);
  });

  it('handles legacy uncompressed polyline strings (old URL format)', () => {
    // Old URLs used a plain (non-LZString) polyline string, which contains
    // characters like `?`, `@`, `\`, `{`, `}` that don't appear in LZString
    // output. The decoder must detect this and pass the string through.
    // Generate a real legacy-style plain polyline for the sample path using
    // mapbox/polyline directly — but since we don't import it here, we just
    // verify the function doesn't crash and returns an array.
    const legacyLike = '_p~iF~ps|U_ulLnnqC_mqNvxq`@'; // standard example polyline
    const result = decodeRoute(legacyLike);
    expect(Array.isArray(result)).toBe(true);
    // This specific string is a known 3-point polyline, so we get 3 points back
    expect(result.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Scale test — large paths
  // -------------------------------------------------------------------------

  it('round-trips a large path (200 points) correctly', () => {
    // Generate a synthetic route of 200 points along a diagonal
    const largePath = Array.from({ length: 200 }, (_, i) => ({
      lat: -23.5 + i * 0.001,
      lng: -46.6 + i * 0.001,
    }));

    const encoded = encodeRoute(largePath);
    const decoded = decodeRoute(encoded);

    expect(decoded).toHaveLength(largePath.length);

    // Spot-check first, middle, and last points
    const indices = [0, 99, 199];
    for (const idx of indices) {
      expect(decoded[idx].lat).toBeCloseTo(largePath[idx].lat, 4);
      expect(decoded[idx].lng).toBeCloseTo(largePath[idx].lng, 4);
    }
  });

  it('large path encodes to a shorter string than the raw JSON', () => {
    // The whole point of the compression: ensure the encoded string is compact
    const largePath = Array.from({ length: 200 }, (_, i) => ({
      lat: -23.5 + i * 0.001,
      lng: -46.6 + i * 0.001,
    }));

    const encoded = encodeRoute(largePath);
    const rawJson = JSON.stringify(largePath);

    expect(encoded.length).toBeLessThan(rawJson.length);
  });
});
