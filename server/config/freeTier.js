/**
 * Free Tier Configuration
 * Centralized detection and configuration for Azure App Service F1 Free Tier.
 *
 * Azure F1 constraints:
 * - 1 GB RAM (shared with IIS, ~460 MB available for Node)
 * - 60 CPU minutes/day
 * - 1 GB disk
 * - No always-on, no WebSocket support
 */

/**
 * Detect if running on Azure Free Tier.
 * Checks explicit flag, Azure-injected SKU variable, or infers from instance ID without SKU.
 */
function isFreeTier() {
  return process.env.AZURE_FREE_TIER === 'true' ||
         process.env.WEBSITE_SKU === 'Free' ||
         (process.env.WEBSITE_INSTANCE_ID && !process.env.WEBSITE_SKU);
}

const FREE_TIER = isFreeTier();

const config = {
  isFreeTier: FREE_TIER,

  // Rate limiting
  rateLimitMax: FREE_TIER ? 200 : 1000,
  rateLimitWindowMs: FREE_TIER ? 10 * 60 * 1000 : 15 * 60 * 1000,

  // Body parser
  bodyParserLimit: FREE_TIER ? '1mb' : '2mb',

  // Database connection pool
  dbMaxPoolSize: FREE_TIER ? 3 : 10,
  dbMinPoolSize: FREE_TIER ? 1 : 2,

  // Worker concurrency
  workerConcurrency: {
    whatsapp: FREE_TIER ? 2 : 5,
    email: FREE_TIER ? 3 : 10,
    campaign: FREE_TIER ? 1 : 2,
  },

  // Cron schedules
  schedules: {
    analytics: FREE_TIER ? '0 2 * * 0' : '0 2 * * *',
    leadScoring: FREE_TIER ? '0 */2 * * *' : '0 * * * *',
    tokenRefresh: FREE_TIER ? '0 * * * *' : '*/30 * * * *',
    cacheWarming: FREE_TIER ? '0 * * * *' : '*/15 * * * *',
    archive: FREE_TIER ? '0 3 * * 0' : '0 3 * * *',
  },

  // Features
  features: {
    websocket: FREE_TIER ? false : process.env.ENABLE_WEBSOCKET !== 'false',
    scheduledJobs: process.env.ENABLE_SCHEDULED_JOBS !== 'false',
    aiWorkers: FREE_TIER ? false : process.env.ENABLE_AI_WORKERS !== 'false',
  },

  // Compression
  compressionThreshold: FREE_TIER ? 512 : 1024,

  // Pagination defaults
  defaultPageLimit: FREE_TIER ? 25 : 50,
  maxPageLimit: FREE_TIER ? 100 : 200,
};

module.exports = config;
