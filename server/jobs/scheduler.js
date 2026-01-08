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
 * Start all scheduled jobs
 */
function startScheduler() {
  logger.info('[Scheduler] Starting scheduled jobs...');

  // Daily analytics aggregation at 2 AM
  const analyticsJob = cron.schedule('0 2 * * *', async () => {
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

  // Hourly AI lead scoring
  const leadScoringJob = cron.schedule('0 * * * *', async () => {
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

  // OAuth token refresh every 30 minutes
  const tokenRefreshJob = cron.schedule('*/30 * * * *', async () => {
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

  // Cache warming every 15 minutes
  const cacheWarmingJob = cron.schedule('*/15 * * * *', async () => {
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

  // Archive old data nightly at 3 AM UTC (after analytics)
  const archiveJob = cron.schedule('0 3 * * *', async () => {
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




