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
    console.log('[OAuth] Callback route hit:', {
      method: req.method,
      path: req.path,
      fullUrl: req.originalUrl,
      query: Object.keys(req.query),
      hasCode: !!req.query.code,
      hasState: !!req.query.state,
      hasError: !!req.query.error,
      host: req.get('host'),
      protocol: req.protocol
    });

    const { code, state, error } = req.query;
    
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
      console.warn('[OAuth] Missing authorization code in callback');
      return res.send(`
        <html>
          <body>
            <h2>Authentication Error</h2>
            <p>Missing authorization code. Please try connecting again.</p>
            <p>You can close this window and try again.</p>
            <script>setTimeout(() => window.close(), 3000);</script>
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


