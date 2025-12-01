const WebhookLog = require('../models/WebhookLog');
const Message = require('../models/Message');
const Lead = require('../models/Lead');
const Config = require('../models/Config');

/**
 * Webhook Service - Handles incoming webhook events
 */
class WebhookService {
  static async processWhatsAppWebhook(payload, headers, ip) {
    try {
      // Log webhook
      await WebhookLog.create({
        channel: 'whatsapp',
        payload: payload,
        headers: headers,
        ip: ip,
        processed: false,
      });
      
      // Process WhatsApp webhook
      if (payload.object === 'whatsapp_business_account' && payload.entry) {
        for (const entry of payload.entry) {
          if (entry.changes) {
            for (const change of entry.changes) {
              if (change.value && change.value.messages) {
                for (const message of change.value.messages) {
                  await this.processWhatsAppMessage(message, change.value);
                }
              }
            }
          }
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error('[WebhookService] Error processing WhatsApp webhook:', error);
      await WebhookLog.create({
        channel: 'whatsapp',
        payload: payload,
        headers: headers,
        ip: ip,
        processed: false,
        error: error.message,
      });
      throw error;
    }
  }

  static async processWhatsAppMessage(message, value) {
    try {
      const from = message.from;
      const text = message.text?.body || '';
      const messageId = message.id;
      
      // Find or create lead
      let lead = await Lead.findAll({ search: from });
      if (!lead || lead.length === 0) {
        lead = await Lead.create({
          name: from,
          phone: from,
          contactDetail: from,
          source: 'whatsapp',
          status: 'new',
        });
      } else {
        lead = lead[0];
      }
      
      // Save message
      await Message.create({
        leadId: lead.id || lead.objectId,
        channel: 'whatsapp',
        content: text,
        direction: 'inbound',
        status: 'received',
        externalId: messageId,
        timestamp: parseInt(message.timestamp) * 1000,
      });
    } catch (error) {
      console.error('[WebhookService] Error processing WhatsApp message:', error);
      throw error;
    }
  }

  static async processWeChatWebhook(xmlPayload, headers, ip) {
    try {
      // Log webhook
      await WebhookLog.create({
        channel: 'wechat',
        payload: { xml: xmlPayload },
        headers: headers,
        ip: ip,
        processed: false,
      });
      
      // Parse XML and process WeChat message
      // Implementation would go here
      
      return { success: true };
    } catch (error) {
      console.error('[WebhookService] Error processing WeChat webhook:', error);
      await WebhookLog.create({
        channel: 'wechat',
        payload: { xml: xmlPayload },
        headers: headers,
        ip: ip,
        processed: false,
        error: error.message,
      });
      throw error;
    }
  }

  static async verifyWhatsAppWebhook(mode, token, challenge) {
    const verifyToken = await Config.get('webhookVerifyToken', process.env.WEBHOOK_TOKEN || 'globalreach_secret_token');
    
    if (mode === 'subscribe' && token === verifyToken) {
      return challenge;
    }
    
    return null;
  }

  static async verifyWeChatWebhook(signature, timestamp, nonce, echostr) {
    const webhookToken = await Config.get('webhookVerifyToken', process.env.WEBHOOK_TOKEN || 'globalreach_secret_token');
    
    const tmpStr = [webhookToken, timestamp, nonce].sort().join('');
    const crypto = require('crypto');
    const sha1 = crypto.createHash('sha1').update(tmpStr).digest('hex');
    
    if (sha1 === signature) {
      return echostr;
    }
    
    return null;
  }
}

module.exports = WebhookService;

