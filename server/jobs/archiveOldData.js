/**
 * Archive Old Data Job
 * Runs nightly to archive old campaigns and messages
 * Keeps main tables lean by moving old data to archive classes
 */

const { archiveService } = require('../utils/archiveService');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

/**
 * Archive old data job
 * Archives campaigns older than 90 days and messages older than 180 days
 */
async function archiveOldData() {
  logger.info('[ArchiveOldData] Starting archive job...');

  try {
    // Archive old campaigns
    const campaignResult = await archiveService.archiveOldCampaigns({
      useMasterKey: true,
      limit: 100,
    });

    // Archive old messages
    const messageResult = await archiveService.archiveOldMessages({
      useMasterKey: true,
      limit: 500,
    });

    const totalArchived = campaignResult.archived + messageResult.archived;
    const totalErrors = campaignResult.errors + messageResult.errors;

    logger.info(`[ArchiveOldData] Archive complete: ${totalArchived} items archived, ${totalErrors} errors`);
    
    return {
      success: totalErrors === 0,
      campaignsArchived: campaignResult.archived,
      messagesArchived: messageResult.archived,
      totalArchived,
      errors: totalErrors,
    };
  } catch (error) {
    logger.error('[ArchiveOldData] Archive job failed:', error);
    throw error;
  }
}

module.exports = { archiveOldData };

