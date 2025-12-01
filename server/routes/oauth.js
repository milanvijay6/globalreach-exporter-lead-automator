const express = require('express');
const router = express.Router();
const IntegrationService = require('../services/integrationService');

// OAuth Callback Route - Handle /api/oauth/callback
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      console.error('OAuth callback error:', error);
      return res.send(`
        <html>
          <body>
            <h2>Authentication Failed</h2>
            <p>Error: ${error}</p>
            <p>You can close this window and try again.</p>
            <script>
              // Try to notify parent window
              if (window.opener) {
                window.opener.postMessage({ type: 'oauth-callback', success: false, error: '${error}' }, '*');
              }
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>
      `);
    }
    
    if (!code || !state) {
      console.warn('OAuth callback missing code or state');
      return res.send(`
        <html>
          <body>
            <h2>Authentication Error</h2>
            <p>Missing authorization code or state parameter.</p>
            <p>You can close this window and try again.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'oauth-callback', success: false, error: 'Missing code or state' }, '*');
              }
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>
      `);
    }
    
    console.log('OAuth callback received', { hasCode: !!code, hasState: !!state });
    
    // Parse state to determine provider
    let provider = 'gmail';
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
      provider = stateData.provider || 'gmail';
      console.log('Parsed provider from state JSON', { provider });
    } catch (parseError) {
      if (state && (state.includes('outlook') || state.includes('microsoft'))) {
        provider = 'outlook';
        console.log('Detected Outlook provider from state string');
      }
    }
    
    // Exchange code for tokens
    try {
      const tokens = await IntegrationService.exchangeCode(provider, code, state);
      
      return res.send(`
        <html>
          <head>
            <title>Authentication Successful</title>
          </head>
          <body style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
            <h2>✅ Authentication Successful</h2>
            <p>You can close this window and return to the application.</p>
            <script>
              // Notify parent window
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'oauth-callback', 
                  success: true, 
                  code: '${code}', 
                  state: '${state}',
                  provider: '${provider}'
                }, '*');
              }
              setTimeout(() => {
                try { window.close(); } catch(e) {}
              }, 2000);
            </script>
          </body>
        </html>
      `);
    } catch (exchangeError) {
      console.error('OAuth exchange error:', exchangeError);
      return res.send(`
        <html>
          <body>
            <h2>Authentication Error</h2>
            <p>Failed to exchange authorization code: ${exchangeError.message}</p>
            <p>You can close this window and try again.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'oauth-callback', 
                  success: false, 
                  error: '${exchangeError.message}' 
                }, '*');
              }
              setTimeout(() => window.close(), 3000);
            </script>
          </body>
        </html>
      `);
    }
  } catch (err) {
    console.error('OAuth callback handler error:', err);
    res.send(`
      <html>
        <body>
          <h2>Authentication Error</h2>
          <p>An error occurred processing the authentication.</p>
          <p>You can close this window and try again.</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'oauth-callback', 
                success: false, 
                error: '${err.message}' 
              }, '*');
            }
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
      </html>
    `);
  }
});

module.exports = router;

