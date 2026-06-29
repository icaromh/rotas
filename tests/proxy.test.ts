/**
 * Unit tests for the Cloudflare Worker proxy's isAllowedOrigin logic.
 *
 * We extract and re-implement the function here to test it in isolation,
 * since Cloudflare Workers run in a non-Node environment.
 */
import { describe, it, expect } from 'vitest';

// ─── Inline the logic from proxy/src/index.ts ────────────────────────────────

const ALLOWED_ORIGINS = [
  'https://rotas-dusky.vercel.app',
  'https://rotas.cc',
  'https://www.rotas.cc',
];

const VERCEL_PREVIEW_RE = /^https:\/\/rotas[a-z0-9-]*\.vercel\.app$/;

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;

  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
    return true;
  }

  if (VERCEL_PREVIEW_RE.test(origin)) {
    return true;
  }

  return ALLOWED_ORIGINS.includes(origin);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('isAllowedOrigin', () => {
  describe('production domains', () => {
    it('allows https://rotas.cc', () => {
      expect(isAllowedOrigin('https://rotas.cc')).toBe(true);
    });

    it('allows https://www.rotas.cc', () => {
      expect(isAllowedOrigin('https://www.rotas.cc')).toBe(true);
    });

    it('allows the legacy Vercel deployment', () => {
      expect(isAllowedOrigin('https://rotas-dusky.vercel.app')).toBe(true);
    });
  });

  describe('Vercel preview deployments (branch/PR previews)', () => {
    it('allows the walk-boundary-sticking preview URL', () => {
      expect(isAllowedOrigin(
        'https://rotas-git-feat-issue-11-walk-boun-44e607-icaro-heimigs-projects.vercel.app'
      )).toBe(true);
    });

    it('allows generic branch preview URLs', () => {
      expect(isAllowedOrigin('https://rotas-git-main-icaromh.vercel.app')).toBe(true);
    });

    it('allows short preview slugs', () => {
      expect(isAllowedOrigin('https://rotas-abc123.vercel.app')).toBe(true);
    });

    it('blocks URLs that do not start with "rotas"', () => {
      expect(isAllowedOrigin('https://evil-rotas.vercel.app')).toBe(false);
    });

    it('blocks other vercel apps that happen to contain "rotas"', () => {
      // Must start with "rotas" immediately after https://
      expect(isAllowedOrigin('https://my-rotas-app.vercel.app')).toBe(false);
    });

    it('blocks Vercel previews with uppercase letters (not in regex)', () => {
      expect(isAllowedOrigin('https://Rotas-git-main.vercel.app')).toBe(false);
    });
  });

  describe('localhost origins', () => {
    it('allows http://localhost:5173', () => {
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

    it('blocks http:// production variants (non-TLS)', () => {
      expect(isAllowedOrigin('http://rotas.cc')).toBe(false);
    });

    it('blocks substring-only matches', () => {
      expect(isAllowedOrigin('https://notrotas.cc')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns false for null', () => {
      expect(isAllowedOrigin(null)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isAllowedOrigin('')).toBe(false);
    });
  });
});
