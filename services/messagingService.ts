
import { Channel, MessageStatus, PlatformConnection } from '../types';
import { WhatsAppService } from './whatsappService';
// EmailService is imported dynamically to avoid bundling Node.js modules
// import { EmailService } from './emailService';
import { WeChatService } from './wechatService';
import { loadPlatformConnections } from './securityService';

// Types for the internal mock event system
type IncomingHandler = (importerId: string | null, contactDetail: string, content: string, channel: Channel) => void;
type StatusUpdateHandler = (messageId: string, status: MessageStatus) => void;
type TypingHandler = (importerId: string, isTyping: boolean) => void;

let incomingListener: IncomingHandler | null = null;
let statusListener: StatusUpdateHandler | null = null;
let typingListener: TypingHandler | null = null;

// Cache for platform connections to avoid repeated async calls
let cachedConnections: PlatformConnection[] | null = null;

// Fallback tracking
let fallbackMessageCount = 0;
let lastFallbackTime = 0;
let lastFallbackActivation = 0;
const FALLBACK_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const MAX_FALLBACK_MESSAGES = 10;

const getWhatsAppConnection = async (): Promise<PlatformConnection | null> => {
  if (!cachedConnections) {
    cachedConnections = await loadPlatformConnections();
  }
  return cachedConnections.find(
    conn => conn.channel === Channel.WHATSAPP && 
    conn.status === 'Connected' && 
    conn.whatsappCredentials
  ) || null;
};

const getWeChatConnection = async (): Promise<PlatformConnection | null> => {
  if (!cachedConnections) {
    cachedConnections = await loadPlatformConnections();
  }
  return cachedConnections.find(
    conn => conn.channel === Channel.WECHAT && 
    conn.status === 'Connected' && 
    conn.wechatCredentials
  ) || null;
};

export const MessagingService = {
  /**
   * Sends a message through the appropriate provider API.
   * Uses real WhatsApp Cloud API when credentials are available, otherwise falls back to WhatsApp Web or simulates.
   */
  sendMessage: async (
    messageId: string, 
    to: string, 
    content: string, 
    channel: Channel
  ): Promise<{ success: boolean; error?: string }> => {
    
    console.log(`[MessagingService] Outgoing via ${channel} to ${to}:`, content.substring(0, 20) + '...');

    // Use real WhatsApp API if connected
    if (channel === Channel.WHATSAPP) {
      const whatsappConn = await getWhatsAppConnection();
      
      if (whatsappConn?.whatsappCredentials) {
        const { phoneNumberId, accessToken } = whatsappConn.whatsappCredentials;
        
        // Notify SENT status immediately
        if (statusListener) statusListener(messageId, MessageStatus.SENT);
        
        const result = await WhatsAppService.sendTextMessage(
          phoneNumberId,
          accessToken,
          to,
          content
        );
        
        if (result.success) {
          // Reset fallback count on successful Cloud API call
          fallbackMessageCount = 0;
          return { success: true };
        }
        
        // Check if we should fallback to WhatsApp Web
        const shouldFallback = shouldFallbackToWeb(result.error);
        
        if (shouldFallback && canUseFallback()) {
          console.log('[MessagingService] Falling back to WhatsApp Web');
          return await fallbackToWhatsAppWeb(messageId, to, content);
        }
        
        // Update status to FAILED on error
        if (statusListener) statusListener(messageId, MessageStatus.FAILED);
        return result;
      } else {
        // No Cloud API connection, check if WhatsApp Web is enabled
        const { PlatformService } = await import('./platformService');
        const config = await PlatformService.getAppConfig('whatsapp', { method: 'cloud_api' });
        
        if (config?.method === 'web' || config?.web?.enabled === true) {
          console.log('[MessagingService] Using WhatsApp Web (no Cloud API connection)');
          return await fallbackToWhatsAppWeb(messageId, to, content);
        }
        
        console.warn('[MessagingService] WhatsApp not connected, falling back to simulation');
        // Fall through to simulation
      }
    }

    // Use real WeChat API if connected
    if (channel === Channel.WECHAT) {
      const wechatConn = await getWeChatConnection();
      
      if (wechatConn?.wechatCredentials) {
        // Notify SENT status immediately
        if (statusListener) statusListener(messageId, MessageStatus.SENT);
        
        // 'to' should be OpenID for WeChat
        const result = await WeChatService.sendTextMessage(
          wechatConn.wechatCredentials,
          to, // OpenID
          content
        );
        
        if (!result.success) {
          // Update status to FAILED on error
          if (statusListener) statusListener(messageId, MessageStatus.FAILED);
          return { success: false, error: MessagingService.handleWeChatError(result.error) };
        }
        
        // WeChat doesn't provide real-time delivery/read status via API
        // Status updates will come via webhook if available
        setTimeout(() => {
          if (statusListener) statusListener(messageId, MessageStatus.DELIVERED);
        }, 1000);
        
        return { success: true };
      } else {
        console.warn('[MessagingService] WeChat not connected, falling back to simulation');
        // Fall through to simulation
      }
    }

    // Use real Email API if connected
    if (channel === Channel.EMAIL) {
      const { EmailIPCService } = await import('./emailIPCService');
      const emailConn = await EmailIPCService.getEmailConnection();
      
      if (emailConn?.emailCredentials) {
        // Notify SENT status immediately
        if (statusListener) statusListener(messageId, MessageStatus.SENT);
        
        const { EmailSendingService } = await import('./emailSendingService');
        const { EmailAnalyticsService } = await import('./emailAnalyticsService');
        const { EmailComplianceService } = await import('./emailComplianceService');
        
        // Check compliance
        const complianceCheck = await EmailComplianceService.validateBeforeSend(to);
        if (!complianceCheck.valid) {
          if (statusListener) statusListener(messageId, MessageStatus.FAILED);
          return { success: false, error: complianceCheck.errors.join('; ') };
        }
        
        // Find importer for personalization
        const { loadPlatformConnections } = await import('./securityService');
        // Note: Would need importer data - for now use basic template
        const result = await EmailSendingService.sendEmail(
          { contactDetail: to } as any, // Simplified
          content,
          { introTemplate: content, agentSystemInstruction: '' },
          { subject: 'Message from Global Exports', useHTML: true }
        );
        
        if (result.success) {
          // Log send
          EmailAnalyticsService.logAction({
            id: messageId,
            messageId: result.messageId,
            to,
            subject: 'Message from Global Exports',
            action: 'sent',
            timestamp: Date.now(),
          });
          
          // Record for rate limiting
          await EmailComplianceService.recordSend(to);
          
          // Simulate delivery (email providers don't give real-time delivery status)
          setTimeout(() => {
            if (statusListener) statusListener(messageId, MessageStatus.DELIVERED);
          }, 2000);
        } else {
          if (statusListener) statusListener(messageId, MessageStatus.FAILED);
        }
        
        return result;
      } else {
        console.warn('[MessagingService] Email not connected, falling back to simulation');
        // Fall through to simulation
      }
    }

    // Simulation for Email, SMS, or WhatsApp without credentials
    // 1. Simulate Network Latency based on Channel
    const latency = channel === Channel.EMAIL ? 1500 : 600; // Email is slower than IM
    await new Promise(resolve => setTimeout(resolve, latency));

    // 2. Simulate Protocol Handshake & "Sent" status
    if (Math.random() > 0.98) {
      // 2% simulated failure rate
      return { success: false, error: 'Gateway Timeout' };
    }

    // Notify app that message left the server (SENT)
    if (statusListener) statusListener(messageId, MessageStatus.SENT);

    // 3. Simulate Delivery Receipt (Async)
    // WhatsApp/WeChat usually show 'Delivered' quickly. Email takes longer to 'Open'.
    const deliveryDelay = channel === Channel.EMAIL ? 3000 : 1000;
    
    setTimeout(() => {
      if (statusListener) statusListener(messageId, MessageStatus.DELIVERED);
      
      // 4. Simulate Read Receipt (Randomly)
      if (Math.random() > 0.3) {
         setTimeout(() => {
             if (statusListener) statusListener(messageId, MessageStatus.READ);
         }, 2000 + Math.random() * 4000);
      }
    }, deliveryDelay);

    return { success: true };
  },

  /**
   * Updates the cached platform connections (call this when connections change)
   */
  refreshConnections: async () => {
    cachedConnections = await loadPlatformConnections();
  },

  /**
   * Handles WhatsApp API errors with user-friendly messages
   */
  handleWhatsAppError: (error: any): string => {
    if (error.message?.includes('Rate limit')) {
      return 'Rate limit exceeded. Please wait before sending more messages.';
    }
    if (error.message?.includes('Invalid access token') || error.message?.includes('401')) {
      return 'Invalid WhatsApp API credentials. Please check your Access Token in Settings.';
    }
    if (error.message?.includes('Phone number') || error.message?.includes('404')) {
      return 'Phone Number ID not found. Please verify your WhatsApp Business account setup.';
    }
    if (error.message?.includes('Network')) {
      return 'Network error. Please check your internet connection.';
    }
    return error.message || 'Failed to send message. Please try again.';
  },

  /**
   * Handles WeChat API errors with user-friendly messages
   */
  handleWeChatError: (error: any): string => {
    if (typeof error === 'string') {
      if (error.includes('quota exceeded') || error.includes('45009')) {
        return 'WeChat API quota exceeded. Daily limit: 2000 calls. Please try again tomorrow.';
      }
      if (error.includes('Invalid credential') || error.includes('40001')) {
        return 'Invalid WeChat credentials. Please check your AppID and AppSecret in Settings.';
      }
      if (error.includes('Invalid access_token') || error.includes('40014')) {
        return 'WeChat access token expired. Please reconnect your WeChat account.';
      }
      if (error.includes('Network')) {
        return 'Network error. Please check your internet connection.';
      }
      return error || 'Failed to send message. Please try again.';
    }
    return error?.message || 'Failed to send message. Please try again.';
  },

  /**
   * Register a callback for when new messages arrive via Webhook/Socket
   */
  onIncomingMessage: (handler: IncomingHandler) => {
    incomingListener = handler;
  },

  /**
   * Register a callback for message status updates (Sent/Delivered/Read)
   */
  onMessageStatusUpdate: (handler: StatusUpdateHandler) => {
    statusListener = handler;
  },

  /**
   * Register a callback for typing indicators
   */
  onTypingStatus: (handler: TypingHandler) => {
    typingListener = handler;
  },

  /**
   * Internal helper to trigger a mock incoming message.
   * Used by the AI Simulator to inject replies.
   */
  receiveMockReply: (importerId: string, content: string, channel: Channel) => {
    // 1. Simulate "Typing Started"
    if (typingListener) typingListener(importerId, true);

    // Calculate a realistic typing duration based on length
    const typingDuration = Math.min(1000 + content.length * 30, 4000);

    setTimeout(() => {
        // 2. Simulate "Typing Stopped"
        if (typingListener) typingListener(importerId, false);

        // 3. Deliver Message
        if (incomingListener) {
            // For mock purposes we pass importerId directly
            incomingListener(importerId, 'unknown-contact', content, channel);
        }
    }, typingDuration);
  },

  /**
   * Process incoming WhatsApp webhook payload and trigger callbacks
   */
  processWebhookPayload: (payload: any) => {
    const parsed = WhatsAppService.parseIncomingWebhook(payload);
    
    // Process incoming messages
    for (const msg of parsed.messages) {
      if (incomingListener) {
        // Find importer by phone number (format: remove + and spaces)
        const phoneNumber = msg.from.replace(/[\s+\-()]/g, '');
        incomingListener(null, phoneNumber, msg.content, Channel.WHATSAPP);
      }
    }
    
    // Process status updates
    for (const status of parsed.statuses) {
      if (statusListener) {
        statusListener(status.messageId, status.status);
      }
    }
  },

  /**
   * Process incoming WeChat webhook payload and trigger callbacks
   */
  processWeChatWebhook: (xmlPayload: string) => {
    const message = WeChatService.parseXMLMessage(xmlPayload);
    
    if (!message) {
      console.warn('[MessagingService] Failed to parse WeChat message');
      return;
    }

    // Extract content based on message type
    let content = '';
    if (message.MsgType === 'text') {
      content = (message as any).Content || '';
    } else if (message.MsgType === 'image') {
      content = '[Image]';
    } else if (message.MsgType === 'voice') {
      content = (message as any).Recognition || '[Voice]';
    } else if (message.MsgType === 'video') {
      content = '[Video]';
    } else if (message.MsgType === 'event') {
      const event = message as any;
      if (event.Event === 'subscribe') {
        content = '[User subscribed]';
      } else if (event.Event === 'unsubscribe') {
        content = '[User unsubscribed]';
      } else {
        content = `[Event: ${event.Event}]`;
      }
    } else {
      content = `[${message.MsgType}]`;
    }

    // Trigger incoming message callback
    if (incomingListener && content) {
      // Use FromUserName (OpenID) as contact identifier
      incomingListener(null, message.FromUserName, content, Channel.WECHAT);
    }
  },

  /**
   * Reset fallback tracking (for testing)
   */
  resetFallbackTracking: (): void => {
    fallbackMessageCount = 0;
    lastFallbackTime = 0;
    lastFallbackActivation = 0;
  },
};

/**
 * Check if error should trigger fallback to WhatsApp Web
 */
function shouldFallbackToWeb(error?: string): boolean {
  if (!error) return false;
  
  const errorLower = error.toLowerCase();
  
  // Only fallback on specific errors
  const fallbackErrors = [
    '401', // Unauthorized
    '404', // Not found
    '503', // Service unavailable
    'network',
    'timeout',
    'connection',
  ];
  
  // Never fallback on rate limit errors (429)
  if (errorLower.includes('429') || errorLower.includes('rate limit')) {
    return false;
  }
  
  return fallbackErrors.some(err => errorLower.includes(err));
}

/**
 * Check if fallback can be used (cooldown and message limits)
 */
function canUseFallback(): boolean {
  const now = Date.now();
  
  // Check cooldown
  if (now - lastFallbackActivation < FALLBACK_COOLDOWN_MS) {
    return false;
  }
  
  // Check message limit
  if (fallbackMessageCount >= MAX_FALLBACK_MESSAGES) {
    return false;
  }
  
  return true;
}

/**
 * Fallback to WhatsApp Web
 */
async function fallbackToWhatsAppWeb(
  messageId: string,
  to: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if WhatsApp Web service is available
    const { WhatsAppWebService } = await import('./whatsappWebService');
    
    // Check rate limiter
    const { WhatsAppWebRateLimiter } = await import('./whatsappWebRateLimiter');
    const rateLimiter = WhatsAppWebRateLimiter.getInstance();
    const rateCheck = await rateLimiter.canSend(to);
    
    if (!rateCheck.allowed) {
      return {
        success: false,
        error: `WhatsApp Web rate limit: ${rateCheck.reason}`,
      };
    }
    
    // Check content uniqueness
    const { WhatsAppWebContentChecker } = await import('./whatsappWebContentChecker');
    const contentChecker = WhatsAppWebContentChecker.getInstance();
    const contentCheck = contentChecker.checkContent(content);
    
    if (!contentCheck.valid) {
      return {
        success: false,
        error: `Content check failed: ${contentCheck.reasons.join(', ')}`,
      };
    }
    
    // Send via WhatsApp Web
    const result = await WhatsAppWebService.sendMessage(to, content);
    
    if (result.success) {
      // Record in rate limiter
      await rateLimiter.recordSend(to);
      
      // Record in content checker
      contentChecker.recordMessage(content);
      
      // Update fallback tracking
      fallbackMessageCount++;
      lastFallbackTime = Date.now();
      lastFallbackActivation = Date.now();
      
      // Notify status
      if (statusListener) statusListener(messageId, MessageStatus.SENT);
    }
    
    return result;
  } catch (error: any) {
    console.error('[MessagingService] WhatsApp Web fallback failed:', error);
    return {
      success: false,
      error: error.message || 'WhatsApp Web fallback failed',
    };
  }
}
