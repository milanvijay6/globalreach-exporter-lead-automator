/**
 * Analytics Structure Utilities
 * Time-series analytics query helpers
 */

const Parse = require('parse/node');
const AnalyticsDaily = require('../models/AnalyticsDaily');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

/**
 * Analytics Structure Service
 * Queries pre-computed time-series analytics
 */
const analyticsStructure = {
  /**
   * Get analytics for a date range from pre-computed rollups
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {Object} options - Options
   * @returns {Promise<Array>} Analytics records
   */
  async getAnalyticsRange(startDate, endDate, options = {}) {
    try {
      const { useMasterKey = true, userId = null } = options;

      const query = new Parse.Query(AnalyticsDaily);
      query.greaterThanOrEqualTo('date', startDate);
      query.lessThanOrEqualTo('date', endDate);

      if (userId) {
        query.equalTo('userId', userId);
      }

      // Use compound index: { date: -1, userId: 1 }
      query.descending('date');
      query.limit(365); // Max 1 year

      const records = await query.find({ useMasterKey });

      return records.map(r => ({
        date: r.get('date'),
        metrics: r.get('metrics'),
        userId: r.get('userId'),
        computedAt: r.get('computedAt'),
      }));
    } catch (error) {
      logger.error('[AnalyticsStructure] Failed to get analytics range:', error);
      return [];
    }
  },

  /**
   * Get analytics for a specific date
   * @param {Date} date - Date to query
   * @param {Object} options - Options
   * @returns {Promise<Object|null>} Analytics record or null
   */
  async getAnalyticsForDate(date, options = {}) {
    try {
      const { useMasterKey = true, userId = null } = options;

      const query = new Parse.Query(AnalyticsDaily);
      query.equalTo('date', date);

      if (userId) {
        query.equalTo('userId', userId);
      }

      const record = await query.first({ useMasterKey });

      if (!record) {
        return null;
      }

      return {
        date: record.get('date'),
        metrics: record.get('metrics'),
        userId: record.get('userId'),
        computedAt: record.get('computedAt'),
      };
    } catch (error) {
      logger.error('[AnalyticsStructure] Failed to get analytics for date:', error);
      return null;
    }
  },

  /**
   * Get latest analytics (most recent pre-computed data)
   * @param {Object} options - Options
   * @returns {Promise<Object|null>} Latest analytics record or null
   */
  async getLatestAnalytics(options = {}) {
    try {
      const { useMasterKey = true, userId = null } = options;

      const query = new Parse.Query(AnalyticsDaily);

      if (userId) {
        query.equalTo('userId', userId);
      }

      // Use compound index: { date: -1, userId: 1 }
      query.descending('date');
      query.limit(1);

      const record = await query.first({ useMasterKey });

      if (!record) {
        return null;
      }

      return {
        date: record.get('date'),
        metrics: record.get('metrics'),
        userId: record.get('userId'),
        computedAt: record.get('computedAt'),
      };
    } catch (error) {
      logger.error('[AnalyticsStructure] Failed to get latest analytics:', error);
      return null;
    }
  },

  /**
   * Aggregate metrics across a date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {Object} options - Options
   * @returns {Promise<Object>} Aggregated metrics
   */
  async aggregateMetrics(startDate, endDate, options = {}) {
    try {
      const records = await this.getAnalyticsRange(startDate, endDate, options);

      if (records.length === 0) {
        return {
          totalLeads: 0,
          totalMessages: 0,
          averageScore: 0,
          byStatus: {},
          byCountry: {},
        };
      }

      // Aggregate across all records
      const aggregated = {
        totalLeads: 0,
        totalMessages: 0,
        totalScores: 0,
        scoreCount: 0,
        byStatus: {},
        byCountry: {},
      };

      records.forEach(record => {
        const metrics = record.metrics || {};
        
        if (metrics.leads) {
          aggregated.totalLeads += metrics.leads.total || 0;
          
          // Aggregate by status
          if (metrics.leads.byStatus) {
            Object.keys(metrics.leads.byStatus).forEach(status => {
              aggregated.byStatus[status] = (aggregated.byStatus[status] || 0) + metrics.leads.byStatus[status];
            });
          }
          
          // Aggregate by country
          if (metrics.leads.byCountry) {
            Object.keys(metrics.leads.byCountry).forEach(country => {
              aggregated.byCountry[country] = (aggregated.byCountry[country] || 0) + metrics.leads.byCountry[country];
            });
          }
        }

        if (metrics.messages) {
          aggregated.totalMessages += metrics.messages.total || 0;
        }

        if (metrics.scores && metrics.scores.average) {
          aggregated.totalScores += metrics.scores.average;
          aggregated.scoreCount++;
        }
      });

      return {
        totalLeads: aggregated.totalLeads,
        totalMessages: aggregated.totalMessages,
        averageScore: aggregated.scoreCount > 0 ? aggregated.totalScores / aggregated.scoreCount : 0,
        byStatus: aggregated.byStatus,
        byCountry: aggregated.byCountry,
      };
    } catch (error) {
      logger.error('[AnalyticsStructure] Failed to aggregate metrics:', error);
      return {
        totalLeads: 0,
        totalMessages: 0,
        averageScore: 0,
        byStatus: {},
        byCountry: {},
      };
    }
  },
};

module.exports = { analyticsStructure };

