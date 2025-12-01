const express = require('express');
const router = express.Router();
const WebhookService = require('../services/webhookService');

// WhatsApp Webhook Verification (GET)
router.get('/whatsapp', async (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    const result = await WebhookService.verifyWhatsAppWebhook(mode, token, challenge);
    
    if (result) {
      console.log('WhatsApp webhook verified successfully');
      res.status(200).send(result);
    } else {
      console.warn('WhatsApp webhook verification failed', { mode, token });
      res.sendStatus(403);
    }
  } catch (error) {
    console.error('[Webhook] WhatsApp verification error:', error);
    res.sendStatus(500);
  }
});

// WhatsApp Webhook Handler (POST)
router.post('/whatsapp', async (req, res) => {
  try {
    console.log('WhatsApp webhook received', { body: JSON.stringify(req.body).substring(0, 200) });
    
    const payload = req.body;
    
    // Verify it's a WhatsApp webhook
    if (payload.object !== 'whatsapp_business_account') {
      console.warn('Invalid webhook object type', payload.object);
      return res.sendStatus(400);
    }
    
    // Process webhook
    await WebhookService.processWhatsAppWebhook(payload, req.headers, req.ip);
    
    res.sendStatus(200);
  } catch (error) {
    console.error('Error processing WhatsApp webhook', error);
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
    
    if (!signature || !timestamp || !nonce || !echostr) {
      console.warn('WeChat webhook verification failed: Missing parameters');
      return res.sendStatus(400);
    }
    
    const result = await WebhookService.verifyWeChatWebhook(signature, timestamp, nonce, echostr);
    
    if (result) {
      console.log('WeChat webhook verified successfully');
      res.send(result);
    } else {
      console.warn('WeChat webhook verification failed: Invalid signature');
      res.sendStatus(403);
    }
  } catch (error) {
    console.error('[Webhook] WeChat verification error:', error);
    res.sendStatus(500);
  }
});

// WeChat Webhook Handler (POST)
router.post('/wechat', express.text({ type: 'application/xml', limit: '10mb' }), async (req, res) => {
  try {
    console.log('WeChat webhook received', { body: req.body?.substring(0, 200) });
    
    const xmlPayload = req.body;
    
    if (!xmlPayload) {
      console.warn('WeChat webhook: Empty payload');
      return res.sendStatus(400);
    }
    
    // Verify signature (optional but recommended for security)
    const signature = req.query.signature;
    const timestamp = req.query.timestamp;
    const nonce = req.query.nonce;
    
    if (signature && timestamp && nonce) {
      const result = await WebhookService.verifyWeChatWebhook(signature, timestamp, nonce, null);
      if (!result) {
        console.warn('WeChat webhook: Invalid signature');
        return res.sendStatus(403);
      }
    }
    
    // Process webhook
    await WebhookService.processWeChatWebhook(xmlPayload, req.headers, req.ip);
    
    // WeChat expects a response (can be empty or echo)
    res.type('application/xml');
    res.send('<xml><return_code><![CDATA[SUCCESS]]></return_code></xml>');
  } catch (error) {
    console.error('Error processing WeChat webhook', error);
    res.sendStatus(500);
  }
});

module.exports = router;

