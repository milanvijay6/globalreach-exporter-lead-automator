/**
 * Cloudflare Worker OAuth Callback Proxy
 * 
 * Proxies OAuth callbacks from Azure to Back4App
 * Provides permanent HTTPS URL for Azure App Registration
 * 
 * Flow: Azure OAuth → Worker → Back4App
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ONLY handle OAuth callbacks - reject everything else
    // Support: outlook, gmail, whatsapp, wechat
    const oauthCallbackPattern = /^\/auth\/(outlook|gmail|whatsapp|wechat)\/callback$/;
    if (!oauthCallbackPattern.test(path)) {
      return new Response('Not Found', { 
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // Extract service name from path (outlook, gmail, whatsapp, or wechat)
    const serviceMatch = path.match(/^\/auth\/(outlook|gmail|whatsapp|wechat)\/callback$/);
    if (!serviceMatch) {
      return new Response('Invalid OAuth callback path', { 
        status: 400,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    const service = serviceMatch[1];

          // Get Back4App base URL from environment variable
          // This is set dynamically during deployment via wrangler.toml [vars]
          // Format: https://yourapp.back4app.io or https://yourapp.b4a.run
          const back4appBase = env.BACK4APP_BASE_URL;
          
          if (!back4appBase) {
            console.error('[OAuth Proxy] BACK4APP_BASE_URL not configured');
            return new Response('OAuth proxy not configured. BACK4APP_BASE_URL missing.', {
              status: 500,
              headers: { 'Content-Type': 'text/plain' }
            });
          }
    
    // Build target URL - forward to Back4App /api/oauth/callback
    // Preserve ALL query parameters (code, state, error, etc.)
    const targetPath = '/api/oauth/callback';
    const targetUrl = `${back4appBase}${targetPath}?${url.searchParams.toString()}`;

    // SECURITY: Log but don't allow open redirects
    // Only allow redirects to configured Back4App domain
    const targetUrlObj = new URL(targetUrl);
    const allowedDomain = new URL(back4appBase).hostname;
    
    if (targetUrlObj.hostname !== allowedDomain) {
      console.error(`[OAuth Proxy] Security: Blocked redirect to unauthorized domain: ${targetUrlObj.hostname}`);
      return new Response('Unauthorized redirect target', { 
        status: 403,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // Log the forwarding for debugging
    console.log(`[OAuth Proxy] Forwarding ${service} callback: ${path} → ${targetUrl.replace(/code=[^&]+/, 'code=***')}`);

    // 302 Redirect with ALL OAuth params preserved
    return Response.redirect(targetUrl, 302);
  }
};

