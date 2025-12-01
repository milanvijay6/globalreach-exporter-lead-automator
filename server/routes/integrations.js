const express = require('express');
const router = express.Router();
const IntegrationService = require('../services/integrationService');
const { authenticate } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticate);

// POST /api/integrations/:service/authorize - Get OAuth URL
router.post('/:service/authorize', async (req, res) => {
  try {
    const { service } = req.params;
    if (!['outlook', 'whatsapp', 'wechat'].includes(service)) {
      return res.status(400).json({ success: false, error: 'Invalid service. Must be outlook, whatsapp, or wechat' });
    }
    
    const userId = req.user ? req.user.id : null;
    const authUrl = await IntegrationService.getOAuthUrl(service, userId);
    
    res.json({ success: true, authUrl });
  } catch (error) {
    console.error(`[API] Error in POST /api/integrations/${req.params.service}/authorize:`, error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET /api/integrations/:service/callback - Exchange OAuth code
router.get('/:service/callback', async (req, res) => {
  try {
    const { service } = req.params;
    const { code, state } = req.query;
    
    if (!['outlook', 'whatsapp', 'wechat'].includes(service)) {
      return res.status(400).json({ success: false, error: 'Invalid service' });
    }
    
    if (!code) {
      return res.status(400).json({ success: false, error: 'Missing authorization code' });
    }
    
    const userId = req.user ? req.user.id : null;
    const tokens = await IntegrationService.exchangeCode(service, code, state, userId);
    
    res.json({ success: true, tokens });
  } catch (error) {
    console.error(`[API] Error in GET /api/integrations/${req.params.service}/callback:`, error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/integrations/:service/refresh - Refresh token
router.post('/:service/refresh', async (req, res) => {
  try {
    const { service } = req.params;
    const { refreshToken } = req.body;
    
    if (!['outlook', 'whatsapp', 'wechat'].includes(service)) {
      return res.status(400).json({ success: false, error: 'Invalid service' });
    }
    
    if (!refreshToken && service === 'outlook') {
      return res.status(400).json({ success: false, error: 'Missing refresh token' });
    }
    
    const userId = req.user ? req.user.id : null;
    const tokens = await IntegrationService.refreshToken(service, refreshToken, userId);
    
    res.json({ success: true, tokens });
  } catch (error) {
    console.error(`[API] Error in POST /api/integrations/${req.params.service}/refresh:`, error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// POST /api/integrations/:service/disconnect - Disconnect service
router.post('/:service/disconnect', async (req, res) => {
  try {
    const { service } = req.params;
    
    if (!['outlook', 'whatsapp', 'wechat'].includes(service)) {
      return res.status(400).json({ success: false, error: 'Invalid service' });
    }
    
    const userId = req.user ? req.user.id : null;
    await IntegrationService.disconnect(service, userId);
    
    res.json({ success: true });
  } catch (error) {
    console.error(`[API] Error in POST /api/integrations/${req.params.service}/disconnect:`, error);
    res.status(400).json({ success: false, error: error.message });
  }
});

// GET /api/integrations/status - Get all services status
router.get('/status', async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const status = await IntegrationService.getStatus(userId);
    res.json({ success: true, status });
  } catch (error) {
    console.error('[API] Error in GET /api/integrations/status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

