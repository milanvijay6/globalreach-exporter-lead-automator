
import { Channel, MessageStatus } from '../types';

const WHATSAPP_API_BASE = 'https://graph.facebook.com/v21.0';

export interface WhatsAppMessageResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

export interface WhatsAppWebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  image?: { caption?: string; mime_type: string; sha256: string; id: string };
  video?: { caption?: string; mime_type: string; sha256: string; id: string };
  document?: { caption?: string; filename?: string; sha256: string; mime_type: string; id: string };
  audio?: { mime_type: string; sha256: string; id: string };
}

export interface WhatsAppWebhookStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string; message: string }>;
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { phone_number_id: string; display_phone_number: string };
        contacts?: Array<{ profile: { name: string }; wa_id: string }>;
        messages?: WhatsAppWebhookMessage[];
        statuses?: WhatsAppWebhookStatus[];
      };
      field: string;
    }>;
  }>;
}

/**
 * WhatsApp Cloud API Service
 * Handles sending messages, receiving webhooks, and status updates
 */
export const WhatsAppService = {
  /**
   * Sends a text message via WhatsApp Cloud API
   */
  sendTextMessage: async (
    phoneNumberId: string,
    accessToken: string,
    to: string,
    message: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    // Format phone number (remove +, spaces, dashes)
    const formattedTo = to.replace(/[\s+\-()]/g, '');
    
    // Ensure phone number starts with country code (no leading +)
    const recipientNumber = formattedTo.startsWith('+') ? formattedTo.slice(1) : formattedTo;

    // Truncate message to WhatsApp limit (4096 characters)
    const truncatedMessage = message.substring(0, 4096);

    try {
      const response = await fetch(
        `${WHATSAPP_API_BASE}/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipientNumber,
            type: 'text',
            text: {
              body: truncatedMessage,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
        
        // Handle specific error cases
        if (response.status === 429) {
          return { success: false, error: 'Rate limit exceeded. Please wait before sending more messages.' };
        }
        if (response.status === 401) {
          return { success: false, error: 'Invalid access token. Please check your WhatsApp API credentials.' };
        }
        if (response.status === 404) {
          return { success: false, error: 'Phone number ID not found. Please verify your WhatsApp Business account setup.' };
        }
        
        return { success: false, error: errorMessage };
      }

      const data: WhatsAppMessageResponse = await response.json();
      const messageId = data.messages?.[0]?.id;

      if (!messageId) {
        return { success: false, error: 'No message ID returned from API' };
      }

      return { success: true, messageId };
    } catch (error: any) {
      console.error('[WhatsAppService] Send message error:', error);
      return { 
        success: false, 
        error: error.message || 'Network error while sending message' 
      };
    }
  },

  /**
   * Sends a template message (for initial outreach - requires approved templates)
   */
  sendTemplateMessage: async (
    phoneNumberId: string,
    accessToken: string,
    to: string,
    templateName: string,
    languageCode: string = 'en',
    parameters?: Array<{ type: string; text: string }>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    const formattedTo = to.replace(/[\s+\-()]/g, '');
    const recipientNumber = formattedTo.startsWith('+') ? formattedTo.slice(1) : formattedTo;

    try {
      const response = await fetch(
        `${WHATSAPP_API_BASE}/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: recipientNumber,
            type: 'template',
            template: {
              name: templateName,
              language: {
                code: languageCode,
              },
              ...(parameters && { components: [{ type: 'body', parameters }] }),
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { 
          success: false, 
          error: errorData.error?.message || `HTTP ${response.status}` 
        };
      }

      const data: WhatsAppMessageResponse = await response.json();
      return { success: true, messageId: data.messages?.[0]?.id };
    } catch (error: any) {
      console.error('[WhatsAppService] Send template error:', error);
      return { success: false, error: error.message || 'Network error' };
    }
  },

  /**
   * Verifies webhook challenge from Meta
   */
  verifyWebhook: (
    mode: string | null,
    token: string | null,
    challenge: string | null,
    verifyToken: string
  ): { verified: boolean; challenge?: string } => {
    if (mode === 'subscribe' && token === verifyToken) {
      return { verified: true, challenge: challenge || '' };
    }
    return { verified: false };
  },

  /**
   * Parses incoming webhook payload to extract messages
   */
  parseIncomingWebhook: (payload: WhatsAppWebhookPayload): {
    messages: Array<{
      from: string;
      messageId: string;
      content: string;
      timestamp: number;
      type: string;
    }>;
    statuses: Array<{
      messageId: string;
      status: MessageStatus;
      timestamp: number;
      recipientId: string;
      error?: string;
    }>;
  } => {
    const messages: Array<{
      from: string;
      messageId: string;
      content: string;
      timestamp: number;
      type: string;
    }> = [];
    const statuses: Array<{
      messageId: string;
      status: MessageStatus;
      timestamp: number;
      recipientId: string;
      error?: string;
    }> = [];

    if (!payload.entry) return { messages, statuses };

    for (const entry of payload.entry) {
      if (!entry.changes) continue;

      for (const change of entry.changes) {
        const value = change.value;

        // Parse incoming messages
        if (value.messages) {
          for (const msg of value.messages) {
            let content = '';
            
            // Extract text content based on message type
            if (msg.type === 'text' && msg.text) {
              content = msg.text.body;
            } else if (msg.type === 'image' && msg.image) {
              content = msg.image.caption || '[Image]';
            } else if (msg.type === 'video' && msg.video) {
              content = msg.video.caption || '[Video]';
            } else if (msg.type === 'document' && msg.document) {
              content = msg.document.caption || `[Document: ${msg.document.filename || 'file'}]`;
            } else if (msg.type === 'audio' && msg.audio) {
              content = '[Audio]';
            } else {
              content = `[${msg.type}]`;
            }

            messages.push({
              from: msg.from,
              messageId: msg.id,
              content,
              timestamp: parseInt(msg.timestamp) * 1000, // Convert to milliseconds
              type: msg.type,
            });
          }
        }

        // Parse status updates
        if (value.statuses) {
          for (const status of value.statuses) {
            let messageStatus: MessageStatus;
            
            switch (status.status) {
              case 'sent':
                messageStatus = MessageStatus.SENT;
                break;
              case 'delivered':
                messageStatus = MessageStatus.DELIVERED;
                break;
              case 'read':
                messageStatus = MessageStatus.READ;
                break;
              case 'failed':
                messageStatus = MessageStatus.FAILED;
                break;
              default:
                messageStatus = MessageStatus.SENT;
            }

            statuses.push({
              messageId: status.id,
              status: messageStatus,
              timestamp: parseInt(status.timestamp) * 1000,
              recipientId: status.recipient_id,
              error: status.errors?.[0]?.message,
            });
          }
        }
      }
    }

    return { messages, statuses };
  },

  /**
   * Tests WhatsApp API connection by checking phone number info
   */
  testConnection: async (
    phoneNumberId: string,
    accessToken: string
  ): Promise<{ success: boolean; error?: string; phoneNumber?: string }> => {
    try {
      const response = await fetch(
        `${WHATSAPP_API_BASE}/${phoneNumberId}?fields=display_phone_number,verified_name`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || errorData.error?.error_user_msg || '';
        
        if (response.status === 401) {
          return { 
            success: false, 
            error: 'Invalid or expired access token. Generate a new token in Meta for Developers with whatsapp_business_messaging permission.' 
          };
        }
        if (response.status === 403) {
          return { 
            success: false, 
            error: 'Access forbidden. Token missing whatsapp_business_messaging permission. Generate new token with correct permissions.' 
          };
        }
        if (response.status === 404) {
          return { 
            success: false, 
            error: 'Phone Number ID not found. Verify the ID in Meta → WhatsApp → API Setup matches exactly.' 
          };
        }
        
        // Provide more specific error message if available
        let detailedError = errorMessage || `HTTP ${response.status}`;
        if (errorMessage.includes('permission') || errorMessage.includes('Permission')) {
          detailedError += '. Token needs whatsapp_business_messaging permission.';
        } else if (errorMessage.includes('does not exist') || errorMessage.includes('not found')) {
          detailedError += '. Verify Phone Number ID is correct.';
        }
        
        return { success: false, error: detailedError };
      }

      const data = await response.json();
      return { 
        success: true, 
        phoneNumber: data.display_phone_number || phoneNumberId 
      };
    } catch (error: any) {
      console.error('[WhatsAppService] Test connection error:', error);
      return { success: false, error: error.message || 'Network error' };
    }
  },
};

