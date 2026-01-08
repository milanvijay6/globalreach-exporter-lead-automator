const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const Message = require('../models/Message');
const Product = require('../models/Product');
const Config = require('../models/Config');
const AnalyticsDaily = require('../models/AnalyticsDaily');
const Parse = require('parse/node');
const { cacheMiddleware } = require('../middleware/cache');
const { parseFileService } = require('../utils/parseFileService');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

/**
 * GET /api/bundle/lead-detail/:id
 * Returns lead + recent messages (last 10) + analytics summary in one response
 */
router.get('/lead-detail/:id', cacheMiddleware(60), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId || null;

    // Fetch all data in parallel
    const [leadResult, messagesResult, analyticsResult] = await Promise.all([
      // Get lead
      (async () => {
        try {
          const query = new Parse.Query(Lead);
          const lead = await query.get(id, { useMasterKey: true });
          return {
            id: lead.id,
            name: lead.get('name'),
            companyName: lead.get('companyName'),
            country: lead.get('country'),
            contactDetail: lead.get('contactDetail'),
            status: lead.get('status'),
            leadScore: lead.get('leadScore'),
            lastContacted: lead.get('lastContacted'),
            productsImported: lead.get('productsImported'),
            chatHistory: lead.get('chatHistory') || [],
            createdAt: lead.get('createdAt'),
            updatedAt: lead.get('updatedAt'),
          };
        } catch (error) {
          if (error.code === Parse.Error.OBJECT_NOT_FOUND) {
            return null;
          }
          throw error;
        }
      })(),
      
      // Get recent messages (last 10)
      (async () => {
        try {
          const query = new Parse.Query(Message);
          query.equalTo('importerId', id);
          query.descending('timestamp');
          query.limit(10);
          query.notEqualTo('archived', true);
          
          const messages = await query.find({ useMasterKey: true });
          
          return await Promise.all(messages.map(async (msg) => {
            const base = {
              id: msg.id,
              importerId: msg.get('importerId'),
              channel: msg.get('channel'),
              sender: msg.get('sender'),
              timestamp: msg.get('timestamp'),
              status: msg.get('status'),
            };
            
            const content = await parseFileService.getContent(msg, { useMasterKey: true });
            base.content = content;
            
            return base;
          }));
        } catch (error) {
          logger.warn('[Bundle] Failed to fetch messages:', error.message);
          return [];
        }
      })(),
      
      // Get analytics summary for this lead
      (async () => {
        try {
          // Get lead's country for country-specific analytics
          const leadQuery = new Parse.Query(Lead);
          const lead = await leadQuery.get(id, { useMasterKey: true });
          const country = lead.get('country');
          
          // Get recent analytics for this country
          const analyticsQuery = new Parse.Query(AnalyticsDaily);
          if (country) {
            // Note: AnalyticsDaily may not have country field, this is a placeholder
            // Adjust based on actual schema
          }
          analyticsQuery.descending('date');
          analyticsQuery.limit(7); // Last 7 days
          
          const analytics = await analyticsQuery.find({ useMasterKey: true });
          
          return {
            recentDays: analytics.map(a => ({
              date: a.get('date'),
              totalLeads: a.get('totalLeads'),
              averageLeadScore: a.get('averageLeadScore'),
            })),
          };
        } catch (error) {
          logger.warn('[Bundle] Failed to fetch analytics:', error.message);
          return { recentDays: [] };
        }
      })(),
    ]);

    if (!leadResult) {
      return res.status(404).json({ success: false, error: 'Lead not found' });
    }

    res.json({
      success: true,
      data: {
        lead: leadResult,
        messages: messagesResult,
        analytics: analyticsResult,
      },
    });
  } catch (error) {
    logger.error('[Bundle] Error in lead-detail:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/bundle/dashboard
 * Returns overview metrics + recent leads + system health in one response
 */
router.get('/dashboard', cacheMiddleware(30), async (req, res) => {
  try {
    const userId = req.userId || null;

    // Fetch all data in parallel
    const [overviewResult, recentLeadsResult, systemHealthResult] = await Promise.all([
      // Get overview metrics
      (async () => {
        try {
          const leadsQuery = new Parse.Query(Lead);
          leadsQuery.notEqualTo('archived', true);
          const totalLeads = await leadsQuery.count({ useMasterKey: true });
          
          // Get leads by status
          const statusCounts = {};
          const statuses = ['Pending', 'Contacted', 'Engaged', 'Interested', 'Negotiation', 'Closed', 'Cold'];
          
          for (const status of statuses) {
            const statusQuery = new Parse.Query(Lead);
            statusQuery.equalTo('status', status);
            statusQuery.notEqualTo('archived', true);
            statusCounts[status] = await statusQuery.count({ useMasterKey: true });
          }
          
          return {
            totalLeads,
            statusCounts,
          };
        } catch (error) {
          logger.warn('[Bundle] Failed to fetch overview:', error.message);
          return { totalLeads: 0, statusCounts: {} };
        }
      })(),
      
      // Get recent leads (last 10)
      (async () => {
        try {
          const query = new Parse.Query(Lead);
          query.notEqualTo('archived', true);
          query.descending('createdAt');
          query.limit(10);
          
          const leads = await query.find({ useMasterKey: true });
          
          return leads.map(l => ({
            id: l.id,
            name: l.get('name'),
            companyName: l.get('companyName'),
            country: l.get('country'),
            status: l.get('status'),
            leadScore: l.get('leadScore'),
            createdAt: l.get('createdAt'),
          }));
        } catch (error) {
          logger.warn('[Bundle] Failed to fetch recent leads:', error.message);
          return [];
        }
      })(),
      
      // Get system health (placeholder - would integrate with actual health checks)
      (async () => {
        try {
          // Get recent analytics for system health
          const analyticsQuery = new Parse.Query(AnalyticsDaily);
          analyticsQuery.descending('date');
          analyticsQuery.limit(1);
          
          const latest = await analyticsQuery.first({ useMasterKey: true });
          
          return {
            status: 'healthy',
            lastAnalyticsUpdate: latest ? latest.get('date') : null,
            timestamp: Date.now(),
          };
        } catch (error) {
          logger.warn('[Bundle] Failed to fetch system health:', error.message);
          return { status: 'unknown', timestamp: Date.now() };
        }
      })(),
    ]);

    res.json({
      success: true,
      data: {
        overview: overviewResult,
        recentLeads: recentLeadsResult,
        systemHealth: systemHealthResult,
      },
    });
  } catch (error) {
    logger.error('[Bundle] Error in dashboard:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/bundle/lead-list
 * Returns leads + product catalog summary + config in one response
 */
router.get('/lead-list', cacheMiddleware(60), async (req, res) => {
  try {
    const { status, country, limit = 50, cursor, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const userId = req.userId || null;

    // Fetch all data in parallel
    const [leadsResult, productsResult, configResult] = await Promise.all([
      // Get leads
      (async () => {
        try {
          const query = new Parse.Query(Lead);
          query.notEqualTo('archived', true);
          
          if (status) {
            query.equalTo('status', status);
          }
          
          if (country) {
            query.equalTo('country', country);
          }
          
          if (sortOrder === 'desc') {
            query.descending(sortBy);
          } else {
            query.ascending(sortBy);
          }
          
          query.limit(parseInt(limit));
          
          const leads = await query.find({ useMasterKey: true });
          
          return leads.map(l => ({
            id: l.id,
            name: l.get('name'),
            companyName: l.get('companyName'),
            country: l.get('country'),
            status: l.get('status'),
            leadScore: l.get('leadScore'),
            createdAt: l.get('createdAt'),
          }));
        } catch (error) {
          logger.warn('[Bundle] Failed to fetch leads:', error.message);
          return [];
        }
      })(),
      
      // Get product catalog summary (categories and counts)
      (async () => {
        try {
          const query = new Parse.Query(Product);
          query.limit(1000); // Get all for summary
          
          const products = await query.find({ useMasterKey: true });
          
          const categories = {};
          products.forEach(p => {
            const category = p.get('category') || 'Uncategorized';
            categories[category] = (categories[category] || 0) + 1;
          });
          
          return {
            totalProducts: products.length,
            categories,
          };
        } catch (error) {
          logger.warn('[Bundle] Failed to fetch products:', error.message);
          return { totalProducts: 0, categories: {} };
        }
      })(),
      
      // Get config
      (async () => {
        try {
          const config = await Config.getAll(userId, false);
          return config;
        } catch (error) {
          logger.warn('[Bundle] Failed to fetch config:', error.message);
          return {};
        }
      })(),
    ]);

    res.json({
      success: true,
      data: {
        leads: leadsResult,
        products: productsResult,
        config: configResult,
      },
    });
  } catch (error) {
    logger.error('[Bundle] Error in lead-list:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

