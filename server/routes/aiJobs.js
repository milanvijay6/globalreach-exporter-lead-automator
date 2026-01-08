const express = require('express');
const router = express.Router();
const { queueLeadScoring, queueMessageGeneration, queueAnalysis, getJobStatus, getQueueStatus } = require('../queues/aiProcessingQueue');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

/**
 * POST /api/ai/jobs/score-leads
 * Queue bulk lead scoring job
 */
router.post('/score-leads', async (req, res) => {
  try {
    const { leadIds, priority = 'normal', timeout } = req.body;
    const userId = req.userId || req.headers['x-user-id'] || 'anonymous';

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'leadIds must be a non-empty array'
      });
    }

    const result = await queueLeadScoring(leadIds, userId, { priority, timeout });

    if (result.success) {
      res.json({
        success: true,
        jobId: result.jobId,
        message: `Lead scoring queued for ${leadIds.length} leads`
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to queue lead scoring'
      });
    }
  } catch (error) {
    logger.error('[AIJobs] Error queueing lead scoring:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * POST /api/ai/jobs/generate-message
 * Queue message generation job
 */
router.post('/generate-message', async (req, res) => {
  try {
    const { importer, history, myCompany, systemInstructionTemplate, targetChannel, priority = 'normal', timeout = 10000 } = req.body;
    const userId = req.userId || req.headers['x-user-id'] || 'anonymous';

    if (!importer || !systemInstructionTemplate || !targetChannel) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: importer, systemInstructionTemplate, targetChannel'
      });
    }

    const result = await queueMessageGeneration({
      importer,
      history: history || [],
      myCompany,
      systemInstructionTemplate,
      targetChannel,
    }, userId, { priority, timeout });

    if (result.success) {
      res.json({
        success: true,
        jobId: result.jobId,
        message: 'Message generation queued'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to queue message generation'
      });
    }
  } catch (error) {
    logger.error('[AIJobs] Error queueing message generation:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * POST /api/ai/jobs/analyze
 * Queue analysis job
 */
router.post('/analyze', async (req, res) => {
  try {
    const { data, priority = 'normal', timeout = 30000 } = req.body;
    const userId = req.userId || req.headers['x-user-id'] || 'anonymous';

    if (!data || !data.type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: data.type'
      });
    }

    const result = await queueAnalysis({ data }, userId, { priority, timeout });

    if (result.success) {
      res.json({
        success: true,
        jobId: result.jobId,
        message: 'Analysis queued'
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error || 'Failed to queue analysis'
      });
    }
  } catch (error) {
    logger.error('[AIJobs] Error queueing analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * GET /api/ai/jobs/:queueName/:jobId
 * Get job status
 */
router.get('/:queueName/:jobId', async (req, res) => {
  try {
    const { queueName, jobId } = req.params;

    const result = await getJobStatus(queueName, jobId);

    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json({
        success: false,
        error: result.error || 'Job not found'
      });
    }
  } catch (error) {
    logger.error('[AIJobs] Error getting job status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

/**
 * GET /api/ai/jobs
 * List user's AI jobs (placeholder - would need to track user jobs)
 */
router.get('/', async (req, res) => {
  try {
    const status = await getQueueStatus();
    res.json({
      success: true,
      ...status
    });
  } catch (error) {
    logger.error('[AIJobs] Error getting queue status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

module.exports = router;

