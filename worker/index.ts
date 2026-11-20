import { handleOverpassRequest } from './overpass';

export interface Env {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      return Response.json({ status: 'ok', runtime: 'cloudflare-workers' });
    }

    if (url.pathname === '/api/overpass' || url.pathname === '/proxy') {
      return handleOverpassRequest(request, ctx);
    }

    if (url.pathname.startsWith('/api/')) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
