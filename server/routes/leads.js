const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const Parse = require('parse/node');
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');
const { applyCursor, getNextCursor, formatPaginatedResponse } = require('../utils/pagination');
const { authenticateUser, requireAuth } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authenticateUser);
router.use(requireAuth);

// GET /api/leads - List leads (cursor-based pagination)
// Uses compound indexes: status_country_createdAt, status_leadScore
// Excludes archived data by default
router.get('/', cacheMiddleware(60), async (req, res) => {
  try {
    const { status, country, limit = 50, cursor, sortBy = 'createdAt', sortOrder = 'desc', getArchived = false } = req.query;
    
    const query = new Parse.Query(Lead);
    
    // Exclude archived leads by default (if archived field exists)
    // Note: Archive implementation may add an 'archived' boolean field
    if (!getArchived) {
      query.notEqualTo('archived', true);
    }
    
    if (status) {
      query.equalTo('status', status);
    }
    
    if (country) {
      query.equalTo('country', country);
    }
    
    // Apply cursor-based pagination
    // Use compound index: status_country_createdAt or status_leadScore based on sortBy
    applyCursor(query, cursor, sortBy, sortOrder);
    query.limit(parseInt(limit) + 1); // Fetch one extra to check if there's more
    
    const leads = await query.find({ useMasterKey: true });
    
    // Check if there's a next page
    const hasMore = leads.length > parseInt(limit);
    const results = hasMore ? leads.slice(0, parseInt(limit)) : leads;
    
    // Get next cursor
    const nextCursor = hasMore ? getNextCursor(results, sortBy, sortOrder) : null;
    
    // Apply field projection if requested
    const { projectFields } = require('../utils/fieldProjection');
    const fields = req.query.fields;
    
    const formattedResults = results.map(l => {
      const base = {
        id: l.id,
        name: l.get('name'),
        companyName: l.get('companyName'),
        country: l.get('country'),
        contactDetail: l.get('contactDetail'),
        status: l.get('status'),
        leadScore: l.get('leadScore'),
        lastContacted: l.get('lastContacted'),
        createdAt: l.get('createdAt'),
        updatedAt: l.get('updatedAt')
      };
      
      return projectFields(base, fields);
    });
    
    res.json(formatPaginatedResponse(formattedResults, nextCursor, limit));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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
    
    // Invalidate lead cache
    await invalidateCache(`cache:/api/leads:*`);
    
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
