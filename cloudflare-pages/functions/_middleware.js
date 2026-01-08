/**
 * Cloudflare Pages Middleware
 * Proxies API requests to Back4App backend
 * L2 Cache: CDN caching with Cloudflare Cache API
 */

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // Static assets - long cache (1 year)
  const staticAssetExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot'];
  const isStaticAsset = staticAssetExtensions.some(ext => url.pathname.endsWith(ext));
  
  if (isStaticAsset) {
    const response = await next();
    // Set long cache for static assets
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return response;
  }

  // Get Back4App URL from environment variable
  const back4appUrl = env.BACK4APP_URL || env.BACK4APP_APP_URL || 'https://globalreachexporterleadautomator-sozgszuo.b4a.run';

  // Proxy API requests to Back4App
  if (url.pathname.startsWith('/api/')) {
    const targetUrl = `${back4appUrl}${url.pathname}${url.search}`;
    const method = request.method;
    
    // Clone headers and remove host header (will be set by fetch)
    const headers = new Headers(request.headers);
    headers.delete('host');
    
    // Determine cache strategy based on endpoint
    const isPublicEndpoint = url.pathname.match(/^\/api\/(products|config|health)/);
    const isUserSpecific = headers.get('X-User-Id') || headers.get('X-Parse-Session-Token');
    
    // Forward the request to Back4App
    const proxyRequest = new Request(targetUrl, {
      method: method,
      headers: headers,
      body: method !== 'GET' && method !== 'HEAD' ? request.body : null,
    });

    try {
      // Use Cloudflare Cache API for GET requests
      let response;
      if (method === 'GET') {
        // Create cache key
        const cacheKey = `${url.pathname}${url.search}`;
        
        // Try to get from cache first (only for public endpoints)
        if (isPublicEndpoint && !isUserSpecific) {
          const cache = caches.default;
          const cachedResponse = await cache.match(proxyRequest);
          
          if (cachedResponse) {
            // Return cached response with cache headers
            const cachedHeaders = new Headers(cachedResponse.headers);
            cachedHeaders.set('X-Cache', 'HIT');
            cachedHeaders.set('Access-Control-Allow-Origin', '*');
            cachedHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            cachedHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Parse-Session-Token, X-User-Id');
            
            return new Response(cachedResponse.body, {
              status: cachedResponse.status,
              statusText: cachedResponse.statusText,
              headers: cachedHeaders,
            });
          }
        }
        
        // Fetch from backend
        response = await fetch(proxyRequest);
      } else {
        // For mutations, bypass cache
        response = await fetch(proxyRequest);
      }
      
      // Create response headers
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Parse-Session-Token, X-User-Id');
      
      // Set cache headers based on endpoint type
      if (method === 'GET') {
        if (isPublicEndpoint && !isUserSpecific) {
          // Public API endpoints - 5 min CDN cache
          responseHeaders.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
          responseHeaders.set('X-Cache', 'MISS');
          
          // Store in Cloudflare cache for public endpoints
          if (response.ok) {
            const cache = caches.default;
            const cacheResponse = new Response(response.body, {
              status: response.status,
              statusText: response.statusText,
              headers: responseHeaders,
            });
            // Cache for 5 minutes
            context.waitUntil(cache.put(proxyRequest, cacheResponse.clone()));
          }
        } else if (isUserSpecific) {
          // User-specific content - no CDN cache, but allow browser cache
          responseHeaders.set('Cache-Control', 'private, max-age=60');
          responseHeaders.set('Vary', 'X-User-Id, X-Parse-Session-Token');
        } else {
          // Other endpoints - short cache
          responseHeaders.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
        }
      } else {
        // Mutations - no cache
        responseHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Backend request failed', message: error.message }), {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache',
        },
      });
    }
  }

  // For non-API requests, continue with normal Pages handling
  const response = await next();
  
  // Set cache headers for HTML pages
  if (url.pathname === '/' || url.pathname.endsWith('.html')) {
    response.headers.set('Cache-Control', 'public, max-age=300, s-maxage=600');
  }
  
  return response;
}

