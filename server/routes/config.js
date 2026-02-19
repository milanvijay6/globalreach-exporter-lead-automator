const express = require('express');
const router = express.Router();
const Config = require('../models/Config');
const { authenticateUser, requireAuth } = require('../middleware/auth');
const { cacheMiddleware } = require('../middleware/cache');

// Apply authentication middleware to all routes
router.use(authenticateUser);

// Get config value
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const defaultValue = req.query.default !== undefined ? JSON.parse(req.query.default) : null;
    const userId = req.user ? req.userId : null;
    
    // Get config (user-specific if userId available, otherwise global)
    const value = await Config.get(key, defaultValue, userId, false);
    res.json({ success: true, value, userId: userId || null });
  } catch (error) {
    console.error('[Config API] Error getting config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Set config value
router.post('/:key', requireAuth, async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    const userId = req.userId || null;
    
    // Set config (user-specific if userId available, otherwise global)
    await Config.set(key, value, userId, false);
    res.json({ success: true, userId: userId || null });
  } catch (error) {
    console.error('[Config API] Error setting config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all config (cached for 1 hour)
// app.use(cacheMiddleware); // Disabled temporarily
router.get('/all', async (req, res) => {
  try {
    const userId = req.user ? req.userId : null;
    
    // Get all configs (user-specific if userId available, otherwise global)
    const config = await Config.getAll(userId, false);
    res.json({ success: true, config, userId: userId || null });
  } catch (error) {
    console.error('[Config API] Error getting all config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
