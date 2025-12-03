const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const Parse = require('parse/node');

// POST /api/leads/:id/send - Send message to lead
router.post('/:id/send', async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }
    
    const query = new Parse.Query(Lead);
    const lead = await query.get(id, { useMasterKey: true });
    
    // This would send the message via the appropriate channel
    // For now, return success
    res.json({ success: true, data: { messageId: 'placeholder' } });
  } catch (error) {
    if (error.code === Parse.Error.OBJECT_NOT_FOUND) {
      res.status(404).json({ success: false, error: 'Lead not found' });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

module.exports = router;




