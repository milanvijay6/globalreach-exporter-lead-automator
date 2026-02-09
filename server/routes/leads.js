const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const { authenticateUser, requireAuth } = require('../middleware/auth');
const { cacheMiddleware, invalidateCache } = require('../middleware/cache');
const { formatPaginatedResponse } = require('../utils/pagination');

// Apply authentication middleware to all routes
router.use(authenticateUser);
router.use(requireAuth);

// GET /api/leads - List leads (cursor-based pagination)
// Uses compound indexes: status_country_createdAt, status_leadScore
// Excludes archived data by default
router.get('/', cacheMiddleware(60), async (req, res) => {
  try {
    const { status, country, limit = 50, cursor, sortBy = 'createdAt', sortOrder = 'desc', getArchived = false } = req.query;
    
    const query = {};
    
    // Exclude archived leads by default
    if (!getArchived) {
      query.archived = { $ne: true };
    }
    
    if (status) {
      query.status = status;
    }
    
    if (country) {
      query.country = country;
    }
    
    // Apply cursor-based pagination
    if (cursor) {
      try {
        const cursorData = JSON.parse(Buffer.from(cursor, 'base64').toString());
        if (sortOrder === 'desc') {
          query[sortBy] = { $lt: new Date(cursorData[sortBy]) };
        } else {
          query[sortBy] = { $gt: new Date(cursorData[sortBy]) };
        }
      } catch (e) {
        // Invalid cursor, ignore
      }
    }
    
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const leads = await Lead.find(query, { 
      sort, 
      limit: parseInt(limit) + 1 
    });
    
    // Check if there's a next page
    const hasMore = leads.length > parseInt(limit);
    const results = hasMore ? leads.slice(0, parseInt(limit)) : leads;
    
    // Get next cursor
    let nextCursor = null;
    if (hasMore && results.length > 0) {
      const lastItem = results[results.length - 1];
      const cursorData = { [sortBy]: lastItem.get(sortBy) };
      nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
    }
    
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
router.post('/:id/send', authenticateUser, requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }
    
    const lead = await Lead.get(id);
    
    // Invalidate lead cache
    await invalidateCache(`cache:/api/leads:*`);
    
    // This would send the message via the appropriate channel
    // For now, return success
    res.json({ success: true, data: { messageId: 'placeholder' } });
  } catch (error) {
    if (error.code === 101) { // MongoDB Object not found
      res.status(404).json({ success: false, error: 'Lead not found' });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

module.exports = router;
