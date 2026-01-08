const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const Message = require('../models/Message');
const Product = require('../models/Product');
const Parse = require('parse/node');
const { cacheMiddleware } = require('../middleware/cache');
const { applyCursor, getNextCursor, formatPaginatedResponse } = require('../utils/pagination');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

/**
 * GET /api/sync/leads?since=timestamp&limit=100
 * Get leads updated since timestamp (incremental sync)
 */
router.get('/leads', cacheMiddleware(60), async (req, res) => {
  try {
    const { since, limit = 100, cursor } = req.query;
    const sinceTimestamp = since ? parseInt(since, 10) : 0;
    
    const query = new Parse.Query(Lead);
    
    // Only get leads updated since timestamp
    if (sinceTimestamp > 0) {
      const sinceDate = new Date(sinceTimestamp);
      query.greaterThan('updatedAt', sinceDate);
    }
    
    query.notEqualTo('archived', true);
    query.descending('updatedAt');
    
    // Apply cursor-based pagination
    if (cursor) {
      applyCursor(query, cursor, 'updatedAt', 'desc');
    }
    
    query.limit(parseInt(limit) + 1); // Fetch one extra to check if there's more
    
    const leads = await query.find({ useMasterKey: true });
    
    // Check if there's a next page
    const hasMore = leads.length > parseInt(limit);
    const results = hasMore ? leads.slice(0, parseInt(limit)) : leads;
    
    // Get next cursor
    const nextCursor = hasMore ? getNextCursor(results, 'updatedAt', 'desc') : null;
    
    const formattedResults = results.map(l => ({
      id: l.id,
      name: l.get('name'),
      companyName: l.get('companyName'),
      country: l.get('country'),
      contactDetail: l.get('contactDetail'),
      status: l.get('status'),
      leadScore: l.get('leadScore'),
      lastContacted: l.get('lastContacted'),
      productsImported: l.get('productsImported'),
      createdAt: l.get('createdAt'),
      updatedAt: l.get('updatedAt'),
    }));
    
    res.json({
      success: true,
      data: formattedResults,
      pagination: {
        limit: parseInt(limit),
        hasMore,
        nextCursor,
      },
      syncInfo: {
        since: sinceTimestamp,
        count: formattedResults.length,
      },
    });
  } catch (error) {
    logger.error('[Sync] Error syncing leads:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/sync/messages?since=timestamp&limit=100
 * Get messages updated since timestamp (incremental sync)
 */
router.get('/messages', cacheMiddleware(60), async (req, res) => {
  try {
    const { since, limit = 100, cursor, importerId } = req.query;
    const sinceTimestamp = since ? parseInt(since, 10) : 0;
    
    const query = new Parse.Query(Message);
    
    // Only get messages updated since timestamp
    if (sinceTimestamp > 0) {
      const sinceDate = new Date(sinceTimestamp);
      query.greaterThan('updatedAt', sinceDate);
    }
    
    if (importerId) {
      query.equalTo('importerId', importerId);
    }
    
    query.notEqualTo('archived', true);
    query.descending('updatedAt');
    
    // Apply cursor-based pagination
    if (cursor) {
      applyCursor(query, cursor, 'updatedAt', 'desc');
    }
    
    query.limit(parseInt(limit) + 1);
    
    const messages = await query.find({ useMasterKey: true });
    
    // Check if there's a next page
    const hasMore = messages.length > parseInt(limit);
    const results = hasMore ? messages.slice(0, parseInt(limit)) : messages;
    
    // Get next cursor
    const nextCursor = hasMore ? getNextCursor(results, 'updatedAt', 'desc') : null;
    
    const formattedResults = results.map(msg => ({
      id: msg.id,
      importerId: msg.get('importerId'),
      channel: msg.get('channel'),
      sender: msg.get('sender'),
      timestamp: msg.get('timestamp'),
      status: msg.get('status'),
      createdAt: msg.get('createdAt'),
      updatedAt: msg.get('updatedAt'),
    }));
    
    res.json({
      success: true,
      data: formattedResults,
      pagination: {
        limit: parseInt(limit),
        hasMore,
        nextCursor,
      },
      syncInfo: {
        since: sinceTimestamp,
        count: formattedResults.length,
      },
    });
  } catch (error) {
    logger.error('[Sync] Error syncing messages:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/sync/products?since=timestamp&limit=100
 * Get products updated since timestamp (incremental sync)
 */
router.get('/products', cacheMiddleware(300), async (req, res) => {
  try {
    const { since, limit = 100, cursor } = req.query;
    const sinceTimestamp = since ? parseInt(since, 10) : 0;
    
    const query = new Parse.Query(Product);
    
    // Only get products updated since timestamp
    if (sinceTimestamp > 0) {
      const sinceDate = new Date(sinceTimestamp);
      query.greaterThan('updatedAt', sinceDate);
    }
    
    query.descending('updatedAt');
    
    // Apply cursor-based pagination
    if (cursor) {
      applyCursor(query, cursor, 'updatedAt', 'desc');
    }
    
    query.limit(parseInt(limit) + 1);
    
    const products = await query.find({ useMasterKey: true });
    
    // Check if there's a next page
    const hasMore = products.length > parseInt(limit);
    const results = hasMore ? products.slice(0, parseInt(limit)) : products;
    
    // Get next cursor
    const nextCursor = hasMore ? getNextCursor(results, 'updatedAt', 'desc') : null;
    
    const formattedResults = results.map(p => ({
      id: p.id,
      name: p.get('name'),
      description: p.get('description'),
      price: p.get('price'),
      category: p.get('category'),
      tags: p.get('tags') || [],
      photos: p.get('photos') || [],
      status: p.get('status'),
      createdAt: p.get('createdAt'),
      updatedAt: p.get('updatedAt'),
    }));
    
    res.json({
      success: true,
      data: formattedResults,
      pagination: {
        limit: parseInt(limit),
        hasMore,
        nextCursor,
      },
      syncInfo: {
        since: sinceTimestamp,
        count: formattedResults.length,
      },
    });
  } catch (error) {
    logger.error('[Sync] Error syncing products:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

