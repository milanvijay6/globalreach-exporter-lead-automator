const cron = require('node-cron');
const winston = require('winston');
const freeTierConfig = require('../config/freeTier');

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
 * Start all scheduled jobs
 */
function startScheduler() {
  const freeTier = freeTierConfig.isFreeTier;
  if (freeTier) {
    logger.info('[Scheduler] Free tier detected - reducing job frequency');
  }
  logger.info('[Scheduler] Starting scheduled jobs...');

  // Daily analytics aggregation at 2 AM (weekly on free tier)
  const analyticsSchedule = freeTierConfig.schedules.analytics;
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

  // AI lead scoring
  const leadScoringSchedule = freeTierConfig.schedules.leadScoring;
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

  // OAuth token refresh
  const tokenRefreshSchedule = freeTierConfig.schedules.tokenRefresh;
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

  // Cache warming
  const cacheWarmingSchedule = freeTierConfig.schedules.cacheWarming;
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

  // Archive old data
  const archiveSchedule = freeTierConfig.schedules.archive;
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




