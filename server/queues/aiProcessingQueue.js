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
    logger.warn('[AIProcessingQueue] Redis not available, queues will not work');
    return null;
  }

  // BullMQ needs connection config, not the wrapper
  const redisUrl = process.env.REDIS_URL;
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl) {
    // Standard Redis connection
    try {
      const url = new URL(redisUrl);
      return {
        host: url.hostname,
        port: parseInt(url.port) || 6379,
        password: url.password || undefined,
      };
    } catch (e) {
      // If not a valid URL, assume it's host:port format
      const parts = redisUrl.split(':');
      return {
        host: parts[0] || 'localhost',
        port: parseInt(parts[1]) || 6379,
      };
    }
  } else if (upstashUrl && upstashToken) {
    // Upstash Redis (use REST API compatible connection)
    // Note: BullMQ may not work directly with Upstash REST API
    logger.warn('[AIProcessingQueue] Upstash REST API may not work with BullMQ. Use Redis protocol URL.');
    return null;
  }

  return null;
}

const connection = getRedisConnection();

// Create queues with different priorities
const leadScoringQueue = connection ? new Queue('ai-lead-scoring', {
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
      age: 86400, // Keep failed jobs for 24 hours
    },
  },
}) : null;

const messageGenerationQueue = connection ? new Queue('ai-message-generation', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 1000,
    },
    removeOnFail: {
      age: 86400,
    },
  },
}) : null;

const analysisQueue = connection ? new Queue('ai-analysis', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 3000,
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

/**
 * Queue bulk lead scoring job
 */
async function queueLeadScoring(leadIds, userId, options = {}) {
  if (!connection || !leadScoringQueue) {
    logger.warn('[AIProcessingQueue] Queue not available, lead scoring will not be queued');
    return { success: false, error: 'Queue not available' };
  }

  const { priority = 'normal', timeout } = options;
  
  const jobOptions = {
    priority: priority === 'high' ? 1 : priority === 'low' ? 3 : 2,
    jobId: `lead-scoring-${userId}-${Date.now()}`,
  };

  try {
    const job = await leadScoringQueue.add('score-leads', {
      leadIds,
      userId,
      operationType: 'lead-scoring',
      timeout: timeout || 0, // 0 = unlimited for bulk operations
      timestamp: Date.now(),
    }, jobOptions);

    logger.info(`[AIProcessingQueue] Lead scoring queued: ${leadIds.length} leads - Job ID: ${job.id}`);
    return { success: true, jobId: job.id, queued: true };
  } catch (error) {
    logger.error('[AIProcessingQueue] Failed to queue lead scoring:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Queue message generation job
 */
async function queueMessageGeneration(data, userId, options = {}) {
  if (!connection || !messageGenerationQueue) {
    logger.warn('[AIProcessingQueue] Queue not available, message generation will not be queued');
    return { success: false, error: 'Queue not available' };
  }

  const { priority = 'normal', timeout = 10000 } = options; // Default 10s for real-time
  
  const jobOptions = {
    priority: priority === 'high' ? 1 : priority === 'low' ? 3 : 2,
    jobId: `message-gen-${userId}-${Date.now()}`,
  };

  try {
    const job = await messageGenerationQueue.add('generate-message', {
      ...data,
      userId,
      operationType: 'message-generation',
      timeout,
      timestamp: Date.now(),
    }, jobOptions);

    logger.info(`[AIProcessingQueue] Message generation queued - Job ID: ${job.id}`);
    return { success: true, jobId: job.id, queued: true };
  } catch (error) {
    logger.error('[AIProcessingQueue] Failed to queue message generation:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Queue analysis job
 */
async function queueAnalysis(data, userId, options = {}) {
  if (!connection || !analysisQueue) {
    logger.warn('[AIProcessingQueue] Queue not available, analysis will not be queued');
    return { success: false, error: 'Queue not available' };
  }

  const { priority = 'normal', timeout = 30000 } = options; // Default 30s for background
  
  const jobOptions = {
    priority: priority === 'high' ? 1 : priority === 'low' ? 3 : 2,
    jobId: `analysis-${userId}-${Date.now()}`,
  };

  try {
    const job = await analysisQueue.add('analyze', {
      ...data,
      userId,
      operationType: 'analysis',
      timeout,
      timestamp: Date.now(),
    }, jobOptions);

    logger.info(`[AIProcessingQueue] Analysis queued - Job ID: ${job.id}`);
    return { success: true, jobId: job.id, queued: true };
  } catch (error) {
    logger.error('[AIProcessingQueue] Failed to queue analysis:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get job status
 */
async function getJobStatus(queueName, jobId) {
  if (!connection) {
    return { success: false, error: 'Queue not available' };
  }

  let queue;
  switch (queueName) {
    case 'lead-scoring':
      queue = leadScoringQueue;
      break;
    case 'message-generation':
      queue = messageGenerationQueue;
      break;
    case 'analysis':
      queue = analysisQueue;
      break;
    default:
      return { success: false, error: 'Invalid queue name' };
  }

  if (!queue) {
    return { success: false, error: 'Queue not initialized' };
  }

  try {
    const job = await queue.getJob(jobId);
    if (!job) {
      return { success: false, error: 'Job not found' };
    }

    const state = await job.getState();
    const progress = job.progress || 0;
    const result = job.returnvalue || null;
    const failedReason = job.failedReason || null;

    return {
      success: true,
      jobId: job.id,
      state,
      progress,
      result,
      failedReason,
      data: job.data,
      timestamp: job.timestamp,
    };
  } catch (error) {
    logger.error('[AIProcessingQueue] Error getting job status:', error);
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

  try {
    const queues = {
      'lead-scoring': leadScoringQueue,
      'message-generation': messageGenerationQueue,
      'analysis': analysisQueue,
    };

    const status = {};
    for (const [name, queue] of Object.entries(queues)) {
      if (queue) {
        const [waiting, active, completed, failed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
        ]);

        status[name] = {
          waiting,
          active,
          completed,
          failed,
        };
      } else {
        status[name] = { available: false };
      }
    }

    return { available: true, queues: status };
  } catch (error) {
    logger.error('[AIProcessingQueue] Error getting queue status:', error);
    return { available: false, error: error.message };
  }
}

module.exports = {
  leadScoringQueue,
  messageGenerationQueue,
  analysisQueue,
  queueLeadScoring,
  queueMessageGeneration,
  queueAnalysis,
  getJobStatus,
  getQueueStatus,
};

