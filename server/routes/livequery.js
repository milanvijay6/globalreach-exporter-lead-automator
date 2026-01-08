/**
 * LiveQuery API Routes
 * Manages LiveQuery subscriptions from frontend
 */

const express = require('express');
const router = express.Router();
const { liveQueryService } = require('../services/liveQueryService');

// POST /api/livequery/subscribe - Subscribe to active chat
router.post('/subscribe', async (req, res) => {
  try {
    const { importerId } = req.body;
    
    if (!importerId) {
      return res.status(400).json({ success: false, error: 'importerId is required' });
    }

    // Subscribe to LiveQuery (only for active chats)
    const subscriptionId = await liveQueryService.subscribeToActiveChat(
      importerId,
      (event, message) => {
        // Emit message update via WebSocket or Server-Sent Events
        // For now, client will poll or use WebSocket
      },
      (error) => {
        console.error('[LiveQuery API] Subscription error:', error);
      }
    );

    res.json({
      success: true,
      subscriptionId,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/livequery/unsubscribe - Unsubscribe from chat
router.post('/unsubscribe', async (req, res) => {
  try {
    const { subscriptionId } = req.body;
    
    if (!subscriptionId) {
      return res.status(400).json({ success: false, error: 'subscriptionId is required' });
    }

    await liveQueryService.unsubscribe(subscriptionId);

    res.json({
      success: true,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/livequery/stats - Get subscription statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = liveQueryService.getStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

