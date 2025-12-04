const express = require('express');
const router = express.Router();

// Test endpoint to verify OAuth routes are working
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'OAuth routes are working' });
});

// OAuth Callback Route
// This route handles OAuth callbacks from providers (Outlook, Gmail, etc.)
// It redirects back to the frontend with the OAuth code
router.get('/callback', async (req, res) => {
  try {
    // Enhanced logging to debug missing code issue
    const queryKeys = Object.keys(req.query);
    const rawUrl = req.originalUrl || req.url;
    const fullUrl = `${req.protocol}://${req.get('host')}${rawUrl}`;
    
    console.log('[OAuth] Callback route hit:', {
      method: req.method,
      path: req.path,
      fullUrl: rawUrl,
      queryKeys: queryKeys,
      queryValues: queryKeys.reduce((acc, key) => {
        acc[key] = req.query[key] ? (typeof req.query[key] === 'string' ? req.query[key].substring(0, 50) : 'present') : 'missing';
        return acc;
      }, {}),
      hasCode: !!req.query.code,
      hasState: !!req.query.state,
      hasError: !!req.query.error,
      host: req.get('host'),
      protocol: req.protocol,
      headers: {
        'user-agent': req.get('user-agent')?.substring(0, 100),
        'referer': req.get('referer')?.substring(0, 100),
        'x-forwarded-proto': req.get('x-forwarded-proto'),
        'x-forwarded-host': req.get('x-forwarded-host')
      }
    });

    // Try to get code from query, but also check URL directly in case of parsing issues
    let code = req.query.code;
    let state = req.query.state;
    let error = req.query.error;
    
    // If code is missing from query, try to extract from URL directly
    if (!code && rawUrl) {
      const codeMatch = rawUrl.match(/[?&]code=([^&]+)/);
      if (codeMatch) {
        code = decodeURIComponent(codeMatch[1]);
        console.log('[OAuth] Extracted code from URL directly');
      }
    }
    
    // If state is missing from query, try to extract from URL directly
    if (!state && rawUrl) {
      const stateMatch = rawUrl.match(/[?&]state=([^&]+)/);
      if (stateMatch) {
        state = decodeURIComponent(stateMatch[1]);
        console.log('[OAuth] Extracted state from URL directly');
      }
    }
    
    // If error is missing from query, try to extract from URL directly
    if (!error && rawUrl) {
      const errorMatch = rawUrl.match(/[?&]error=([^&]+)/);
      if (errorMatch) {
        error = decodeURIComponent(errorMatch[1]);
        console.log('[OAuth] Extracted error from URL directly');
      }
    }
    
    if (error) {
      console.error('[OAuth] OAuth error received:', error);
      return res.send(`
        <html>
          <body>
            <h2>Authentication Failed</h2>
            <p>Error: ${error}</p>
            <p>You can close this window and try again.</p>
            <script>setTimeout(() => window.close(), 3000);</script>
          </body>
        </html>
      `);
    }

    if (!code) {
      console.warn('[OAuth] Missing authorization code in callback', {
        query: req.query,
        queryKeys: Object.keys(req.query),
        fullUrl: rawUrl,
        hasQuery: Object.keys(req.query).length > 0,
        urlHasCode: rawUrl.includes('code='),
        urlHasState: rawUrl.includes('state='),
        urlHasError: rawUrl.includes('error=')
      });
      
      // Check if this is a direct visit (no query params) vs an actual OAuth callback
      const hasQueryParams = Object.keys(req.query).length > 0;
      
      if (!hasQueryParams) {
        // Direct visit - provide helpful message
        return res.send(`
          <html>
            <head>
              <title>OAuth Callback Endpoint</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
                .info { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0; }
                .warning { background: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin: 20px 0; }
              </style>
            </head>
            <body>
              <h2>OAuth Callback Endpoint</h2>
              <div class="info">
                <p><strong>This is the OAuth callback endpoint.</strong></p>
                <p>This URL should only be accessed by Google/Microsoft OAuth services during the authentication flow.</p>
              </div>
              <div class="warning">
                <p><strong>If you're trying to connect your email:</strong></p>
                <ol>
                  <li>Go back to the application</li>
                  <li>Click "Connect" for Email/Gmail</li>
                  <li>Complete the OAuth flow in the browser window that opens</li>
                  <li>You'll be automatically redirected back here with the authorization code</li>
                </ol>
              </div>
              <p><small>If you're seeing this page after completing OAuth, there may be an issue with the OAuth flow. Check the browser console and server logs for errors.</small></p>
            </body>
          </html>
        `);
      }
      
      // OAuth callback without code - actual error
      // Log detailed information for debugging
      console.error('[OAuth] OAuth callback received without authorization code', {
        hasQueryParams: Object.keys(req.query).length > 0,
        queryParams: req.query,
        rawUrl: rawUrl,
        urlContainsCode: rawUrl.includes('code='),
        urlContainsError: rawUrl.includes('error='),
        referer: req.get('referer'),
        userAgent: req.get('user-agent')?.substring(0, 100)
      });
      
      return res.send(`
        <html>
          <head>
            <title>Authentication Error</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
              .error { background: #ffebee; border-left: 4px solid #f44336; padding: 15px; margin: 20px 0; }
              .debug { background: #f5f5f5; padding: 10px; margin: 10px 0; font-size: 12px; font-family: monospace; }
            </style>
          </head>
          <body>
            <h2>Authentication Error</h2>
            <div class="error">
              <p><strong>Missing authorization code.</strong></p>
              <p>The OAuth callback did not include the required authorization code. This can happen if:</p>
              <ul>
                <li>The OAuth flow was cancelled or denied</li>
                <li>There was an error during authentication</li>
                <li>The redirect URI doesn't match exactly in Google Cloud Console</li>
                <li>The authorization code expired (codes expire quickly)</li>
              </ul>
            </div>
            <div class="debug">
              <strong>Debug Info:</strong><br>
              URL: ${rawUrl.substring(0, 200)}<br>
              Has Query Params: ${Object.keys(req.query).length > 0 ? 'Yes' : 'No'}<br>
              Query Keys: ${Object.keys(req.query).join(', ') || 'None'}
            </div>
            <p><strong>Next Steps:</strong></p>
            <ol>
              <li>Verify the redirect URI in Google Cloud Console matches exactly: <code>${fullUrl.split('?')[0]}</code></li>
              <li>Try connecting again from the application</li>
              <li>Make sure you complete the OAuth flow in one session (don't close the browser window)</li>
            </ol>
            <p><small>You can close this window.</small></p>
            <script>setTimeout(() => window.close(), 10000);</script>
          </body>
        </html>
      `);
    }

    // State is optional - if missing, we'll create a default one
    if (!state) {
      console.warn('[OAuth] Missing state parameter, will use default');
    }

    // Parse state to determine provider
    let provider = 'gmail';
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
      provider = stateData.provider || 'gmail';
    } catch (parseError) {
      if (state && (state.includes('outlook') || state.includes('microsoft'))) {
        provider = 'outlook';
      }
    }

    // Store OAuth code in session or return to frontend
    // For web app, we'll redirect back to frontend with code
    // Use https in production, http in development
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
    let host = req.get('host') || req.get('x-forwarded-host');
    
    // If no host header, try to construct from request
    if (!host) {
      host = req.get('x-forwarded-host') || req.headers.host || 'localhost:4000';
    }
    
    // Ensure protocol is correct (https for production, http for localhost)
    const finalProtocol = host.includes('localhost') ? 'http' : protocol;
    
    // Build redirect URL with all parameters
    const redirectParams = new URLSearchParams({
      oauth_callback: 'true',
      code: code,
      provider: provider
    });
    
    // Add state if available
    if (state) {
      redirectParams.set('state', state);
    }
    
    const redirectUrl = `${finalProtocol}://${host}/?${redirectParams.toString()}`;
    
    // Log if request came from Cloudflare Worker proxy
    const forwardedFrom = req.get('x-forwarded-for') || req.get('cf-connecting-ip');
    if (forwardedFrom) {
      console.log('[OAuth] Callback received (possibly from Cloudflare Worker proxy):', {
        provider,
        hasCode: !!code,
        hasState: !!state,
        forwardedFrom: forwardedFrom.substring(0, 50),
        host,
        protocol: finalProtocol
      });
    }
    
    console.log('[OAuth] Redirecting to frontend:', redirectUrl.replace(/code=[^&]+/, 'code=***'));
    console.log('[OAuth] Full redirect URL (sanitized):', {
      protocol: finalProtocol,
      host,
      hasCode: !!code,
      hasState: !!state,
      provider
    });
    
    // Ensure redirect happens with proper status code
    try {
      res.redirect(302, redirectUrl);
    } catch (redirectError) {
      console.error('[OAuth] Redirect failed:', redirectError);
      // Fallback: send HTML with JavaScript redirect
    res.send(`
        <html>
          <body>
            <h2>Redirecting...</h2>
            <p>Please wait while we redirect you back to the application.</p>
            <script>
              window.location.href = ${JSON.stringify(redirectUrl)};
            </script>
          </body>
        </html>
      `);
    }
  } catch (err) {
    console.error('[OAuth] Callback error:', err);
    res.status(500).send(`
      <html>
        <body>
          <h2>Authentication Error</h2>
          <p>An error occurred processing the authentication: ${err.message}</p>
          <p>You can close this window and try again.</p>
          <script>setTimeout(() => window.close(), 3000);</script>
        </body>
      </html>
    `);
  }
});

module.exports = router;

