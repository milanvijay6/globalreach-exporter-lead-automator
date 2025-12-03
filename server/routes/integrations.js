const express = require('express');
const router = express.Router();
const Integration = require('../models/Integration');
const Parse = require('parse/node');

// GET /api/integrations/status - Get all services status
router.get('/status', async (req, res) => {
  try {
    const query = new Parse.Query(Integration);
    const integrations = await query.find({ useMasterKey: true });
    
    const status = {
      outlook: { connected: false },
      whatsapp: { connected: false },
      wechat: { connected: false }
    };
    
    integrations.forEach(integration => {
      const service = integration.get('service');
      if (status[service]) {
        status[service] = {
          connected: true,
          tokenExpiry: integration.get('tokenExpiry'),
          errorMessage: integration.get('errorMessage')
        };
      }
    });
    
    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/integrations/:service/authorize - Get OAuth URL
router.post('/:service/authorize', async (req, res) => {
  try {
    const { service } = req.params;
    if (!['outlook', 'whatsapp', 'wechat'].includes(service)) {
      return res.status(400).json({ success: false, error: 'Invalid service' });
    }
    
    // This would call the integration service to generate OAuth URL
    // For now, return a placeholder
    res.json({ success: true, authUrl: `https://oauth.example.com/${service}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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
    
    // This would exchange the code for tokens
    // For now, return a placeholder
    res.json({ success: true, tokens: { accessToken: 'placeholder' } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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
    
    // This would refresh the token
    // For now, return a placeholder
    res.json({ success: true, tokens: { accessToken: 'placeholder' } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/integrations/:service/disconnect - Disconnect service
router.post('/:service/disconnect', async (req, res) => {
  try {
    const { service } = req.params;
    
    if (!['outlook', 'whatsapp', 'wechat'].includes(service)) {
      return res.status(400).json({ success: false, error: 'Invalid service' });
    }
    
    const query = new Parse.Query(Integration);
    query.equalTo('service', service);
    const integration = await query.first({ useMasterKey: true });
    
    if (integration) {
      await integration.destroy({ useMasterKey: true });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;






