const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Config = require('../models/Config');
const WebhookLog = require('../models/WebhookLog');
const { queueWebhook } = require('../queues/webhookQueue');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

// WhatsApp Webhook Verification (GET)
router.get('/whatsapp', async (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    const verifyToken = await Config.get('webhookVerifyToken', 'globalreach_secret_token');
    
    if (mode === 'subscribe' && token === verifyToken) {
      logger.info('WhatsApp webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      logger.warn('WhatsApp webhook verification failed', { mode, token });
      res.sendStatus(403);
    }
  } catch (error) {
    logger.error('WhatsApp webhook verification error:', error);
    res.sendStatus(500);
  }
});

// WhatsApp Webhook Handler (POST)
router.post('/whatsapp', async (req, res) => {
  try {
    // SECURITY: Verify WhatsApp signature
    const signature = req.get('X-Hub-Signature-256');
    const appSecret = (await Config.get('whatsappAppSecret')) || process.env.WHATSAPP_APP_SECRET;

    if (appSecret) {
      if (!signature) {
        logger.warn('WhatsApp webhook missing X-Hub-Signature-256 header');
        return res.sendStatus(401);
      }

      if (!req.rawBody) {
        logger.error('WhatsApp webhook missing raw body for signature verification');
        return res.sendStatus(500);
      }

      const elements = signature.split('=');
      if (elements.length !== 2) {
        logger.warn('WhatsApp webhook invalid signature format');
        return res.sendStatus(401);
      }
      const signatureHash = elements[1];
      const expectedHash = crypto
        .createHmac('sha256', appSecret)
        .update(req.rawBody)
        .digest('hex');

      const signatureBuffer = Buffer.from(signatureHash, 'utf8');
      const expectedBuffer = Buffer.from(expectedHash, 'utf8');

      if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
        logger.warn('WhatsApp webhook signature verification failed');
        return res.sendStatus(403);
      }
    } else {
      logger.warn('WARNING: WhatsApp App Secret not configured. Webhook signature verification skipped.');
    }

    const payload = req.body;

    // Verify it's a WhatsApp webhook
    if (payload.object !== 'whatsapp_business_account') {
      logger.warn('Invalid webhook object type', payload.object);
      return res.sendStatus(400);
    }

    // Acknowledge immediately (200 OK)
    res.sendStatus(200);
    
    // Queue webhook for async processing
    try {
      await queueWebhook('WhatsApp', payload);
      logger.info('WhatsApp webhook queued for processing');
    } catch (queueError) {
      // If queue fails, process synchronously as fallback
      logger.warn('Webhook queue failed, processing synchronously:', queueError.message);
      
      // Process synchronously (fallback)
      const webhookLog = new WebhookLog();
      webhookLog.set('channel', 'WhatsApp');
      webhookLog.set('payload', payload);
      webhookLog.set('timestamp', new Date());
      await webhookLog.save(null, { useMasterKey: true });
      
      // TODO: Process webhook payload (update leads, messages, etc.)
      logger.info('WhatsApp webhook processed synchronously');
    }
  } catch (err) {
    logger.error('Error handling WhatsApp webhook', err);
    // Already sent 200, so we can't change status
    // Log error for monitoring
  }
});

// WeChat Webhook Verification (GET)
router.get('/wechat', async (req, res) => {
  try {
    const signature = req.query.signature;
    const timestamp = req.query.timestamp;
    const nonce = req.query.nonce;
    const echostr = req.query.echostr;
    
    const webhookToken = await Config.get('webhookVerifyToken', 'globalreach_secret_token');

    if (!signature || !timestamp || !nonce || !echostr) {
      logger.warn('WeChat webhook verification failed: Missing parameters');
      return res.sendStatus(400);
    }

    // WeChat signature algorithm: SHA1(token + timestamp + nonce) sorted
    const tmpStr = [webhookToken, timestamp, nonce].sort().join('');
    const sha1 = crypto.createHash('sha1').update(tmpStr).digest('hex');

    const hashBuffer = Buffer.from(sha1, 'utf8');
    const signatureBuffer = Buffer.from(signature, 'utf8');

    if (hashBuffer.length === signatureBuffer.length && crypto.timingSafeEqual(hashBuffer, signatureBuffer)) {
      logger.info('WeChat webhook verified successfully');
      res.send(echostr);
    } else {
      logger.warn('WeChat webhook verification failed: Invalid signature', { 
        received: signature, 
        expected: sha1 
      });
      res.sendStatus(403);
    }
  } catch (error) {
    logger.error('WeChat webhook verification error:', error);
    res.sendStatus(500);
  }
});

// WeChat Webhook Handler (POST)
router.post('/wechat', express.text({ type: 'application/xml', limit: '10mb' }), async (req, res) => {
  try {
    const xmlPayload = req.body;
    
    if (!xmlPayload) {
      logger.warn('WeChat webhook: Empty payload');
      return res.sendStatus(400);
    }

    // Verify signature (optional but recommended for security)
    const signature = req.query.signature;
    const timestamp = req.query.timestamp;
    const nonce = req.query.nonce;
    const webhookToken = await Config.get('webhookVerifyToken', 'globalreach_secret_token');

    if (signature && timestamp && nonce) {
      const tmpStr = [webhookToken, timestamp, nonce].sort().join('');
      const sha1 = crypto.createHash('sha1').update(tmpStr).digest('hex');
      
      const hashBuffer = Buffer.from(sha1, 'utf8');
      const signatureBuffer = typeof signature === 'string' ? Buffer.from(signature, 'utf8') : Buffer.alloc(0);

      if (hashBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(hashBuffer, signatureBuffer)) {
        logger.warn('WeChat webhook: Invalid signature', { received: signature, expected: sha1 });
        return res.sendStatus(403);
      }
    }

    // Acknowledge immediately (WeChat expects XML response)
    res.type('application/xml');
    res.send('<xml><return_code><![CDATA[SUCCESS]]></return_code></xml>');
    
    // Queue webhook for async processing
    try {
      await queueWebhook('WeChat', xmlPayload);
      logger.info('WeChat webhook queued for processing');
    } catch (queueError) {
      // If queue fails, process synchronously as fallback
      logger.warn('Webhook queue failed, processing synchronously:', queueError.message);
      
      // Process synchronously (fallback)
      const webhookLog = new WebhookLog();
      webhookLog.set('channel', 'WeChat');
      webhookLog.set('payload', xmlPayload);
      webhookLog.set('timestamp', new Date());
      await webhookLog.save(null, { useMasterKey: true });
      
      // TODO: Process webhook payload (update leads, messages, etc.)
      logger.info('WeChat webhook processed synchronously');
    }
  } catch (err) {
    logger.error('Error handling WeChat webhook', err);
    // Already sent response, so we can't change status
    // Log error for monitoring
  }
});

module.exports = router;

