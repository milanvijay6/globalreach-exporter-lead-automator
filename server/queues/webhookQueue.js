const { Queue } = require('bullmq');
const { getRedis } = require('../config/redis');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Get Redis connection for BullMQ
function getRedisConnection() {
  const redisUrl = process.env.REDIS_URL;
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl) {
    return {
      host: redisUrl.includes('://') ? new URL(redisUrl).hostname : 'localhost',
      port: redisUrl.includes('://') ? parseInt(new URL(redisUrl).port) || 6379 : 6379,
      password: redisUrl.includes('://') ? new URL(redisUrl).password : undefined,
    };
  } else if (upstashUrl && upstashToken) {
    logger.warn('[WebhookQueue] Upstash REST API may not work with BullMQ. Use Redis protocol URL.');
    return null;
  }

  return null;
}

const connection = getRedisConnection();

// Create webhook processing queue
const webhookQueue = connection ? new Queue('webhook-processing', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 5000, // Keep last 5000 jobs
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours
    },
  },
}) : null;

/**
 * Queue webhook for processing
 */
async function queueWebhook(channel, payload, options = {}) {
  if (!connection || !webhookQueue) {
    logger.warn('[WebhookQueue] Queue not available, webhook will not be queued');
    return { success: false, error: 'Queue not available' };
  }

  try {
    const job = await webhookQueue.add('process-webhook', {
      channel,
      payload,
      timestamp: Date.now(),
    }, {
      priority: 1, // High priority for webhooks
    });

    logger.info(`[WebhookQueue] Webhook queued: ${channel} - Job ID: ${job.id}`);
    return { success: true, jobId: job.id };
  } catch (error) {
    logger.error('[WebhookQueue] Failed to queue webhook:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  webhookQueue,
  queueWebhook,
};










