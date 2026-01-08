
import { Channel, MessageStatus, PlatformConnection, Importer } from '../types';
import { WhatsAppService } from './whatsappService';
import { WeChatService } from './wechatService';
import { loadPlatformConnections, loadEmailConnection } from './securityService';
import { OutlookEmailService } from './outlookEmailService';
import { EmailQueueService } from './emailQueueService';
import { Logger } from './loggerService';

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

const getEmailConnection = async (): Promise<PlatformConnection | null> => {
  return await loadEmailConnection();
};

export const MessagingService = {
  /**
   * Sends a message through the appropriate provider API.
   * Uses real WhatsApp Cloud API when credentials are available, otherwise falls back to WhatsApp Web or simulates.
   * For email, uses Outlook OAuth 2.0 via Microsoft Graph API.
   */
  sendMessage: async (
    messageId: string, 
    to: string, 
    content: string, 
    channel: Channel,
    importer?: Importer,
    useQueue: boolean = true // Enable queue by default
  ): Promise<{ success: boolean; error?: string; queued?: boolean }> => {
    
    console.log(`[MessagingService] Outgoing via ${channel} to ${to}:`, content.substring(0, 20) + '...');

    // Use queue system if enabled and available
    if (useQueue && process.env.ENABLE_MESSAGE_QUEUE !== 'false') {
      try {
        // Dynamic import to avoid circular dependencies
        const queueWrapper = await import('../server/utils/queueWrapper');
        const queueType = channel === Channel.WHATSAPP ? 'whatsapp' : 
                         channel === Channel.EMAIL ? 'email' : 'whatsapp';
        
        const queueResult = await queueWrapper.queueMessage(queueType, {
          messageId,
          to,
          content,
          channel,
          importer,
        }, {
          priority: 'normal',
        });

        if (queueResult.success && queueResult.queued) {
          // Notify SENT status immediately (message is queued)
          if (statusListener) statusListener(messageId, MessageStatus.SENT);
          return { success: true, queued: true };
        }
        // If queue failed, fall through to direct send
      } catch (error) {
        console.warn('[MessagingService] Queue system not available, using direct send:', error);
        // Fall through to direct send
      }
    }

    // Direct send (fallback or if queue disabled)
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
        
        // Queue message for background sync if network error
        if (result.error && (result.error.includes('network') || result.error.includes('fetch'))) {
          try {
            const { queueMessage } = await import('./backgroundSyncService');
            await queueMessage({
              messageId,
              to,
              content,
              channel: channel.toString(),
              importerId: importer?.id,
            });
            console.log('[MessagingService] Message queued for background sync');
            return { success: false, error: result.error, queued: true };
          } catch (queueError) {
            console.warn('[MessagingService] Failed to queue message:', queueError);
          }
        }
        
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
      const emailConn = await getEmailConnection();
      
      if (emailConn?.emailCredentials) {
        // Notify SENT status immediately
        if (statusListener) statusListener(messageId, MessageStatus.SENT);
        
        try {
          // Get OAuth config for token refresh if needed
          const { PlatformService } = await import('./platformService');
          const clientId = await PlatformService.getAppConfig('outlookClientId', '');
          const clientSecret = await PlatformService.getAppConfig('outlookClientSecret', '');
          const tenantId = await PlatformService.getAppConfig('outlookTenantId', 'common');
          
          // Prepare email message
          const emailMessage: import('./outlookEmailService').EmailMessage = {
            to: [to],
            subject: importer?.companyName 
              ? `Re: ${importer.companyName} - Inquiry`
              : 'Re: Your Inquiry',
            body: content,
            bodyType: 'html',
          };
          
          // Try to send email
          const result = await OutlookEmailService.sendEmail(
            emailConn.emailCredentials,
            emailMessage,
            clientId || undefined,
            clientSecret || undefined,
            tenantId !== 'common' ? tenantId : undefined
          );
          
          if (result.success) {
            // Update status to DELIVERED
            setTimeout(() => {
              if (statusListener) statusListener(messageId, MessageStatus.DELIVERED);
            }, 1000);
            return { success: true };
          } else {
            // Queue for retry if it's a retryable error
            if (result.error && !result.error.includes('401') && !result.error.includes('403')) {
              Logger.warn('[MessagingService] Email send failed, queuing for retry:', result.error);
              EmailQueueService.enqueue(
                emailMessage,
                emailConn.emailCredentials,
                {
                  clientId: clientId || undefined,
                  clientSecret: clientSecret || undefined,
                  tenantId: tenantId !== 'common' ? tenantId : undefined,
                  priority: 'normal',
                }
              );
            }
            
            // Update status to FAILED
            if (statusListener) statusListener(messageId, MessageStatus.FAILED);
            return { success: false, error: MessagingService.handleEmailError(result.error) };
          }
        } catch (error: any) {
          Logger.error('[MessagingService] Email send exception:', error);
          if (statusListener) statusListener(messageId, MessageStatus.FAILED);
          return { success: false, error: MessagingService.handleEmailError(error.message) };
        }
      } else {
        console.warn('[MessagingService] Email not connected, cannot send email');
        return { success: false, error: 'Email account not connected. Please connect your Outlook account in Settings → Integrations.' };
      }
    }

    // Simulation for SMS or WhatsApp without credentials
    // 1. Simulate Network Latency based on Channel
    const latency = 600;
    await new Promise(resolve => setTimeout(resolve, latency));

    // 2. Simulate Protocol Handshake & "Sent" status
    if (Math.random() > 0.98) {
      // 2% simulated failure rate
      return { success: false, error: 'Gateway Timeout' };
    }

    // Notify app that message left the server (SENT)
    if (statusListener) statusListener(messageId, MessageStatus.SENT);

    // 3. Simulate Delivery Receipt (Async)
    // WhatsApp/WeChat usually show 'Delivered' quickly.
    const deliveryDelay = 1000;
    
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
   * Handles Email API errors with user-friendly messages
   */
  handleEmailError: (error?: string): string => {
    if (!error) return 'Failed to send email. Please try again.';
    
    const errorLower = error.toLowerCase();
    
    if (errorLower.includes('401') || errorLower.includes('unauthorized') || errorLower.includes('invalid token')) {
      return 'Email access token expired. Please reconnect your Outlook account in Settings → Integrations.';
    }
    if (errorLower.includes('403') || errorLower.includes('forbidden')) {
      return 'Email permission denied. Please check your Outlook account permissions.';
    }
    if (errorLower.includes('429') || errorLower.includes('rate limit')) {
      return 'Email rate limit exceeded. Please wait before sending more emails.';
    }
    if (errorLower.includes('network') || errorLower.includes('timeout') || errorLower.includes('connection')) {
      return 'Network error. Please check your internet connection.';
    }
    if (errorLower.includes('invalid recipient') || errorLower.includes('invalid email')) {
      return 'Invalid email address. Please check the recipient email.';
    }
    
    return error || 'Failed to send email. Please try again.';
  },

  /**
   * Determines the best contact channel based on importer data and priority
   * Returns the channel to use, or null if no valid contact method
   * 
   * Priority Order (as per spec):
   * 1. phone && primary_channel="whatsapp" → WhatsApp (priority 1)
   * 2. wechatId && primary_channel="wechat" → WeChat (priority 2)
   * 3. email → Outlook/Email (priority 3)
   */
  determineContactChannel: (importer: Importer): { channel: Channel; contact: string } | null => {
    const phone = importer.phone || (importer.contactDetail && /^\+?[\d\s\-()]+$/.test(importer.contactDetail) ? importer.contactDetail : null);
    const email = importer.email || (importer.contactDetail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(importer.contactDetail) ? importer.contactDetail : null);
    const wechatId = (importer as any).wechatId;
    
    const primaryContact = importer.primaryContact;
    
    // Priority 1: phone && primary_channel="whatsapp" → WhatsApp
    if (phone && (primaryContact === 'phone' || primaryContact === 'whatsapp')) {
      return { channel: Channel.WHATSAPP, contact: phone };
    }
    
    // Priority 2: wechatId && primary_channel="wechat" → WeChat
    if (wechatId && primaryContact === 'wechat') {
      return { channel: Channel.WECHAT, contact: wechatId };
    }
    
    // Priority 3: email → Outlook/Email
    if (email) {
      return { channel: Channel.EMAIL, contact: email };
    }
    
    // No valid contact method
    return null;
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
