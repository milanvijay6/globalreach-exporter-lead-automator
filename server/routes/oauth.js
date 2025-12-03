const express = require('express');
const router = express.Router();

// OAuth Callback Route
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
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

    if (!code || !state) {
      return res.send(`
        <html>
          <body>
            <h2>Authentication Error</h2>
            <p>Missing authorization code or state parameter.</p>
            <p>You can close this window and try again.</p>
            <script>setTimeout(() => window.close(), 3000);</script>
          </body>
        </html>
      `);
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
    const host = req.get('host') || req.get('x-forwarded-host') || 'localhost:4000';
    const redirectUrl = `${protocol}://${host}/?oauth_callback=true&code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}&provider=${provider}`;
    
    // Log if request came from Cloudflare Worker proxy
    const forwardedFrom = req.get('x-forwarded-for') || req.get('cf-connecting-ip');
    if (forwardedFrom) {
      console.log('[OAuth] Callback received (possibly from Cloudflare Worker proxy):', {
        provider,
        hasCode: !!code,
        forwardedFrom: forwardedFrom.substring(0, 50)
      });
    }
    
    console.log('[OAuth] Redirecting to frontend:', redirectUrl.replace(/code=[^&]+/, 'code=***'));
    res.redirect(redirectUrl);
  } catch (err) {
    res.send(`
      <html>
        <body>
          <h2>Authentication Error</h2>
          <p>An error occurred processing the authentication.</p>
          <p>You can close this window and try again.</p>
          <script>setTimeout(() => window.close(), 3000);</script>
        </body>
      </html>
    `);
  }
});

module.exports = router;


