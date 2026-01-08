const Parse = require('parse/node');
const Lead = require('../models/Lead');
const { denormalize } = require('../utils/denormalize');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

/**
 * Hourly AI Lead Scoring Job
 * Runs every hour
 * Scores leads that haven't been scored recently or need re-scoring
 * Uses batch scoring and queues bulk operations for better performance
 */
async function scoreLeads() {
  logger.info('[ScoreLeads] Starting hourly lead scoring...');

  try {
    // Find leads that need scoring:
    // 1. Leads without a score
    // 2. Leads with score older than 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const query = new Parse.Query(Lead);
    query.limit(100); // Process 100 leads per run
    
    // Get leads without score or with old score
    const leads = await query.find({ useMasterKey: true });
    
    const leadsToScore = leads.filter(lead => {
      const score = lead.get('leadScore');
      const scoreUpdatedAt = lead.get('scoreUpdatedAt');
      
      if (!score) return true;
      if (!scoreUpdatedAt) return true;
      if (new Date(scoreUpdatedAt) < oneDayAgo) return true;
      
      return false;
    });

    logger.info(`[ScoreLeads] Found ${leadsToScore.length} leads to score`);

    if (leadsToScore.length === 0) {
      return { success: true, scored: 0, total: 0, queued: false };
    }

    // Queue bulk scoring operation for better performance
    const { queueLeadScoring } = require('../queues/aiProcessingQueue');
    const leadIds = leadsToScore.map(lead => lead.id);
    
    const queueResult = await queueLeadScoring(leadIds, 'system', {
      priority: 'normal',
      timeout: 0, // Unlimited timeout for bulk operations
    });

    if (queueResult.success) {
      logger.info(`[ScoreLeads] Queued ${leadIds.length} leads for batch scoring - Job ID: ${queueResult.jobId}`);
      return {
        success: true,
        queued: true,
        jobId: queueResult.jobId,
        total: leadsToScore.length,
        message: 'Lead scoring queued for batch processing'
      };
    } else {
      // Fallback to synchronous batch scoring if queue is unavailable
      logger.warn('[ScoreLeads] Queue unavailable, falling back to synchronous batch scoring');
      
      const { batchScoreLeads } = await import('../../services/batchLeadScoringService');
      
      // Prepare lead data for batch scoring
      const leadData = leadsToScore.map(lead => ({
        leadId: lead.id,
        companyName: lead.get('companyName'),
        country: lead.get('country'),
        productsImported: lead.get('productsImported'),
        status: lead.get('status'),
        lastContacted: lead.get('lastContacted'),
      }));

      // Score in batches
      const results = await batchScoreLeads(leadData, { timeout: 0 });

      // Update leads with scores
      let scored = 0;
      let failed = 0;

      for (const result of results) {
        if (result.success && result.leadId) {
          try {
            const lead = leadsToScore.find(l => l.id === result.leadId);
            if (lead) {
              await denormalize.embedLeadData(lead, {
                leadScore: result.result.leadScore,
              }, { useMasterKey: true });

              if (result.result.summary) {
                lead.set('scoreReason', result.result.summary);
              }
              await lead.save(null, { useMasterKey: true });
              scored++;
            }
          } catch (error) {
            logger.warn(`[ScoreLeads] Failed to update lead ${result.leadId}:`, error.message);
            failed++;
          }
        } else {
          failed++;
        }
      }

      logger.info(`[ScoreLeads] Scored ${scored}/${leadsToScore.length} leads (${failed} failed)`);
      return { success: true, scored, failed, total: leadsToScore.length, queued: false };
    }
  } catch (error) {
    logger.error('[ScoreLeads] Error scoring leads:', error);
    throw error;
  }
}

module.exports = {
  scoreLeads,
};




