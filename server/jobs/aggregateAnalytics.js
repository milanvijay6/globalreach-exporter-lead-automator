const Parse = require('parse/node');
const Lead = require('../models/Lead');
const AnalyticsDaily = require('../models/AnalyticsDaily');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

/**
 * Daily Analytics Aggregation Job
 * Runs at 2 AM UTC daily
 * Aggregates analytics data for the previous day
 */
async function aggregateAnalytics() {
  logger.info('[AggregateAnalytics] Starting daily analytics aggregation...');

  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Aggregate leads by status
    const statusCounts = {};
    const statusQuery = new Parse.Query(Lead);
    statusQuery.greaterThanOrEqualTo('createdAt', yesterday);
    statusQuery.lessThan('createdAt', today);
    const leads = await statusQuery.find({ useMasterKey: true });

    leads.forEach(lead => {
      const status = lead.get('status') || 'PENDING';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    // Aggregate by country
    const countryCounts = {};
    leads.forEach(lead => {
      const country = lead.get('country') || 'Unknown';
      countryCounts[country] = (countryCounts[country] || 0) + 1;
    });

    // Calculate average lead score (using embedded leadScore from denormalization)
    const scores = leads.map(l => l.get('leadScore') || 0).filter(s => s > 0);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    // Store aggregated data in AnalyticsDaily (time-series structure)
    const dateQuery = new Parse.Query(AnalyticsDaily);
    dateQuery.equalTo('date', yesterday);
    let analyticsRecord = await dateQuery.first({ useMasterKey: true });

    if (!analyticsRecord) {
      analyticsRecord = new AnalyticsDaily();
      analyticsRecord.set('date', yesterday);
    }

    analyticsRecord.set('metrics', {
      leads: {
        total: leads.length,
        byStatus: statusCounts,
        byCountry: countryCounts,
      },
      scores: {
        average: avgScore,
        distribution: {
          high: scores.filter(s => s >= 70).length,
          medium: scores.filter(s => s >= 40 && s < 70).length,
          low: scores.filter(s => s < 40).length,
        },
      },
    });
    analyticsRecord.set('computedAt', new Date());

    await analyticsRecord.save(null, { useMasterKey: true });

    logger.info(`[AggregateAnalytics] Aggregated ${leads.length} leads for ${yesterday.toISOString().split('T')[0]}`);
    return { success: true, leadsCount: leads.length };
  } catch (error) {
    logger.error('[AggregateAnalytics] Error aggregating analytics:', error);
    throw error;
  }
}

module.exports = {
  aggregateAnalytics,
};




