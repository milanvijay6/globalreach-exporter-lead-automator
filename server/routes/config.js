const express = require('express');
const router = express.Router();
const Config = require('../models/Config');
const { authenticate } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticate);

// GET /api/config/:key - Get config value
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const value = await Config.get(key);
    res.json({ success: true, value });
  } catch (error) {
    console.error('[API] Error in GET /api/config/:key:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/config/:key - Set config value
router.post('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({ success: false, error: 'Value is required' });
    }
    
    await Config.set(key, value);
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Error in POST /api/config/:key:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

