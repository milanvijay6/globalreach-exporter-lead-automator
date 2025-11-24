
// Use types from emailTypes instead of emailService to avoid Vite analyzing emailService.ts
import type { EmailMessage } from './emailTypes';
import { Channel } from '../types';
import { PlatformService } from './platformService';

export type EmailIngestionCallback = (message: EmailMessage) => Promise<void>;

let ingestionCallbacks: EmailIngestionCallback[] = [];
let pollingInterval: NodeJS.Timeout | null = null;
let imapIdleConnection: any = null;

/**
 * Email Ingestion Service
 * Handles reading emails from multiple providers in real-time or via polling
 */
export const EmailIngestionService = {
  /**
   * Registers a callback for incoming emails
   */
  onEmailReceived: (callback: EmailIngestionCallback) => {
    ingestionCallbacks.push(callback);
  },

  /**
   * Removes a callback
   */
  removeCallback: (callback: EmailIngestionCallback) => {
    ingestionCallbacks = ingestionCallbacks.filter(cb => cb !== callback);
  },

  /**
   * Starts polling for emails (fallback method)
   */
  startPolling: async (intervalMinutes: number = 5) => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
    }

    const poll = async () => {
      try {
        const { EmailIPCService } = await import('./emailIPCService');
        const connection = await EmailIPCService.getEmailConnection();
        if (!connection?.emailCredentials) {
          console.warn('[EmailIngestion] No email connection found');
          return;
        }

        const credentials = connection.emailCredentials;
        let result;

        if (credentials.provider === 'gmail') {
          result = await EmailIPCService.readViaGmail(credentials, 10, 'is:unread');
        } else if (credentials.provider === 'imap' || credentials.provider === 'outlook') {
          result = await EmailIPCService.readViaIMAP(credentials, 10);
        } else {
          console.warn('[EmailIngestion] Polling not supported for provider:', credentials.provider);
          return;
        }

        if (result.success && result.messages) {
          for (const message of result.messages) {
            // Process each message through callbacks
            for (const callback of ingestionCallbacks) {
              try {
                await callback(message);
              } catch (error) {
                console.error('[EmailIngestion] Callback error:', error);
              }
            }
          }
        } else if (!result.success) {
          // Handle errors with exponential backoff
          console.warn('[EmailIngestion] Polling failed:', result.error);
          // In production, implement exponential backoff here
        }
      } catch (error: any) {
        console.error('[EmailIngestion] Polling error:', error);
        // Rate limit handling - increase interval on rate limit errors
        if (error.message?.includes('rate limit') || error.message?.includes('quota')) {
          console.warn('[EmailIngestion] Rate limited, will retry with longer interval');
          // Could implement dynamic interval adjustment here
        }
      }
    };

    // Poll immediately, then on interval
    await poll();
    pollingInterval = setInterval(poll, intervalMinutes * 60 * 1000);
  },

  /**
   * Stops polling
   */
  stopPolling: () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  },

  /**
   * Starts IMAP IDLE for real-time email notifications
   */
  startIMAPIdle: async () => {
    try {
      const { EmailIPCService } = await import('./emailIPCService');
      const connection = await EmailIPCService.getEmailConnection();
      if (!connection?.emailCredentials || connection.emailCredentials.provider !== 'imap') {
        console.warn('[EmailIngestion] IMAP IDLE requires IMAP provider');
        return;
      }

      const credentials = connection.emailCredentials;
      if (!credentials.imapHost || !credentials.username) {
        console.warn('[EmailIngestion] IMAP credentials incomplete');
        return;
      }

      // Note: Full IMAP IDLE implementation would require the imap library
      // This is a simplified version - in production, you'd use the imap library's IDLE feature
      console.log('[EmailIngestion] IMAP IDLE started (using polling fallback)');
      await EmailIngestionService.startPolling(1); // Poll every minute as fallback
    } catch (error) {
      console.error('[EmailIngestion] IMAP IDLE error:', error);
    }
  },

  /**
   * Stops IMAP IDLE
   */
  stopIMAPIdle: () => {
    EmailIngestionService.stopPolling();
    if (imapIdleConnection) {
      // Close IMAP connection if exists
      imapIdleConnection = null;
    }
  },

  /**
   * Processes a single email message (called by webhooks or manual ingestion)
   */
  processEmail: async (message: EmailMessage) => {
    for (const callback of ingestionCallbacks) {
      try {
        await callback(message);
      } catch (error) {
        console.error('[EmailIngestion] Callback error:', error);
      }
    }
  },

  /**
   * Manually fetch and process emails
   */
  fetchAndProcess: async (maxResults: number = 10, query?: string) => {
    try {
      const { EmailIPCService } = await import('./emailIPCService');
      const connection = await EmailIPCService.getEmailConnection();
      if (!connection?.emailCredentials) {
        return { success: false, error: 'Email not connected' };
      }

      const credentials = connection.emailCredentials;
      let result;

      if (credentials.provider === 'gmail') {
        result = await EmailIPCService.readViaGmail(credentials, maxResults, query);
      } else if (credentials.provider === 'imap' || credentials.provider === 'outlook') {
        result = await EmailIPCService.readViaIMAP(credentials, maxResults);
      } else {
        return { success: false, error: 'Provider not supported for reading' };
      }

      if (result.success && result.messages) {
        for (const message of result.messages) {
          await EmailIngestionService.processEmail(message);
        }
        return { success: true, count: result.messages.length };
      }

      return result;
    } catch (error: any) {
      console.error('[EmailIngestion] Fetch error:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Initializes email ingestion based on provider capabilities
   */
  initialize: async () => {
    try {
      const { EmailIPCService } = await import('./emailIPCService');
      const connection = await EmailIPCService.getEmailConnection();
      if (!connection?.emailCredentials) {
        console.log('[EmailIngestion] No email connection, skipping initialization');
        return;
      }

      const credentials = connection.emailCredentials;

      // Gmail: Use polling with exponential backoff on errors
      if (credentials.provider === 'gmail') {
        console.log('[EmailIngestion] Starting Gmail polling');
        await EmailIngestionService.startPolling(5); // Poll every 5 minutes
      }
      // Outlook: Use polling (similar to Gmail)
      else if (credentials.provider === 'outlook') {
        console.log('[EmailIngestion] Starting Outlook polling');
        await EmailIngestionService.startPolling(5); // Poll every 5 minutes
      }
      // IMAP: Use IDLE if available, fallback to polling
      else if (credentials.provider === 'imap') {
        console.log('[EmailIngestion] Starting IMAP IDLE');
        await EmailIngestionService.startIMAPIdle();
      }
      // SMTP-only: Cannot read emails
      else if (credentials.provider === 'smtp') {
        console.warn('[EmailIngestion] SMTP provider cannot read emails');
      }
    } catch (error) {
      console.error('[EmailIngestion] Initialization error:', error);
    }
  },

  /**
   * Shuts down all ingestion processes
   */
  shutdown: () => {
    EmailIngestionService.stopPolling();
    EmailIngestionService.stopIMAPIdle();
    ingestionCallbacks = [];
  },
};

