const express = require('express');
const router = express.Router();
const winston = require('winston');
const { authenticateUser, requireAuth } = require('../middleware/auth');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Apply authentication middleware to all routes
router.use(authenticateUser);
router.use(requireAuth);

/**
 * GET /api/ai/stream/generate-message
 * Server-Sent Events endpoint for streaming message generation
 */
router.get('/stream/generate-message', async (req, res) => {
  try {
    const { importer, history, myCompany, systemInstructionTemplate, targetChannel } = req.query;

    if (!importer || !systemInstructionTemplate || !targetChannel) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameters'
      });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Parse query parameters
    let importerObj, historyArr;
    try {
      importerObj = JSON.parse(decodeURIComponent(importer));
      historyArr = history ? JSON.parse(decodeURIComponent(history)) : [];
    } catch (parseError) {
      res.write(`data: ${JSON.stringify({ error: 'Invalid JSON in parameters' })}\n\n`);
      res.end();
      return;
    }

    try {
      // Import streaming function from geminiService
      const { generateAgentReplyStream } = await import('../../services/geminiService');

      // Send initial connection message
      res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

      // Stream the response
      const stream = await generateAgentReplyStream(
        importerObj,
        historyArr,
        myCompany || null,
        systemInstructionTemplate,
        targetChannel
      );

      let fullText = '';
      for await (const chunk of stream) {
        fullText += chunk;
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk, fullText })}\n\n`);
      }

      // Send completion message
      res.write(`data: ${JSON.stringify({ type: 'complete', fullText })}\n\n`);
      res.end();
    } catch (error) {
      logger.error('[AI] Streaming error:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  } catch (error) {
    logger.error('[AI] Error setting up stream:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      });
    }
  }
});

/**
 * GET /api/ai/stream/generate-intro
 * Server-Sent Events endpoint for streaming intro message generation
 */
router.get('/stream/generate-intro', async (req, res) => {
  try {
    const { importer, myCompany, myProduct, stepTemplate, targetChannel } = req.query;

    if (!importer || !stepTemplate || !targetChannel) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query parameters'
      });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Parse query parameters
    let importerObj;
    try {
      importerObj = JSON.parse(decodeURIComponent(importer));
    } catch (parseError) {
      res.write(`data: ${JSON.stringify({ error: 'Invalid JSON in parameters' })}\n\n`);
      res.end();
      return;
    }

    try {
      // Import streaming function from geminiService
      const { generateIntroMessageStream } = await import('../../services/geminiService');

      // Send initial connection message
      res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

      // Stream the response
      const stream = await generateIntroMessageStream(
        importerObj,
        myCompany || null,
        myProduct || null,
        stepTemplate,
        targetChannel
      );

      let fullText = '';
      for await (const chunk of stream) {
        fullText += chunk;
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk, fullText })}\n\n`);
      }

      // Send completion message
      res.write(`data: ${JSON.stringify({ type: 'complete', fullText })}\n\n`);
      res.end();
    } catch (error) {
      logger.error('[AI] Streaming error:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  } catch (error) {
    logger.error('[AI] Error setting up stream:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error'
      });
    }
  }
});

module.exports = router;

