const { Worker } = require('bullmq');
const { getRedis } = require('../config/redis');
const WebhookLog = require('../models/WebhookLog');
const Parse = require('parse/node');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Get Redis connection
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
    logger.warn('[WebhookWorker] Upstash REST API may not work with BullMQ workers');
    return null;
  }

  return null;
}

const connection = getRedisConnection();

/**
 * Process WhatsApp webhook
 */
async function processWhatsAppWebhook(job) {
  const { payload } = job.data;
  
  logger.info(`[WebhookWorker] Processing WhatsApp webhook: ${job.id}`);
  
  try {
    // Log webhook to Parse
    const webhookLog = new WebhookLog();
    webhookLog.set('channel', 'WhatsApp');
    webhookLog.set('payload', payload);
    webhookLog.set('timestamp', new Date());
    webhookLog.set('processed', true);
    await webhookLog.save(null, { useMasterKey: true });

    // Process webhook payload
    // Extract message data from WhatsApp webhook format
    if (payload.entry && Array.isArray(payload.entry)) {
      for (const entry of payload.entry) {
        if (entry.changes && Array.isArray(entry.changes)) {
          for (const change of entry.changes) {
            if (change.value && change.value.messages) {
              // Process incoming messages
              for (const message of change.value.messages) {
                const from = message.from;
                const text = message.text?.body || '';
                const messageId = message.id;
                
                logger.info(`[WebhookWorker] Processing WhatsApp message from ${from}: ${text.substring(0, 50)}`);
                
                // TODO: Update lead/message records in Parse
                // Find lead by phone number
                // Create/update message record
                // Update lead's lastContacted
              }
            }
            
            if (change.value && change.value.statuses) {
              // Process message status updates
              for (const status of change.value.statuses) {
                const messageId = status.id;
                const statusValue = status.status; // sent, delivered, read, failed
                
                logger.info(`[WebhookWorker] Message status update: ${messageId} - ${statusValue}`);
                
                // TODO: Update message status in Parse
              }
            }
          }
        }
      }
    }

    logger.info(`[WebhookWorker] WhatsApp webhook processed successfully: ${job.id}`);
    return { success: true };
  } catch (error) {
    logger.error(`[WebhookWorker] WhatsApp webhook processing failed: ${job.id}`, error);
    throw error;
  }
}

/**
 * Process WeChat webhook
 */
async function processWeChatWebhook(job) {
  const { payload } = job.data;
  
  logger.info(`[WebhookWorker] Processing WeChat webhook: ${job.id}`);
  
  try {
    // Log webhook to Parse
    const webhookLog = new WebhookLog();
    webhookLog.set('channel', 'WeChat');
    webhookLog.set('payload', payload);
    webhookLog.set('timestamp', new Date());
    webhookLog.set('processed', true);
    await webhookLog.save(null, { useMasterKey: true });

    // TODO: Parse XML payload and process WeChat messages
    // Parse XML using fast-xml-parser
    // Extract message data
    // Update lead/message records

    logger.info(`[WebhookWorker] WeChat webhook processed successfully: ${job.id}`);
    return { success: true };
  } catch (error) {
    logger.error(`[WebhookWorker] WeChat webhook processing failed: ${job.id}`, error);
    throw error;
  }
}

/**
 * Process webhook job
 */
async function processWebhook(job) {
  const { channel, payload } = job.data;
  
  switch (channel) {
    case 'WhatsApp':
      return await processWhatsAppWebhook(job);
    case 'WeChat':
      return await processWeChatWebhook(job);
    default:
      logger.warn(`[WebhookWorker] Unknown webhook channel: ${channel}`);
      return { success: false, error: 'Unknown channel' };
  }
}

// Create worker if Redis connection is available
let webhookWorker = null;

if (connection) {
  webhookWorker = new Worker('webhook-processing', processWebhook, {
    connection,
    concurrency: 10, // Process 10 webhooks concurrently
    limiter: {
      max: 100, // Max 100 jobs
      duration: 1000, // Per second
    },
  });

  webhookWorker.on('completed', (job) => {
    logger.info(`[WebhookWorker] Webhook job completed: ${job.id}`);
  });

  webhookWorker.on('failed', (job, err) => {
    logger.error(`[WebhookWorker] Webhook job failed: ${job?.id}`, err);
  });

  logger.info('[WebhookWorker] ✅ Webhook worker started');
} else {
  logger.warn('[WebhookWorker] ⚠️  Redis connection not available, worker not started');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('[WebhookWorker] Shutting down worker...');
  if (webhookWorker) await webhookWorker.close();
  process.exit(0);
});

module.exports = {
  webhookWorker,
};









