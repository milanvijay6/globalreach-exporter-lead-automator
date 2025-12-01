const express = require('express');
const router = express.Router();
const LeadService = require('../services/leadService');
const { authenticate } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticate);

// POST /api/leads/:id/send - Send message to lead
router.post('/:id/send', async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }
    
    const result = await LeadService.sendMessage(id, message);
    
    if (result.success) {
      res.json({ success: true, data: result });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('[API] Error in POST /api/leads/:id/send:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

