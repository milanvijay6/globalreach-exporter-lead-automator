const express = require('express');
const router = express.Router();
const Config = require('../models/Config');

// Get config value
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const defaultValue = req.query.default !== undefined ? JSON.parse(req.query.default) : null;
    const value = await Config.get(key, defaultValue);
    res.json({ success: true, value });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Set config value
router.post('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    await Config.set(key, value);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all config
router.get('/', async (req, res) => {
  try {
    const config = await Config.getAll();
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;




