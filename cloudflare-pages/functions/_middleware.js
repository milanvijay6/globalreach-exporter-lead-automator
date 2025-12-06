/**
 * Cloudflare Pages Middleware
 * Proxies API requests to Back4App backend
 */

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Get Back4App URL from environment variable
  const back4appUrl = env.BACK4APP_URL || env.BACK4APP_APP_URL || 'https://globalreachexporterleadautomator-sozgszuo.b4a.run';

  // Proxy API requests to Back4App
  if (url.pathname.startsWith('/api/')) {
    const targetUrl = `${back4appUrl}${url.pathname}${url.search}`;
    
    // Clone headers and remove host header (will be set by fetch)
    const headers = new Headers(request.headers);
    headers.delete('host');
    
    // Forward the request to Back4App
    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
    });

    try {
      const response = await fetch(proxyRequest);
      
      // Create a new response with CORS headers
      const newResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...Object.fromEntries(response.headers),
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Parse-Session-Token, X-User-Id',
        },
      });

      return newResponse;
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Backend request failed', message: error.message }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  }

  // For non-API requests, continue with normal Pages handling
  return context.next();
}

