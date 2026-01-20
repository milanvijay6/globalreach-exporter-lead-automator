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
  const redis = getRedis();
  if (!redis) {
    logger.warn('[MessageQueue] Redis not available, queues will not work');
    return null;
  }

  // BullMQ needs connection config, not the wrapper
  const redisUrl = process.env.REDIS_URL;
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl) {
    // Standard Redis connection
    return {
      host: redisUrl.includes('://') ? new URL(redisUrl).hostname : 'localhost',
      port: redisUrl.includes('://') ? parseInt(new URL(redisUrl).port) || 6379 : 6379,
      password: redisUrl.includes('://') ? new URL(redisUrl).password : undefined,
    };
  } else if (upstashUrl && upstashToken) {
    // Upstash Redis (use REST API compatible connection)
    // Note: BullMQ may not work directly with Upstash REST API
    // For production, use Upstash Redis with Redis protocol enabled
    logger.warn('[MessageQueue] Upstash REST API may not work with BullMQ. Use Redis protocol URL.');
    return null;
  }

  return null;
}

const connection = getRedisConnection();

// Create queues with different priorities
const whatsappQueue = connection ? new Queue('whatsapp-messages', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 1000, // Keep last 1000 jobs
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours
    },
  },
}) : null;

const emailQueue = connection ? new Queue('email-messages', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600,
      count: 1000,
    },
    removeOnFail: {
      age: 86400,
    },
  },
}) : null;

const campaignQueue = connection ? new Queue('bulk-campaigns', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 7200, // Keep completed jobs for 2 hours
      count: 500,
    },
    removeOnFail: {
      age: 86400,
    },
  },
}) : null;

/**
 * Add message to queue
 */
async function queueMessage(type, data, options = {}) {
  if (!connection) {
    logger.warn('[MessageQueue] Queue not available, message will not be queued');
    return { success: false, error: 'Queue not available' };
  }

  const { priority = 'normal', delay = 0 } = options;
  
  let queue;
  let jobOptions = {
    priority: priority === 'high' ? 1 : priority === 'low' ? 3 : 2,
    delay,
  };

  switch (type) {
    case 'whatsapp':
      queue = whatsappQueue;
      break;
    case 'email':
      queue = emailQueue;
      break;
    case 'campaign':
      queue = campaignQueue;
      break;
    default:
      return { success: false, error: 'Invalid queue type' };
  }

  if (!queue) {
    return { success: false, error: 'Queue not initialized' };
  }

  try {
    const job = await queue.add('send-message', data, jobOptions);
    logger.info(`[MessageQueue] Message queued: ${type} - Job ID: ${job.id}`);
    return { success: true, jobId: job.id, queued: true };
  } catch (error) {
    logger.error('[MessageQueue] Failed to queue message:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get queue status
 */
async function getQueueStatus() {
  if (!connection) {
    return { available: false };
  }

  const status = {
    available: true,
    whatsapp: whatsappQueue ? {
      waiting: await whatsappQueue.getWaitingCount(),
      active: await whatsappQueue.getActiveCount(),
      completed: await whatsappQueue.getCompletedCount(),
      failed: await whatsappQueue.getFailedCount(),
    } : null,
    email: emailQueue ? {
      waiting: await emailQueue.getWaitingCount(),
      active: await emailQueue.getActiveCount(),
      completed: await emailQueue.getCompletedCount(),
      failed: await emailQueue.getFailedCount(),
    } : null,
    campaign: campaignQueue ? {
      waiting: await campaignQueue.getWaitingCount(),
      active: await campaignQueue.getActiveCount(),
      completed: await campaignQueue.getCompletedCount(),
      failed: await campaignQueue.getFailedCount(),
    } : null,
  };

  return status;
}

module.exports = {
  whatsappQueue,
  emailQueue,
  campaignQueue,
  queueMessage,
  getQueueStatus,
};









