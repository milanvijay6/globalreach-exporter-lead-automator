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
    const redirectUrl = `${req.protocol}://${req.get('host')}/?oauth_callback=true&code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}&provider=${provider}`;
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

