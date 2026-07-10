export interface Env {
  // Configured in wrangler.toml or via wrangler secret put
  SUPABASE_URL: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Ensure the SUPABASE_URL ends without a trailing slash for clean concatenation
    const baseUrl = env.SUPABASE_URL.endsWith('/') 
      ? env.SUPABASE_URL.slice(0, -1) 
      : env.SUPABASE_URL;

    // The proxy expects to be mounted on rotas.cc/api/*
    // Extract the path after /api
    const apiPathIndex = url.pathname.indexOf('/api');
    
    if (apiPathIndex === -1) {
      return new Response('API Proxy: Missing /api prefix in the path', { status: 400 });
    }

    // e.g., if path is "/api/auth/strava", targetPath becomes "/auth/strava"
    const targetPath = url.pathname.slice(apiPathIndex + 4);
    
    // Reconstruct the full target URL:
    // e.g., https://<REF>.supabase.co/functions/v1/auth/strava
    const targetUrl = `${baseUrl}${targetPath}${url.search}`;

    // Forward the request to Supabase
    // We explicitly recreate the request to avoid issues with host headers
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'manual',
    });

    try {
      const response = await fetch(proxyRequest);
      return response;
    } catch (error: any) {
      return new Response(`API Proxy Error: ${error.message}`, { status: 502 });
    }
  },
};
