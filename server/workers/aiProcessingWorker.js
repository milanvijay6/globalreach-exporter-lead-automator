const { Worker } = require('bullmq');
const { getRedis } = require('../config/redis');
const winston = require('winston');
const Parse = require('parse/node');
const Lead = require('../models/Lead');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Get Redis connection for BullMQ
function getRedisConnection() {
  const redis = getRedis();
  if (!redis) {
    logger.warn('[AIProcessingWorker] Redis not available, workers will not work');
    return null;
  }

  const redisUrl = process.env.REDIS_URL;
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl) {
    try {
      const url = new URL(redisUrl);
      return {
        host: url.hostname,
        port: parseInt(url.port) || 6379,
        password: url.password || undefined,
      };
    } catch (e) {
      const parts = redisUrl.split(':');
      return {
        host: parts[0] || 'localhost',
        port: parseInt(parts[1]) || 6379,
      };
    }
  } else if (upstashUrl && upstashToken) {
    logger.warn('[AIProcessingWorker] Upstash REST API may not work with BullMQ. Use Redis protocol URL.');
    return null;
  }

  return null;
}

const connection = getRedisConnection();

/**
 * Process lead scoring job
 */
async function processLeadScoring(job) {
  const { leadIds, userId, timeout } = job.data;
  
  logger.info(`[AIProcessingWorker] Processing lead scoring job: ${leadIds.length} leads`);

  try {
    // Set up timeout if provided
    let timeoutId = null;
    if (timeout && timeout > 0) {
      timeoutId = setTimeout(() => {
        logger.warn(`[AIProcessingWorker] Lead scoring job timed out after ${timeout}ms`);
        job.updateProgress(90); // Mark as mostly done before timeout
      }, timeout);
    }

    // Update progress
    await job.updateProgress(10);

    // Fetch leads from Parse
    const query = new Parse.Query(Lead);
    query.containedIn('objectId', leadIds);
    const leads = await query.find({ useMasterKey: true });

    if (leads.length === 0) {
      logger.warn(`[AIProcessingWorker] No leads found for IDs: ${leadIds.join(', ')}`);
      if (timeoutId) clearTimeout(timeoutId);
      return { success: true, scored: 0, total: 0, message: 'No leads found' };
    }

    await job.updateProgress(20);

    // Prepare lead data for batch scoring
    const { batchScoreLeads } = await import('../../services/batchLeadScoringService');
    const leadData = leads.map(lead => ({
      leadId: lead.id,
      companyName: lead.get('companyName'),
      country: lead.get('country'),
      productsImported: lead.get('productsImported'),
      status: lead.get('status'),
      lastContacted: lead.get('lastContacted'),
    }));

    await job.updateProgress(30);

    // Score leads in batches
    const results = await batchScoreLeads(leadData, { timeout: timeout || 0 });
    
    await job.updateProgress(60);

    // Update leads with scores
    const { denormalize } = require('../utils/denormalize');
    let scored = 0;
    let failed = 0;

    for (const result of results) {
      if (result.success && result.leadId) {
        try {
          const lead = leads.find(l => l.id === result.leadId);
          if (lead) {
            await denormalize.embedLeadData(lead, {
              leadScore: result.result.leadScore,
            }, { useMasterKey: true });

            if (result.result.summary) {
              lead.set('scoreReason', result.result.summary);
            }
            await lead.save(null, { useMasterKey: true });
            scored++;
          }
        } catch (error) {
          logger.error(`[AIProcessingWorker] Failed to update lead ${result.leadId}:`, error.message);
          failed++;
        }
      } else {
        failed++;
      }
    }

    if (timeoutId) clearTimeout(timeoutId);
    await job.updateProgress(100);

    logger.info(`[AIProcessingWorker] Lead scoring completed: ${scored} scored, ${failed} failed`);
    return {
      success: true,
      scored,
      failed,
      total: leads.length,
      results: results.map(r => ({
        leadId: r.leadId,
        success: r.success,
        leadScore: r.result?.leadScore,
      })),
    };
  } catch (error) {
    logger.error('[AIProcessingWorker] Lead scoring job failed:', error);
    throw error;
  }
}

/**
 * Process message generation job
 */
async function processMessageGeneration(job) {
  const { importer, history, myCompany, systemInstructionTemplate, targetChannel, timeout } = job.data;
  
  logger.info(`[AIProcessingWorker] Processing message generation job`);

  try {
    let timeoutId = null;
    if (timeout && timeout > 0) {
      timeoutId = setTimeout(() => {
        logger.warn(`[AIProcessingWorker] Message generation job timed out after ${timeout}ms`);
      }, timeout);
    }

    await job.updateProgress(10);

    const { generateAgentReply } = await import('../../services/geminiService');
    
    await job.updateProgress(30);

    const message = await generateAgentReply(
      importer,
      history || [],
      myCompany,
      systemInstructionTemplate,
      targetChannel
    );

    if (timeoutId) clearTimeout(timeoutId);
    await job.updateProgress(100);

    logger.info(`[AIProcessingWorker] Message generation completed`);
    return {
      success: true,
      message,
    };
  } catch (error) {
    logger.error('[AIProcessingWorker] Message generation job failed:', error);
    throw error;
  }
}

/**
 * Process analysis job
 */
async function processAnalysis(job) {
  const { data, timeout } = job.data;
  
  logger.info(`[AIProcessingWorker] Processing analysis job`);

  try {
    let timeoutId = null;
    if (timeout && timeout > 0) {
      timeoutId = setTimeout(() => {
        logger.warn(`[AIProcessingWorker] Analysis job timed out after ${timeout}ms`);
      }, timeout);
    }

    await job.updateProgress(10);

    // Import analysis function based on data type
    const { analyzeLeadQuality, generateLeadResearch } = await import('../../services/geminiService');
    
    await job.updateProgress(30);

    let result;
    if (data.type === 'lead-quality') {
      result = await analyzeLeadQuality(data.history || []);
    } else if (data.type === 'lead-research') {
      result = await generateLeadResearch(data.context);
    } else {
      throw new Error(`Unknown analysis type: ${data.type}`);
    }

    if (timeoutId) clearTimeout(timeoutId);
    await job.updateProgress(100);

    logger.info(`[AIProcessingWorker] Analysis completed`);
    return {
      success: true,
      result,
    };
  } catch (error) {
    logger.error('[AIProcessingWorker] Analysis job failed:', error);
    throw error;
  }
}

// Create workers if Redis connection is available
let leadScoringWorker = null;
let messageGenerationWorker = null;
let analysisWorker = null;

if (connection) {
  // Lead Scoring Worker
  leadScoringWorker = new Worker('ai-lead-scoring', processLeadScoring, {
    connection,
    concurrency: 2, // Process 2 batches concurrently
    limiter: {
      max: 5, // Max 5 jobs
      duration: 60000, // Per minute (rate limit)
    },
  });

  leadScoringWorker.on('completed', (job) => {
    logger.info(`[AIProcessingWorker] Lead scoring job completed: ${job.id}`);
  });

  leadScoringWorker.on('failed', (job, err) => {
    logger.error(`[AIProcessingWorker] Lead scoring job failed: ${job?.id}`, err);
  });

  // Message Generation Worker
  messageGenerationWorker = new Worker('ai-message-generation', processMessageGeneration, {
    connection,
    concurrency: 5, // Process 5 messages concurrently
    limiter: {
      max: 20, // Max 20 jobs
      duration: 1000, // Per second
    },
  });

  messageGenerationWorker.on('completed', (job) => {
    logger.info(`[AIProcessingWorker] Message generation job completed: ${job.id}`);
  });

  messageGenerationWorker.on('failed', (job, err) => {
    logger.error(`[AIProcessingWorker] Message generation job failed: ${job?.id}`, err);
  });

  // Analysis Worker
  analysisWorker = new Worker('ai-analysis', processAnalysis, {
    connection,
    concurrency: 3, // Process 3 analyses concurrently
    limiter: {
      max: 10, // Max 10 jobs
      duration: 1000, // Per second
    },
  });

  analysisWorker.on('completed', (job) => {
    logger.info(`[AIProcessingWorker] Analysis job completed: ${job.id}`);
  });

  analysisWorker.on('failed', (job, err) => {
    logger.error(`[AIProcessingWorker] Analysis job failed: ${job?.id}`, err);
  });

  logger.info('[AIProcessingWorker] ✅ AI processing workers started');
} else {
  logger.warn('[AIProcessingWorker] ⚠️  Redis connection not available, workers not started');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('[AIProcessingWorker] Shutting down workers...');
  const promises = [];
  if (leadScoringWorker) promises.push(leadScoringWorker.close());
  if (messageGenerationWorker) promises.push(messageGenerationWorker.close());
  if (analysisWorker) promises.push(analysisWorker.close());
  await Promise.all(promises);
  process.exit(0);
});

module.exports = {
  leadScoringWorker,
  messageGenerationWorker,
  analysisWorker,
};

