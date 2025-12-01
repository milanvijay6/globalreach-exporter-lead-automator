import { Importer, Channel, PlatformConnection, OutlookEmailCredentials, WhatsAppCredentials, WeChatCredentials } from '../types';
import { OutlookEmailService, EmailMessage } from './outlookEmailService';
import { WhatsAppService } from './whatsappService';
import { WeChatService } from './wechatService';
import { Logger } from './loggerService';
import { loadEmailConnection, loadPlatformConnections } from './securityService';
import { PlatformService } from './platformService';

export interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  expiryDate?: number;
}

export interface IncomingMessage {
  id: string;
  from: string;
  content: string;
  timestamp: number;
  channel: Channel;
  threadId?: string;
}

export interface IntegrationStatus {
  isConnected: boolean;
  account: string;
  lastSync: number | null;
  healthStatus: 'healthy' | 'error';
  errorMessage?: string;
  tokenExpiry?: number | null;
}

export interface IntegrationService {
  authorize(): Promise<string>; // Returns OAuth URL
  exchangeCode(code: string, state?: string): Promise<TokenResponse>;
  refreshToken(refreshToken: string): Promise<TokenResponse>;
  send(lead: Importer, message: string): Promise<void>;
  pollInbox(): Promise<IncomingMessage[]>;
  getStatus(): Promise<IntegrationStatus>;
  disconnect(): Promise<void>;
}

/**
 * Outlook Integration Service Implementation
 */
class OutlookIntegrationService implements IntegrationService {
  async authorize(): Promise<string> {
    try {
      const clientId = await PlatformService.getAppConfig('outlookClientId', '');
      const tenantId = await PlatformService.getAppConfig('outlookTenantId', 'common');
      // Get actual server port from config
      const serverPort = await PlatformService.getAppConfig('serverPort', 4000);
      // Use Cloudflare Tunnel URL if available, otherwise fallback to localhost
      const cloudflareUrl = await PlatformService.getAppConfig('cloudflareUrl', '');
      const redirectUri = cloudflareUrl 
        ? `${cloudflareUrl}/api/oauth/callback`
        : `http://localhost:${serverPort}/api/oauth/callback`;
      
      if (!clientId) {
        throw new Error('Outlook Client ID not configured. Please configure OAuth credentials in Settings.');
      }
      
      const scopes = encodeURIComponent('https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read https://graph.microsoft.com/offline_access');
      const state = encodeURIComponent(JSON.stringify({ provider: 'outlook', timestamp: Date.now() }));
      
      return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=query&scope=${scopes}&state=${state}`;
    } catch (error: any) {
      Logger.error('[OutlookIntegration] Failed to generate authorize URL:', error);
      throw error;
    }
  }

  async exchangeCode(code: string, state?: string): Promise<TokenResponse> {
    try {
      const { exchangeOutlookCode } = await import('./oauthService');
      const clientId = await PlatformService.getAppConfig('outlookClientId', '');
      const clientSecret = await PlatformService.getAppConfig('outlookClientSecret', '');
      const tenantId = await PlatformService.getAppConfig('outlookTenantId', 'common');
      
      const result = await exchangeOutlookCode(code, {
        clientId,
        clientSecret,
        tenantId: tenantId !== 'common' ? tenantId : undefined,
      });
      
      if (!result.success || !result.tokens) {
        throw new Error(result.error || 'Failed to exchange code');
      }
      
      return {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        expiresIn: result.tokens.expiresIn,
        expiryDate: result.tokens.expiryDate,
      };
    } catch (error: any) {
      Logger.error('[OutlookIntegration] Failed to exchange code:', error);
      throw error;
    }
  }

  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    try {
      const { refreshOutlookToken } = await import('./oauthService');
      const clientId = await PlatformService.getAppConfig('outlookClientId', '');
      const clientSecret = await PlatformService.getAppConfig('outlookClientSecret', '');
      const tenantId = await PlatformService.getAppConfig('outlookTenantId', 'common');
      
      const result = await refreshOutlookToken(refreshToken, {
        clientId,
        clientSecret,
        tenantId: tenantId !== 'common' ? tenantId : undefined,
      });
      
      if (!result.success || !result.tokens) {
        throw new Error(result.error || 'Failed to refresh token');
      }
      
      return {
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        expiresIn: result.tokens.expiresIn,
        expiryDate: result.tokens.expiryDate,
      };
    } catch (error: any) {
      Logger.error('[OutlookIntegration] Failed to refresh token:', error);
      throw error;
    }
  }

  async send(lead: Importer, message: string): Promise<void> {
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        const emailConn = await loadEmailConnection();
        if (!emailConn?.emailCredentials) {
          throw new IntegrationError('Email account not connected', 'NOT_CONNECTED', false);
        }
        
        const emailAddress = lead.email || lead.contactDetail;
        if (!emailAddress || !emailAddress.includes('@')) {
          throw new IntegrationError('Lead does not have a valid email address', 'INVALID_RECIPIENT', false);
        }
        
        const emailMessage: EmailMessage = {
          to: [emailAddress],
          subject: lead.companyName ? `Re: ${lead.companyName} - Inquiry` : 'Re: Your Inquiry',
          body: message,
          bodyType: 'html',
        };
        
        const clientId = await PlatformService.getAppConfig('outlookClientId', '');
        const clientSecret = await PlatformService.getAppConfig('outlookClientSecret', '');
        const tenantId = await PlatformService.getAppConfig('outlookTenantId', 'common');
        
        const result = await OutlookEmailService.sendEmail(
          emailConn.emailCredentials,
          emailMessage,
          clientId || undefined,
          clientSecret || undefined,
          tenantId !== 'common' ? tenantId : undefined
        );
        
        if (!result.success) {
          const error = handleIntegrationError(new Error(result.error || 'Failed to send email'), 'outlook');
          
          // Try to refresh token if expired
          if (error.code === 'TOKEN_EXPIRED' && retryCount === 0) {
            try {
              await this.refreshToken(emailConn.emailCredentials.refreshToken || '');
              retryCount++;
              continue; // Retry with new token
            } catch (refreshError) {
              throw new IntegrationError('Failed to refresh token. Please reconnect your account.', 'REFRESH_FAILED', false);
            }
          }
          
          // Queue for offline sync if retryable
          if (error.retryable && retryCount < maxRetries - 1) {
            const { EmailQueueService } = await import('./emailQueueService');
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
            Logger.warn('[OutlookIntegration] Message queued for retry:', error.message);
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
            continue;
          }
          
          throw error;
        }
        
        // Record analytics
        const { IntegrationAnalyticsService } = await import('./integrationAnalyticsService');
        await IntegrationAnalyticsService.recordMessageSent('outlook');
        return; // Success
      } catch (error: any) {
        if (error instanceof IntegrationError && !error.retryable) {
          throw error; // Don't retry non-retryable errors
        }
        
        if (retryCount >= maxRetries - 1) {
          const handledError = handleIntegrationError(error, 'outlook');
          Logger.error('[OutlookIntegration] Failed to send message after retries:', handledError);
          throw handledError;
        }
        
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
      }
    }
  }

  async pollInbox(): Promise<IncomingMessage[]> {
    try {
      const emailConn = await loadEmailConnection();
      if (!emailConn?.emailCredentials) {
        return [];
      }
      
      const clientId = await PlatformService.getAppConfig('outlookClientId', '');
      const clientSecret = await PlatformService.getAppConfig('outlookClientSecret', '');
      const tenantId = await PlatformService.getAppConfig('outlookTenantId', 'common');
      
      const result = await OutlookEmailService.readEmails(
        emailConn.emailCredentials,
        { limit: 50 },
        clientId || undefined,
        clientSecret || undefined,
        tenantId !== 'common' ? tenantId : undefined
      );
      
      if (!result.success || !result.messages) {
        return [];
      }
      
      return result.messages.map(msg => ({
        id: msg.id,
        from: msg.from.emailAddress.address,
        content: msg.body.content,
        timestamp: new Date(msg.receivedDateTime).getTime(),
        channel: Channel.EMAIL,
        threadId: msg.conversationId,
      }));
    } catch (error: any) {
      Logger.error('[OutlookIntegration] Failed to poll inbox:', error);
      return [];
    }
  }

  async getStatus(): Promise<IntegrationStatus> {
    try {
      const emailConn = await loadEmailConnection();
      const isConnected = emailConn?.status === 'Connected';
      
      return {
        isConnected,
        account: emailConn?.accountName || emailConn?.emailCredentials?.userEmail || '',
        lastSync: emailConn?.lastTested || null,
        healthStatus: emailConn?.healthStatus || 'error',
        tokenExpiry: emailConn?.emailCredentials?.expiryDate || null,
      };
    } catch (error: any) {
      Logger.error('[OutlookIntegration] Failed to get status:', error);
      return {
        isConnected: false,
        account: '',
        lastSync: null,
        healthStatus: 'error',
        errorMessage: error.message,
      };
    }
  }

  async disconnect(): Promise<void> {
    try {
      const { removeEmailConnection, revokeOutlookToken } = await import('./securityService');
      const emailConn = await loadEmailConnection();
      
      if (emailConn?.emailCredentials?.refreshToken) {
        try {
          const clientId = await PlatformService.getAppConfig('outlookClientId', '');
          const clientSecret = await PlatformService.getAppConfig('outlookClientSecret', '');
          const tenantId = await PlatformService.getAppConfig('outlookTenantId', 'common');
          
          await revokeOutlookToken(emailConn.emailCredentials.refreshToken, {
            clientId: clientId || undefined,
            clientSecret: clientSecret || undefined,
            tenantId: tenantId !== 'common' ? tenantId : undefined,
          });
        } catch (revokeError) {
          Logger.warn('[OutlookIntegration] Failed to revoke token (continuing with disconnect):', revokeError);
          // Continue with disconnect even if revoke fails
        }
      }
      
      await removeEmailConnection();
    } catch (error: any) {
      const handledError = handleIntegrationError(error, 'outlook');
      Logger.error('[OutlookIntegration] Failed to disconnect:', handledError);
      throw handledError;
    }
  }
}

/**
 * WhatsApp Integration Service Implementation
 */
class WhatsAppIntegrationService implements IntegrationService {
  async authorize(): Promise<string> {
    // WhatsApp uses Cloud API credentials, not OAuth flow
    // Return a message indicating credentials should be entered in settings
    throw new Error('WhatsApp uses Cloud API credentials. Please configure in Settings → Integrations.');
  }

  async exchangeCode(code: string, state?: string): Promise<TokenResponse> {
    throw new Error('WhatsApp does not use OAuth code exchange. Use Cloud API credentials.');
  }

  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    throw new Error('WhatsApp does not use refresh tokens. Access tokens are long-lived.');
  }

  async send(lead: Importer, message: string): Promise<void> {
    try {
      const connections = await loadPlatformConnections();
      const whatsappConn = connections.find(
        conn => conn.channel === Channel.WHATSAPP && 
        conn.status === 'Connected' && 
        conn.whatsappCredentials
      );
      
      if (!whatsappConn?.whatsappCredentials) {
        throw new Error('WhatsApp account not connected');
      }
      
      const phoneNumber = lead.phone || lead.contactDetail;
      if (!phoneNumber) {
        throw new Error('Lead does not have a valid phone number');
      }
      
      const result = await WhatsAppService.sendTextMessage(
        whatsappConn.whatsappCredentials.phoneNumberId,
        whatsappConn.whatsappCredentials.accessToken,
        phoneNumber,
        message
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to send WhatsApp message');
      }
      
      // Record analytics
      const { IntegrationAnalyticsService } = await import('./integrationAnalyticsService');
      await IntegrationAnalyticsService.recordMessageSent('whatsapp');
    } catch (error: any) {
      Logger.error('[WhatsAppIntegration] Failed to send message:', error);
      throw error;
    }
  }

  async pollInbox(): Promise<IncomingMessage[]> {
    // WhatsApp uses webhooks, not polling
    // This would be handled by webhook handlers in electron/main.js
    return [];
  }

  async getStatus(): Promise<IntegrationStatus> {
    try {
      const connections = await loadPlatformConnections();
      const whatsappConn = connections.find(
        conn => conn.channel === Channel.WHATSAPP && 
        conn.status === 'Connected'
      );
      
      const isConnected = !!whatsappConn;
      
      return {
        isConnected,
        account: whatsappConn?.accountName || '',
        lastSync: whatsappConn?.lastTested || null,
        healthStatus: whatsappConn?.healthStatus || 'error',
      };
    } catch (error: any) {
      Logger.error('[WhatsAppIntegration] Failed to get status:', error);
      return {
        isConnected: false,
        account: '',
        lastSync: null,
        healthStatus: 'error',
        errorMessage: error.message,
      };
    }
  }

  async disconnect(): Promise<void> {
    try {
      const connections = await loadPlatformConnections();
      const whatsappConn = connections.find(
        conn => conn.channel === Channel.WHATSAPP
      );
      
      if (whatsappConn) {
        const { savePlatformConnection } = await import('./securityService');
        await savePlatformConnection({
          ...whatsappConn,
          status: 'Disconnected',
        });
      }
    } catch (error: any) {
      Logger.error('[WhatsAppIntegration] Failed to disconnect:', error);
      throw error;
    }
  }
}

/**
 * WeChat Integration Service Implementation
 */
class WeChatIntegrationService implements IntegrationService {
  async authorize(): Promise<string> {
    // WeChat uses AppID/AppSecret, not OAuth flow
    throw new Error('WeChat uses AppID/AppSecret. Please configure in Settings → Integrations.');
  }

  async exchangeCode(code: string, state?: string): Promise<TokenResponse> {
    throw new Error('WeChat does not use OAuth code exchange. Use AppID/AppSecret.');
  }

  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    try {
      const connections = await loadPlatformConnections();
      const wechatConn = connections.find(
        conn => conn.channel === Channel.WECHAT && 
        conn.wechatCredentials
      );
      
      if (!wechatConn?.wechatCredentials) {
        throw new Error('WeChat account not connected');
      }
      
      const result = await WeChatService.getAccessToken(
        wechatConn.wechatCredentials.appId,
        wechatConn.wechatCredentials.appSecret,
        true
      );
      
      if (!result.success || !result.accessToken) {
        throw new Error(result.error || 'Failed to refresh WeChat token');
      }
      
      return {
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
      };
    } catch (error: any) {
      Logger.error('[WeChatIntegration] Failed to refresh token:', error);
      throw error;
    }
  }

  async send(lead: Importer, message: string): Promise<void> {
    try {
      const connections = await loadPlatformConnections();
      const wechatConn = connections.find(
        conn => conn.channel === Channel.WECHAT && 
        conn.status === 'Connected' && 
        conn.wechatCredentials
      );
      
      if (!wechatConn?.wechatCredentials) {
        throw new Error('WeChat account not connected');
      }
      
      // WeChat requires OpenID, not phone/email
      // This would need to be stored in the lead data
      const wechatId = (lead as any).wechatId;
      if (!wechatId) {
        throw new Error('Lead does not have a WeChat OpenID');
      }
      
      const result = await WeChatService.sendTextMessage(
        wechatConn.wechatCredentials,
        wechatId,
        message
      );
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to send WeChat message');
      }
      
      // Record analytics
      const { IntegrationAnalyticsService } = await import('./integrationAnalyticsService');
      await IntegrationAnalyticsService.recordMessageSent('wechat');
    } catch (error: any) {
      Logger.error('[WeChatIntegration] Failed to send message:', error);
      throw error;
    }
  }

  async pollInbox(): Promise<IncomingMessage[]> {
    // WeChat uses webhooks, not polling
    // This would be handled by webhook handlers in electron/main.js
    return [];
  }

  async getStatus(): Promise<IntegrationStatus> {
    try {
      const connections = await loadPlatformConnections();
      const wechatConn = connections.find(
        conn => conn.channel === Channel.WECHAT && 
        conn.status === 'Connected'
      );
      
      const isConnected = !!wechatConn;
      
      return {
        isConnected,
        account: wechatConn?.accountName || '',
        lastSync: wechatConn?.lastTested || null,
        healthStatus: wechatConn?.healthStatus || 'error',
        tokenExpiry: wechatConn?.wechatCredentials?.accessTokenExpiry || null,
      };
    } catch (error: any) {
      Logger.error('[WeChatIntegration] Failed to get status:', error);
      return {
        isConnected: false,
        account: '',
        lastSync: null,
        healthStatus: 'error',
        errorMessage: error.message,
      };
    }
  }

  async disconnect(): Promise<void> {
    try {
      const connections = await loadPlatformConnections();
      const wechatConn = connections.find(
        conn => conn.channel === Channel.WECHAT
      );
      
      if (wechatConn) {
        const { savePlatformConnection } = await import('./securityService');
        await savePlatformConnection({
          ...wechatConn,
          status: 'Disconnected',
        });
      }
    } catch (error: any) {
      Logger.error('[WeChatIntegration] Failed to disconnect:', error);
      throw error;
    }
  }
}

/**
 * Unified Integration Service Factory
 */
export const IntegrationServiceFactory = {
  getService: (service: 'outlook' | 'whatsapp' | 'wechat'): IntegrationService => {
    switch (service) {
      case 'outlook':
        return new OutlookIntegrationService();
      case 'whatsapp':
        return new WhatsAppIntegrationService();
      case 'wechat':
        return new WeChatIntegrationService();
      default:
        throw new Error(`Unknown service: ${service}`);
    }
  },
};

