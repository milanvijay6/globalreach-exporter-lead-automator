const express = require('express');
const router = express.Router();
const freeTierConfig = require('../config/freeTier');
const { getDatabase } = require('../config/database');

// GET /api/f1/version - App version and free tier status
router.get('/version', (req, res) => {
  const enabledFeatures = [];
  if (freeTierConfig.features.websocket) enabledFeatures.push('websocket');
  if (freeTierConfig.features.scheduledJobs) enabledFeatures.push('scheduled-jobs');
  if (freeTierConfig.features.aiWorkers) enabledFeatures.push('ai-workers');
  enabledFeatures.push('leads', 'analytics', 'email', 'whatsapp');

  res.json({
    version: process.env.npm_package_version || '1.0.2',
    freeTier: freeTierConfig.isFreeTier,
    features: enabledFeatures,
  });
});

// GET /api/f1/leads/summary - Quick lead counts
router.get('/leads/summary', async (req, res) => {
  try {
    const db = getDatabase();
    if (!db) {
      return res.status(503).json({ error: 'Database not ready' });
    }

    const collection = db.collection('Lead');
    const [total, qualified] = await Promise.all([
      collection.countDocuments({ archived: { $ne: true } }),
      collection.countDocuments({ status: 'qualified', archived: { $ne: true } }),
    ]);

    res.json({ total, qualified, freeTier: freeTierConfig.isFreeTier });
  } catch (error) {
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
