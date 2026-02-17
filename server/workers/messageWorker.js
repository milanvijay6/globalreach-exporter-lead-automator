const { Worker } = require('bullmq');
const { getRedis } = require('../config/redis');
const winston = require('winston');
const freeTierConfig = require('../config/freeTier');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Get Redis connection (same as queue)
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
    logger.warn('[MessageWorker] Upstash REST API may not work with BullMQ workers');
    return null;
  }

  return null;
}

const connection = getRedisConnection();

/**
 * Process WhatsApp message
 */
async function processWhatsAppMessage(job) {
  const { messageId, to, content, channel } = job.data;
  
  logger.info(`[MessageWorker] Processing WhatsApp message: ${messageId} to ${to}`);
  
  try {
    // Import MessagingService dynamically to avoid circular dependencies
    const { MessagingService } = await import('../../services/messagingService');
    
    // Use retry with backoff for sending
    const result = await retryWithBackoff(
      async () => {
        const sendResult = await MessagingService.sendMessage(
          messageId,
          to,
          content,
          channel,
          undefined, // importer
          false // useQueue = false (we're already in the queue)
        );

        if (!sendResult.success) {
          throw new Error(sendResult.error || 'Failed to send WhatsApp message');
        }

        return sendResult;
      },
      {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        shouldRetry: isRetryableError,
        onRetry: (error, attempt, delay) => {
          logger.warn(`[MessageWorker] WhatsApp retry ${attempt}: ${error.message}, waiting ${delay}ms`);
        },
      }
    );

    logger.info(`[MessageWorker] WhatsApp message sent successfully: ${messageId}`);
    return result;
  } catch (error) {
    logger.error(`[MessageWorker] WhatsApp message failed after retries: ${messageId}`, error);
    throw error;
  }
}

/**
 * Process Email message
 */
async function processEmailMessage(job) {
  const { messageId, to, content, subject, channel } = job.data;
  
  logger.info(`[MessageWorker] Processing Email message: ${messageId} to ${to}`);
  
  try {
    const { MessagingService } = await import('../../services/messagingService');
    
    // Use retry with backoff for sending
    const result = await retryWithBackoff(
      async () => {
        const sendResult = await MessagingService.sendMessage(
          messageId,
          to,
          content,
          channel,
          undefined, // importer
          false // useQueue = false
        );

        if (!sendResult.success) {
          throw new Error(sendResult.error || 'Failed to send email');
        }

        return sendResult;
      },
      {
        maxRetries: 3,
        initialDelay: 2000,
        maxDelay: 15000,
        shouldRetry: isRetryableError,
        onRetry: (error, attempt, delay) => {
          logger.warn(`[MessageWorker] Email retry ${attempt}: ${error.message}, waiting ${delay}ms`);
        },
      }
    );

    logger.info(`[MessageWorker] Email sent successfully: ${messageId}`);
    return result;
  } catch (error) {
    logger.error(`[MessageWorker] Email failed after retries: ${messageId}`, error);
    throw error;
  }
}

/**
 * Process Campaign message (bulk)
 */
async function processCampaignMessage(job) {
  const { campaignId, leads, message, channel } = job.data;
  
  logger.info(`[MessageWorker] Processing campaign: ${campaignId} - ${leads.length} leads`);
  
  try {
    const { MessagingService } = await import('../../services/messagingService');
    
    const results = [];
    for (const lead of leads) {
      const messageId = `campaign-${campaignId}-${lead.id}-${Date.now()}`;
      const to = lead.contactDetail || lead.email || lead.phone;
      
      if (!to) {
        logger.warn(`[MessageWorker] Lead ${lead.id} has no contact detail, skipping`);
        continue;
      }

      const result = await MessagingService.sendMessage(
        messageId,
        to,
        message,
        channel
      );

      results.push({ leadId: lead.id, success: result.success, error: result.error });
      
      // Rate limiting: wait 100ms between messages
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.info(`[MessageWorker] Campaign completed: ${campaignId} - ${results.filter(r => r.success).length}/${results.length} sent`);
    return { campaignId, results };
  } catch (error) {
    logger.error(`[MessageWorker] Campaign failed: ${campaignId}`, error);
    throw error;
  }
}

// Create workers if Redis connection is available
let whatsappWorker = null;
let emailWorker = null;
let campaignWorker = null;

if (connection) {
  const freeTier = freeTierConfig.isFreeTier;
  const whatsappConcurrency = freeTierConfig.workerConcurrency.whatsapp;
  const emailConcurrency = freeTierConfig.workerConcurrency.email;
  const campaignConcurrency = freeTierConfig.workerConcurrency.campaign;

  if (freeTier) {
    logger.info('[MessageWorker] Free tier detected - reducing worker concurrency');
  }
  
  // WhatsApp Worker
  whatsappWorker = new Worker('whatsapp-messages', processWhatsAppMessage, {
    connection,
    concurrency: whatsappConcurrency, // Reduced on free tier
    limiter: {
      max: 20, // Max 20 jobs
      duration: 1000, // Per second (rate limit)
    },
  });

  whatsappWorker.on('completed', (job) => {
    logger.info(`[MessageWorker] WhatsApp job completed: ${job.id}`);
  });

  whatsappWorker.on('failed', (job, err) => {
    logger.error(`[MessageWorker] WhatsApp job failed: ${job?.id}`, err);
  });

  // Email Worker
  emailWorker = new Worker('email-messages', processEmailMessage, {
    connection,
    concurrency: emailConcurrency, // Reduced on free tier
    limiter: {
      max: 50, // Max 50 jobs
      duration: 1000, // Per second
    },
  });

  emailWorker.on('completed', (job) => {
    logger.info(`[MessageWorker] Email job completed: ${job.id}`);
  });

  emailWorker.on('failed', (job, err) => {
    logger.error(`[MessageWorker] Email job failed: ${job?.id}`, err);
  });

  // Campaign Worker
  campaignWorker = new Worker('bulk-campaigns', processCampaignMessage, {
    connection,
    concurrency: campaignConcurrency, // Reduced on free tier
    limiter: {
      max: 1, // Max 1 campaign
      duration: 1000, // Per second
    },
  });

  campaignWorker.on('completed', (job) => {
    logger.info(`[MessageWorker] Campaign job completed: ${job.id}`);
  });

  campaignWorker.on('failed', (job, err) => {
    logger.error(`[MessageWorker] Campaign job failed: ${job?.id}`, err);
  });

  logger.info('[MessageWorker] ✅ Message workers started');
} else {
  logger.warn('[MessageWorker] ⚠️  Redis connection not available, workers not started');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('[MessageWorker] Shutting down workers...');
  if (whatsappWorker) await whatsappWorker.close();
  if (emailWorker) await emailWorker.close();
  if (campaignWorker) await campaignWorker.close();
  process.exit(0);
});

module.exports = {
  whatsappWorker,
  emailWorker,
  campaignWorker,
};

