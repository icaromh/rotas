/**
 * Unit tests for the Cloudflare Worker proxy (proxy/src/index.ts).
 *
 * The `isAllowedOrigin` function is not exported from the worker module because
 * Cloudflare Workers only expose the `default` export. We therefore replicate the
 * exact same logic here so that the tests remain fast (no worker runtime needed)
 * and stay in sync with any future changes to the allow-list.
 *
 * If the logic in `proxy/src/index.ts` ever changes, update the mirror below too.
 */

// ---------------------------------------------------------------------------
// Mirror of the allow-list and helper — keep in sync with proxy/src/index.ts
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = [
  'https://rotas-dusky.vercel.app',
  'https://rotas.cc',
  'https://www.rotas.cc',
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;

  // Allow localhost (any port)
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
    return true;
  }

  return ALLOWED_ORIGINS.includes(origin);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('isAllowedOrigin', () => {
  describe('production domains', () => {
    it('allows https://rotas.cc', () => {
      expect(isAllowedOrigin('https://rotas.cc')).toBe(true);
    });

    it('allows https://www.rotas.cc', () => {
      expect(isAllowedOrigin('https://www.rotas.cc')).toBe(true);
    });

    it('allows the Vercel preview URL (https://rotas-dusky.vercel.app)', () => {
      expect(isAllowedOrigin('https://rotas-dusky.vercel.app')).toBe(true);
    });
  });

  describe('localhost origins', () => {
    it('allows http://localhost:5173 (Vite default port)', () => {
      expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
    });

    it('allows http://localhost:3000', () => {
      expect(isAllowedOrigin('http://localhost:3000')).toBe(true);
    });

    it('allows http://127.0.0.1:8080', () => {
      expect(isAllowedOrigin('http://127.0.0.1:8080')).toBe(true);
    });
  });

  describe('disallowed origins', () => {
    it('blocks https://evil.com', () => {
      expect(isAllowedOrigin('https://evil.com')).toBe(false);
    });

    it('blocks an origin that only contains a substring of an allowed origin', () => {
      expect(isAllowedOrigin('https://notrotas.cc')).toBe(false);
    });

    it('blocks http:// (non-https) variants of production domains', () => {
      expect(isAllowedOrigin('http://rotas.cc')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns false for null', () => {
      expect(isAllowedOrigin(null)).toBe(false);
    });

    it('returns false for an empty string', () => {
      expect(isAllowedOrigin('')).toBe(false);
    });
  });
});
