import {
  getCacheTtlSeconds,
  isAllowedOrigin,
  NEIGHBORHOOD_CACHE_TTL_SECONDS,
  normalizeOverpassQuery,
  ROAD_NETWORK_CACHE_TTL_SECONDS,
  shouldFallback,
} from '../worker/overpass';

describe('worker/overpass helpers', () => {
  describe('isAllowedOrigin', () => {
    it('allows production domains', () => {
      expect(isAllowedOrigin('https://rotas.cc')).toBe(true);
      expect(isAllowedOrigin('https://www.rotas.cc')).toBe(true);
      expect(isAllowedOrigin('https://rotas.icaromh.com')).toBe(true);
    });

    it('allows same-origin requests dynamically', () => {
      expect(isAllowedOrigin('https://preview.rotas.workers.dev', 'https://preview.rotas.workers.dev/api/overpass')).toBe(true);
    });

    it('allows localhost origins', () => {
      expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
      expect(isAllowedOrigin('http://localhost:3000')).toBe(true);
      expect(isAllowedOrigin('http://127.0.0.1:8080')).toBe(true);
    });

    it('blocks disallowed origins', () => {
      expect(isAllowedOrigin('https://evil.com')).toBe(false);
      expect(isAllowedOrigin('https://notrotas.cc')).toBe(false);
      expect(isAllowedOrigin('http://rotas.cc')).toBe(false);
    });

    it('allows requests without an Origin header (same-origin / non-browser)', () => {
      expect(isAllowedOrigin(null)).toBe(true);
    });
  });

  describe('shouldFallback', () => {
    it('triggers fallback on 406, 408, 429, and 5xx', () => {
      expect(shouldFallback(406)).toBe(true);
      expect(shouldFallback(408)).toBe(true);
      expect(shouldFallback(429)).toBe(true);
      expect(shouldFallback(500)).toBe(true);
      expect(shouldFallback(504)).toBe(true);
    });

    it('does not fallback on 200 or 400', () => {
      expect(shouldFallback(200)).toBe(false);
      expect(shouldFallback(400)).toBe(false);
      expect(shouldFallback(403)).toBe(false);
    });
  });

  describe('normalizeOverpassQuery & getCacheTtlSeconds', () => {
    it('collapses whitespace for deterministic cache keys', () => {
      expect(normalizeOverpassQuery('data=\n  [out:json];\n  way(1,2,3,4);\n')).toBe(
        'data= [out:json]; way(1,2,3,4);'
      );
    });

    it('uses 7-day TTL for neighborhood queries and 24-hour TTL for road networks', () => {
      expect(getCacheTtlSeconds('data=relation["admin_level"~"9|10"](1,2,3,4);')).toBe(
        NEIGHBORHOOD_CACHE_TTL_SECONDS
      );
      expect(getCacheTtlSeconds('data=way["highway"](1,2,3,4);')).toBe(
        ROAD_NETWORK_CACHE_TTL_SECONDS
      );
    });
  });
});
