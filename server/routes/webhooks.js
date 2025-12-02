const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Config = require('../models/Config');
const WebhookLog = require('../models/WebhookLog');
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
    logger.info('WhatsApp webhook received', { body: JSON.stringify(req.body).substring(0, 200) });
    
    const payload = req.body;
    
    // Verify it's a WhatsApp webhook
    if (payload.object !== 'whatsapp_business_account') {
      logger.warn('Invalid webhook object type', payload.object);
      return res.sendStatus(400);
    }

    // Log webhook
    const webhookLog = new WebhookLog();
    webhookLog.set('channel', 'WhatsApp');
    webhookLog.set('payload', payload);
    webhookLog.set('timestamp', new Date());
    await webhookLog.save(null, { useMasterKey: true });
    
    res.sendStatus(200);
  } catch (err) {
    logger.error('Error processing WhatsApp webhook', err);
    res.sendStatus(500);
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

    if (sha1 === signature) {
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
    logger.info('WeChat webhook received', { body: req.body?.substring(0, 200) });
    
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
      
      if (sha1 !== signature) {
        logger.warn('WeChat webhook: Invalid signature', { received: signature, expected: sha1 });
        return res.sendStatus(403);
      }
    }

    // Log webhook
    const webhookLog = new WebhookLog();
    webhookLog.set('channel', 'WeChat');
    webhookLog.set('payload', xmlPayload);
    webhookLog.set('timestamp', new Date());
    await webhookLog.save(null, { useMasterKey: true });
    
    // WeChat expects a response (can be empty or echo)
    res.type('application/xml');
    res.send('<xml><return_code><![CDATA[SUCCESS]]></return_code></xml>');
  } catch (err) {
    logger.error('Error processing WeChat webhook', err);
    res.sendStatus(500);
  }
});

module.exports = router;

