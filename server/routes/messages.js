/**
 * Messages API Routes
 * Handles message creation and retrieval with Parse File support for large email bodies
 */

const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Parse = require('parse/node');
const { parseFileService } = require('../utils/parseFileService');
const { cacheMiddleware, invalidateByTag } = require('../middleware/cache');
const { findWithCache } = require('../utils/parseQueryCache');

// GET /api/messages - List messages for an importer
// Uses compound index: importerId_channel_timestamp
router.get('/', cacheMiddleware(60, ['messages']), async (req, res) => {
  try {
    const { importerId, channel, status, limit = 50, cursor, getArchived = false } = req.query;
    
    if (!importerId) {
      return res.status(400).json({ success: false, error: 'importerId is required' });
    }

    const query = new Parse.Query(Message);
    query.equalTo('importerId', importerId);
    
    // Exclude archived messages by default
    if (!getArchived) {
      query.notEqualTo('archived', true);
    }
    
    if (channel) {
      query.equalTo('channel', channel);
    }
    
    if (status) {
      query.equalTo('status', status);
    }
    
    // Use compound index: importerId_channel_timestamp
    query.descending('timestamp');
    query.limit(parseInt(limit) + 1);
    
    // Use Parse query cache (L4)
    const messages = await findWithCache(query, {
      useMasterKey: true,
      cachePolicy: 'cacheElseNetwork',
      maxCacheAge: 60, // 1 minute for messages
    });
    
    // Check if there's a next page
    const hasMore = messages.length > parseInt(limit);
    const results = hasMore ? messages.slice(0, parseInt(limit)) : messages;
    
    // Get next cursor (if needed)
    const nextCursor = hasMore ? results[results.length - 1].id : null;
    
    // Apply field projection if requested
    const { projectFields } = require('../utils/fieldProjection');
    const fields = req.query.fields;
    
    // Format results and fetch file content if needed
    const formattedResults = await Promise.all(results.map(async (msg) => {
      const baseResult = {
        id: msg.id,
        importerId: msg.get('importerId'),
        channel: msg.get('channel'),
        sender: msg.get('sender'),
        timestamp: msg.get('timestamp'),
        status: msg.get('status'),
        createdAt: msg.get('createdAt'),
        updatedAt: msg.get('updatedAt'),
      };
      
      // Get content (from inline field or Parse File) - only if content field is requested
      if (!fields || fields.includes('content')) {
        const content = await parseFileService.getContent(msg, { useMasterKey: true });
        baseResult.content = content;
      }
      
      return projectFields(baseResult, fields);
    }));
    
    res.json({
      success: true,
      data: formattedResults,
      pagination: {
        limit: parseInt(limit),
        hasMore,
        nextCursor,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/messages - Create a new message
// Automatically uses Parse Files for large email bodies (>1KB)
router.post('/', async (req, res) => {
  try {
    const { importerId, channel, sender, content, timestamp, status } = req.body;
    
    if (!importerId || !channel || !content) {
      return res.status(400).json({ success: false, error: 'importerId, channel, and content are required' });
    }

    // Use parseFileService to automatically handle large content
    const message = await parseFileService.createMessage({
      importerId,
      channel,
      sender: sender || 'agent',
      content,
      timestamp: timestamp || Date.now(),
      status: status || 'sent',
    }, { useMasterKey: true });
    
    // Invalidate cache
    await invalidateByTag(['messages']);
    
    res.json({
      success: true,
      data: {
        id: message.id,
        importerId: message.get('importerId'),
        channel: message.get('channel'),
        hasFile: !!message.get('emailBodyFile'),
        contentLength: content.length,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/messages/:id - Get a single message
router.get('/:id', cacheMiddleware(300), async (req, res) => {
  try {
    const { id } = req.params;
    const query = new Parse.Query(Message);
    const message = await query.get(id, { useMasterKey: true });
    
    // Get content (from inline field or Parse File)
    const content = await parseFileService.getContent(message, { useMasterKey: true });
    
    res.json({
      success: true,
      data: {
        id: message.id,
        importerId: message.get('importerId'),
        channel: message.get('channel'),
        sender: message.get('sender'),
        content,
        timestamp: message.get('timestamp'),
        status: message.get('status'),
        hasFile: !!message.get('emailBodyFile'),
        createdAt: message.get('createdAt'),
        updatedAt: message.get('updatedAt'),
      },
    });
  } catch (error) {
    if (error.code === Parse.Error.OBJECT_NOT_FOUND) {
      res.status(404).json({ success: false, error: 'Message not found' });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

module.exports = router;

