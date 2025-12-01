const Integration = require('../models/Integration');
const Config = require('../models/Config');

// Use node-fetch for Node.js (Node 18+ has built-in fetch, but node-fetch is more reliable)
let fetch;
try {
  // Try built-in fetch first (Node 18+)
  if (typeof globalThis !== 'undefined' && globalThis.fetch) {
    fetch = globalThis.fetch;
  } else {
    fetch = require('node-fetch');
  }
} catch (e) {
  // Fallback to node-fetch if built-in not available
  fetch = require('node-fetch');
}

/**
 * Messaging Service - Handles sending messages via different channels
 */
class MessagingService {
  static async sendMessage(leadId, to, content, channel, leadData = {}) {
    try {
      if (channel === 'email' || channel === 'Email') {
        return await this.sendEmail(to, content, leadData);
      } else if (channel === 'whatsapp' || channel === 'WhatsApp') {
        return await this.sendWhatsApp(to, content);
      } else if (channel === 'wechat' || channel === 'WeChat') {
        return await this.sendWeChat(to, content);
      }
      
      throw new Error(`Unsupported channel: ${channel}`);
    } catch (error) {
      console.error('[MessagingService] Error sending message:', error);
      return { success: false, error: error.message };
    }
  }

  static async sendEmail(to, content, leadData = {}) {
    try {
      const integration = await Integration.get('outlook');
      if (!integration || !integration.accessToken) {
        throw new Error('Email integration not connected');
      }
      
      // Use Microsoft Graph API to send email
      const subject = leadData.companyName 
        ? `Re: ${leadData.companyName} - Inquiry` 
        : 'Re: Your Inquiry';
      
      const emailBody = {
        message: {
          subject: subject,
          body: {
            contentType: 'HTML',
            content: content.replace(/\n/g, '<br>'),
          },
          toRecipients: [
            {
              emailAddress: {
                address: to,
              },
            },
          ],
        },
      };
      
      const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${integration.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emailBody),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to send email: ${error}`);
      }
      
      return { success: true };
    } catch (error) {
      console.error('[MessagingService] Error sending email:', error);
      return { success: false, error: error.message };
    }
  }

  static async sendWhatsApp(to, content) {
    try {
      const integration = await Integration.get('whatsapp');
      if (!integration || !integration.accessToken) {
        throw new Error('WhatsApp integration not connected');
      }
      
      const phoneNumberId = await Config.get('whatsappPhoneNumberId', '');
      if (!phoneNumberId) {
        throw new Error('WhatsApp Phone Number ID not configured');
      }
      
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${integration.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: to,
            type: 'text',
            text: {
              body: content,
            },
          }),
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to send WhatsApp message: ${JSON.stringify(error)}`);
      }
      
      return { success: true };
    } catch (error) {
      console.error('[MessagingService] Error sending WhatsApp:', error);
      return { success: false, error: error.message };
    }
  }

  static async sendWeChat(to, content) {
    // WeChat implementation would go here
    throw new Error('WeChat messaging not yet implemented');
  }
}

module.exports = MessagingService;

