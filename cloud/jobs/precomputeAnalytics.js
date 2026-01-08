/**
 * Precompute Analytics Cloud Job
 * Pre-computes daily analytics rollups for efficient querying
 * Runs nightly at 2 AM UTC
 */

const Parse = require('parse/node');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

/**
 * Pre-compute daily analytics rollups
 * @param {Object} options - Options
 * @returns {Promise<Object>} Pre-computation results
 */
async function precomputeAnalytics(options = {}) {
  const { useMasterKey = true } = options;
  
  logger.info('[PrecomputeAnalytics] Starting daily analytics pre-computation...');

  try {
    const Lead = Parse.Object.extend('Lead');
    const Message = Parse.Object.extend('Message');
    const AnalyticsDaily = Parse.Object.extend('AnalyticsDaily');

    // Calculate date range (yesterday)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Query leads created yesterday
    const leadQuery = new Parse.Query(Lead);
    leadQuery.greaterThanOrEqualTo('createdAt', yesterday);
    leadQuery.lessThan('createdAt', today);
    const leads = await leadQuery.find({ useMasterKey });

    // Query messages from yesterday
    const messageQuery = new Parse.Query(Message);
    messageQuery.greaterThanOrEqualTo('timestamp', yesterday.getTime());
    messageQuery.lessThan('timestamp', today.getTime());
    const messages = await messageQuery.find({ useMasterKey });

    // Aggregate lead metrics
    const leadMetrics = {
      total: leads.length,
      byStatus: {},
      byCountry: {},
    };

    leads.forEach(lead => {
      const status = lead.get('status') || 'PENDING';
      const country = lead.get('country') || 'Unknown';
      
      leadMetrics.byStatus[status] = (leadMetrics.byStatus[status] || 0) + 1;
      leadMetrics.byCountry[country] = (leadMetrics.byCountry[country] || 0) + 1;
    });

    // Aggregate message metrics
    const messageMetrics = {
      total: messages.length,
      byChannel: {},
      byStatus: {},
    };

    messages.forEach(msg => {
      const channel = msg.get('channel') || 'unknown';
      const status = msg.get('status') || 'unknown';
      
      messageMetrics.byChannel[channel] = (messageMetrics.byChannel[channel] || 0) + 1;
      messageMetrics.byStatus[status] = (messageMetrics.byStatus[status] || 0) + 1;
    });

    // Calculate score metrics
    const scores = leads.map(l => l.get('leadScore') || 0).filter(s => s > 0);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    
    const scoreDistribution = {
      high: scores.filter(s => s >= 70).length,
      medium: scores.filter(s => s >= 40 && s < 70).length,
      low: scores.filter(s => s < 40).length,
    };

    // Aggregate sentiment (if available)
    const sentimentDistribution = {
      positive: 0,
      neutral: 0,
      negative: 0,
      critical: 0,
    };

    leads.forEach(lead => {
      const sentiment = lead.get('sentimentAnalysis');
      if (sentiment && sentiment.label) {
        const label = sentiment.label.toLowerCase();
        if (label === 'positive') sentimentDistribution.positive++;
        else if (label === 'neutral') sentimentDistribution.neutral++;
        else if (label === 'negative') sentimentDistribution.negative++;
        else if (label === 'critical') sentimentDistribution.critical++;
      }
    });

    // Create or update AnalyticsDaily record
    const dateQuery = new Parse.Query(AnalyticsDaily);
    dateQuery.equalTo('date', yesterday);
    let analyticsRecord = await dateQuery.first({ useMasterKey });

    if (!analyticsRecord) {
      analyticsRecord = new AnalyticsDaily();
      analyticsRecord.set('date', yesterday);
    }

    analyticsRecord.set('metrics', {
      leads: leadMetrics,
      messages: messageMetrics,
      scores: {
        average: avgScore,
        distribution: scoreDistribution,
      },
      sentiment: sentimentDistribution,
    });
    analyticsRecord.set('computedAt', new Date());

    await analyticsRecord.save(null, { useMasterKey });

    logger.info(`[PrecomputeAnalytics] Pre-computed analytics for ${yesterday.toISOString().split('T')[0]}`);
    
    return {
      success: true,
      date: yesterday.toISOString(),
      metrics: {
        leads: leadMetrics.total,
        messages: messageMetrics.total,
        averageScore: avgScore,
      },
    };
  } catch (error) {
    logger.error('[PrecomputeAnalytics] Failed to pre-compute analytics:', error);
    throw error;
  }
}

module.exports = { precomputeAnalytics };

