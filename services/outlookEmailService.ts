import { OutlookEmailCredentials } from '../types';
import { Logger } from './loggerService';

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';
const RATE_LIMIT_EMAILS_PER_HOUR = 50;

export interface EmailMessage {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  bodyType?: 'text' | 'html';
  attachments?: EmailAttachment[];
  inReplyTo?: string; // For threading
  references?: string; // For threading
}

export interface EmailAttachment {
  name: string;
  contentBytes: string; // Base64 encoded
  contentType: string;
  size: number;
}

export interface EmailReadResult {
  id: string;
  subject: string;
  from: { emailAddress: { address: string; name?: string } };
  toRecipients: Array<{ emailAddress: { address: string; name?: string } }>;
  body: { content: string; contentType: string };
  receivedDateTime: string;
  isRead: boolean;
  conversationId?: string;
  internetMessageId?: string;
  inReplyTo?: string;
  attachments?: EmailAttachment[];
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface ReadEmailsResult {
  success: boolean;
  messages?: EmailReadResult[];
  error?: string;
}

/**
 * Outlook Email Service
 * Handles all Microsoft Graph API email operations
 */
export const OutlookEmailService = {
  /**
   * Refreshes access token using refresh token
   */
  refreshAccessToken: async (
    credentials: OutlookEmailCredentials,
    clientId: string,
    clientSecret: string,
    tenantId: string = 'common'
  ): Promise<OutlookEmailCredentials> => {
    try {
      if (!credentials.refreshToken) {
        throw new Error('No refresh token available');
      }

      const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: credentials.refreshToken,
          grant_type: 'refresh_token',
          scope: 'https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read offline_access',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error_description || `Token refresh failed: ${response.status}`);
      }

      const data = await response.json();
      
      const newCredentials: OutlookEmailCredentials = {
        ...credentials,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || credentials.refreshToken, // Keep old refresh token if new one not provided
        expiryDate: data.expires_in ? Date.now() + (data.expires_in * 1000) : credentials.expiryDate,
      };

      Logger.info('[OutlookEmailService] Token refreshed successfully');
      return newCredentials;
    } catch (error: any) {
      Logger.error('[OutlookEmailService] Token refresh failed:', error);
      throw error;
    }
  },

  /**
   * Checks if token needs refresh (expires in < 5 minutes)
   */
  needsTokenRefresh: (credentials: OutlookEmailCredentials): boolean => {
    if (!credentials.expiryDate) return true;
    const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes
    return (credentials.expiryDate - Date.now()) < REFRESH_BUFFER_MS;
  },

  /**
   * Sends an email via Microsoft Graph API
   */
  sendEmail: async (
    credentials: OutlookEmailCredentials,
    message: EmailMessage,
    clientId?: string,
    clientSecret?: string,
    tenantId?: string
  ): Promise<SendEmailResult> => {
    try {
      // Check if token needs refresh
      let currentCredentials = credentials;
      if (clientId && clientSecret && OutlookEmailService.needsTokenRefresh(credentials)) {
        try {
          currentCredentials = await OutlookEmailService.refreshAccessToken(
            credentials,
            clientId,
            clientSecret,
            tenantId || credentials.tenantId || 'common'
          );
        } catch (refreshError) {
          Logger.warn('[OutlookEmailService] Token refresh failed, using existing token:', refreshError);
        }
      }

      const messagePayload: any = {
        message: {
          subject: message.subject,
          body: {
            contentType: message.bodyType || 'html',
            content: message.body,
          },
          toRecipients: message.to.map(email => ({
            emailAddress: { address: email },
          })),
        },
        saveToSentItems: true,
      };

      // Add CC if provided
      if (message.cc && message.cc.length > 0) {
        messagePayload.message.ccRecipients = message.cc.map(email => ({
          emailAddress: { address: email },
        }));
      }

      // Add BCC if provided
      if (message.bcc && message.bcc.length > 0) {
        messagePayload.message.bccRecipients = message.bcc.map(email => ({
          emailAddress: { address: email },
        }));
      }

      // Add threading headers if replying
      if (message.inReplyTo) {
        messagePayload.message.internetMessageHeaders = [
          {
            name: 'In-Reply-To',
            value: message.inReplyTo,
          },
        ];
        if (message.references) {
          messagePayload.message.internetMessageHeaders.push({
            name: 'References',
            value: message.references,
          });
        }
      }

      // Handle attachments if provided
      if (message.attachments && message.attachments.length > 0) {
        // For attachments, we need to use a two-step process:
        // 1. Create draft message
        // 2. Add attachments to draft
        // 3. Send draft
        // For now, we'll send without attachments and log a warning
        Logger.warn('[OutlookEmailService] Attachments not yet implemented, sending without attachments');
      }

      const response = await fetch(`${GRAPH_API_BASE}/me/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentCredentials.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messagePayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
        
        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          throw new Error(`Rate limit exceeded. Retry after ${retryAfter || '60'} seconds`);
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Actually send the message
      const sendResponse = await fetch(`${GRAPH_API_BASE}/me/messages/${data.id}/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentCredentials.accessToken}`,
        },
      });

      if (!sendResponse.ok) {
        const errorData = await sendResponse.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to send message');
      }

      Logger.info('[OutlookEmailService] Email sent successfully', { to: message.to, subject: message.subject });
      
      return {
        success: true,
        messageId: data.id,
      };
    } catch (error: any) {
      Logger.error('[OutlookEmailService] Send email failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to send email',
      };
    }
  },

  /**
   * Reads emails from inbox with filtering
   */
  readEmails: async (
    credentials: OutlookEmailCredentials,
    options?: {
      maxResults?: number;
      filter?: string; // OData filter query
      folder?: string; // 'inbox', 'sentitems', etc.
      unreadOnly?: boolean;
    }
  ): Promise<ReadEmailsResult> => {
    try {
      // Check if token needs refresh
      if (OutlookEmailService.needsTokenRefresh(credentials)) {
        Logger.warn('[OutlookEmailService] Token may need refresh, but refresh credentials not provided');
      }

      const maxResults = options?.maxResults || 10;
      const folder = options?.folder || 'inbox';
      let filter = options?.filter || '';
      
      if (options?.unreadOnly) {
        filter = filter ? `${filter} and isRead eq false` : 'isRead eq false';
      }

      let url = `${GRAPH_API_BASE}/me/mailFolders/${folder}/messages?$top=${maxResults}&$orderby=receivedDateTime desc`;
      
      if (filter) {
        url += `&$filter=${encodeURIComponent(filter)}`;
      }

      // Select specific fields to reduce payload size
      url += '&$select=id,subject,from,toRecipients,body,receivedDateTime,isRead,conversationId,internetMessageId,inReplyTo,hasAttachments';

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const messages: EmailReadResult[] = (data.value || []).map((msg: any) => ({
        id: msg.id,
        subject: msg.subject || '(No Subject)',
        from: msg.from || { emailAddress: { address: 'unknown' } },
        toRecipients: msg.toRecipients || [],
        body: msg.body || { content: '', contentType: 'text' },
        receivedDateTime: msg.receivedDateTime,
        isRead: msg.isRead || false,
        conversationId: msg.conversationId,
        internetMessageId: msg.internetMessageId,
        inReplyTo: msg.inReplyTo,
      }));

      Logger.info('[OutlookEmailService] Read emails successfully', { count: messages.length });
      
      return {
        success: true,
        messages,
      };
    } catch (error: any) {
      Logger.error('[OutlookEmailService] Read emails failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to read emails',
      };
    }
  },

  /**
   * Gets a specific email by ID
   */
  getEmail: async (
    credentials: OutlookEmailCredentials,
    messageId: string
  ): Promise<{ success: boolean; message?: EmailReadResult; error?: string }> => {
    try {
      const response = await fetch(`${GRAPH_API_BASE}/me/messages/${messageId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const msg = await response.json();
      
      return {
        success: true,
        message: {
          id: msg.id,
          subject: msg.subject || '(No Subject)',
          from: msg.from || { emailAddress: { address: 'unknown' } },
          toRecipients: msg.toRecipients || [],
          body: msg.body || { content: '', contentType: 'text' },
          receivedDateTime: msg.receivedDateTime,
          isRead: msg.isRead || false,
          conversationId: msg.conversationId,
          internetMessageId: msg.internetMessageId,
          inReplyTo: msg.inReplyTo,
        },
      };
    } catch (error: any) {
      Logger.error('[OutlookEmailService] Get email failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to get email',
      };
    }
  },

  /**
   * Gets email thread (conversation)
   */
  getEmailThread: async (
    credentials: OutlookEmailCredentials,
    conversationId: string
  ): Promise<{ success: boolean; messages?: EmailReadResult[]; error?: string }> => {
    try {
      const response = await fetch(
        `${GRAPH_API_BASE}/me/messages?$filter=conversationId eq '${conversationId}'&$orderby=receivedDateTime asc`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${credentials.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const messages: EmailReadResult[] = (data.value || []).map((msg: any) => ({
        id: msg.id,
        subject: msg.subject || '(No Subject)',
        from: msg.from || { emailAddress: { address: 'unknown' } },
        toRecipients: msg.toRecipients || [],
        body: msg.body || { content: '', contentType: 'text' },
        receivedDateTime: msg.receivedDateTime,
        isRead: msg.isRead || false,
        conversationId: msg.conversationId,
        internetMessageId: msg.internetMessageId,
        inReplyTo: msg.inReplyTo,
      }));

      return {
        success: true,
        messages,
      };
    } catch (error: any) {
      Logger.error('[OutlookEmailService] Get email thread failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to get email thread',
      };
    }
  },

  /**
   * Replies to an email with threading support
   */
  replyToEmail: async (
    credentials: OutlookEmailCredentials,
    messageId: string,
    replyBody: string,
    replyBodyType: 'text' | 'html' = 'html',
    clientId?: string,
    clientSecret?: string,
    tenantId?: string
  ): Promise<SendEmailResult> => {
    try {
      // Get original message for threading
      const originalEmail = await OutlookEmailService.getEmail(credentials, messageId);
      if (!originalEmail.success || !originalEmail.message) {
        throw new Error('Failed to get original email for reply');
      }

      // Check if token needs refresh
      let currentCredentials = credentials;
      if (clientId && clientSecret && OutlookEmailService.needsTokenRefresh(credentials)) {
        try {
          currentCredentials = await OutlookEmailService.refreshAccessToken(
            credentials,
            clientId,
            clientSecret,
            tenantId || credentials.tenantId || 'common'
          );
        } catch (refreshError) {
          Logger.warn('[OutlookEmailService] Token refresh failed, using existing token:', refreshError);
        }
      }

      const replyPayload = {
        message: {
          body: {
            contentType: replyBodyType,
            content: replyBody,
          },
        },
        comment: replyBody,
      };

      const response = await fetch(`${GRAPH_API_BASE}/me/messages/${messageId}/reply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentCredentials.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(replyPayload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
        throw new Error(errorMessage);
      }

      Logger.info('[OutlookEmailService] Reply sent successfully', { messageId });
      
      return {
        success: true,
        messageId,
      };
    } catch (error: any) {
      Logger.error('[OutlookEmailService] Reply failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to send reply',
      };
    }
  },

  /**
   * Gets user profile information
   */
  getUserProfile: async (
    credentials: OutlookEmailCredentials
  ): Promise<{ success: boolean; email?: string; name?: string; error?: string }> => {
    try {
      const response = await fetch(`${GRAPH_API_BASE}/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        email: data.mail || data.userPrincipalName,
        name: data.displayName,
      };
    } catch (error: any) {
      Logger.error('[OutlookEmailService] Get user profile failed:', error);
      return {
        success: false,
        error: error.message || 'Failed to get user profile',
      };
    }
  },
};

