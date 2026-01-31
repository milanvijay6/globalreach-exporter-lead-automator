const cron = require('node-cron');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

/**
 * Job Scheduler
 * Manages all scheduled tasks using node-cron
 */

let jobs = [];

/**
 * Detect if running on Azure Free Tier
 */
function isFreeTier() {
  return process.env.AZURE_FREE_TIER === 'true' || 
         process.env.WEBSITE_SKU === 'Free' ||
         (process.env.WEBSITE_INSTANCE_ID && !process.env.WEBSITE_SKU);
}

/**
 * Start all scheduled jobs
 */
function startScheduler() {
  const freeTier = isFreeTier();
  if (freeTier) {
    logger.info('[Scheduler] Free tier detected - reducing job frequency');
  }
  logger.info('[Scheduler] Starting scheduled jobs...');

  // Daily analytics aggregation at 2 AM (disabled on free tier)
  const analyticsSchedule = freeTier ? '0 2 * * 0' : '0 2 * * *'; // Weekly on free tier
  const analyticsJob = cron.schedule(analyticsSchedule, async () => {
    logger.info('[Scheduler] Running daily analytics aggregation...');
    try {
      const { aggregateAnalytics } = require('./aggregateAnalytics');
      await aggregateAnalytics();
      logger.info('[Scheduler] Analytics aggregation completed');
    } catch (error) {
      logger.error('[Scheduler] Analytics aggregation failed:', error);
    }
  }, {
    scheduled: false,
    timezone: 'UTC',
  });

  // AI lead scoring - every 2 hours on free tier, hourly otherwise
  const leadScoringSchedule = freeTier ? '0 */2 * * *' : '0 * * * *';
  const leadScoringJob = cron.schedule(leadScoringSchedule, async () => {
    logger.info('[Scheduler] Running hourly lead scoring...');
    try {
      const { scoreLeads } = require('./scoreLeads');
      await scoreLeads();
      logger.info('[Scheduler] Lead scoring completed');
    } catch (error) {
      logger.error('[Scheduler] Lead scoring failed:', error);
    }
  }, {
    scheduled: false,
    timezone: 'UTC',
  });

  // OAuth token refresh - every 60 minutes on free tier, 30 minutes otherwise
  const tokenRefreshSchedule = freeTier ? '0 * * * *' : '*/30 * * * *';
  const tokenRefreshJob = cron.schedule(tokenRefreshSchedule, async () => {
    logger.info('[Scheduler] Running OAuth token refresh...');
    try {
      const { refreshTokens } = require('./refreshTokens');
      await refreshTokens();
      logger.info('[Scheduler] Token refresh completed');
    } catch (error) {
      logger.error('[Scheduler] Token refresh failed:', error);
    }
  }, {
    scheduled: false,
    timezone: 'UTC',
  });

  // Cache warming - every 60 minutes on free tier, 15 minutes otherwise
  const cacheWarmingSchedule = freeTier ? '0 * * * *' : '*/15 * * * *';
  const cacheWarmingJob = cron.schedule(cacheWarmingSchedule, async () => {
    logger.info('[Scheduler] Running cache warming...');
    try {
      const { warmCache } = require('./warmCache');
      await warmCache();
      logger.info('[Scheduler] Cache warming completed');
    } catch (error) {
      logger.error('[Scheduler] Cache warming failed:', error);
    }
  }, {
    scheduled: false,
    timezone: 'UTC',
  });

  // Archive old data - weekly on free tier, nightly otherwise
  const archiveSchedule = freeTier ? '0 3 * * 0' : '0 3 * * *';
  const archiveJob = cron.schedule(archiveSchedule, async () => {
    logger.info('[Scheduler] Running archive old data job...');
    try {
      const { archiveOldData } = require('./archiveOldData');
      await archiveOldData();
      logger.info('[Scheduler] Archive job completed');
    } catch (error) {
      logger.error('[Scheduler] Archive job failed:', error);
    }
  }, {
    scheduled: false,
    timezone: 'UTC',
  });

  // Start all jobs
  jobs = [
    { name: 'analytics', job: analyticsJob },
    { name: 'leadScoring', job: leadScoringJob },
    { name: 'tokenRefresh', job: tokenRefreshJob },
    { name: 'cacheWarming', job: cacheWarmingJob },
    { name: 'archive', job: archiveJob },
  ];

  jobs.forEach(({ name, job }) => {
    job.start();
    logger.info(`[Scheduler] ✅ Job "${name}" started`);
  });

  logger.info('[Scheduler] ✅ All scheduled jobs started');
}

/**
 * Stop all scheduled jobs
 */
function stopScheduler() {
  logger.info('[Scheduler] Stopping scheduled jobs...');
  jobs.forEach(({ name, job }) => {
    job.stop();
    logger.info(`[Scheduler] Job "${name}" stopped`);
  });
  jobs = [];
  logger.info('[Scheduler] ✅ All scheduled jobs stopped');
}

/**
 * Get status of all jobs
 */
function getJobStatus() {
  return jobs.map(({ name, job }) => ({
    name,
    running: job.running || false,
  }));
}

module.exports = {
  startScheduler,
  stopScheduler,
  getJobStatus,
};




