import { OutlookEmailService, EmailReadResult } from './outlookEmailService';
import { loadEmailConnection } from './securityService';
import { Logger } from './loggerService';
import { Importer, LeadStatus, Message, Channel } from '../types';
import { PlatformService } from './platformService';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_EMAILS_PER_POLL = 50;

let pollingInterval: NodeJS.Timeout | null = null;
let isPolling = false;
let lastPollTime: number | null = null;
let processedEmailIds = new Set<string>(); // Track processed emails to avoid duplicates

export interface EmailIngestionConfig {
  enabled: boolean;
  autoReply: boolean;
  draftApprovalRequired: boolean;
  pollInterval?: number;
}

/**
 * Email Ingestion Service
 * Polls inbox for new emails, matches them to leads, and triggers AI reply generation
 */
export const EmailIngestionService = {
  /**
   * Starts polling inbox for new emails
   */
  startPolling: async (config?: EmailIngestionConfig): Promise<void> => {
    if (pollingInterval) {
      Logger.warn('[EmailIngestion] Polling already started');
      return;
    }

    const ingestionConfig = config || {
      enabled: true,
      autoReply: false,
      draftApprovalRequired: true,
      pollInterval: POLL_INTERVAL_MS,
    };

    if (!ingestionConfig.enabled) {
      Logger.info('[EmailIngestion] Polling disabled in config');
      return;
    }

    Logger.info('[EmailIngestion] Starting inbox polling', {
      interval: ingestionConfig.pollInterval,
      autoReply: ingestionConfig.autoReply,
    });

    // Initial poll
    await EmailIngestionService.pollInbox(ingestionConfig);

    // Set up interval
    pollingInterval = setInterval(async () => {
      await EmailIngestionService.pollInbox(ingestionConfig);
    }, ingestionConfig.pollInterval || POLL_INTERVAL_MS);
  },

  /**
   * Stops polling inbox
   */
  stopPolling: (): void => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
      Logger.info('[EmailIngestion] Polling stopped');
    }
  },

  /**
   * Polls inbox for new emails
   */
  pollInbox: async (config?: EmailIngestionConfig): Promise<void> => {
    if (isPolling) {
      Logger.debug('[EmailIngestion] Poll already in progress, skipping');
      return;
    }

    try {
      isPolling = true;
      lastPollTime = Date.now();

      // Load email connection
      const emailConn = await loadEmailConnection();
      if (!emailConn || !emailConn.emailCredentials) {
        Logger.debug('[EmailIngestion] No email connection, skipping poll');
        return;
      }

      // Refresh token if needed
      let credentials = emailConn.emailCredentials;
      const refreshed = await refreshEmailTokens(credentials);
      if (refreshed) {
        credentials = refreshed;
        // Update connection with refreshed credentials
        const { saveEmailConnection } = await import('./securityService');
        await saveEmailConnection(refreshed, emailConn.accountName);
      }

      // Read emails from inbox
      const result = await OutlookEmailService.readEmails(credentials, {
        maxResults: MAX_EMAILS_PER_POLL,
        unreadOnly: true,
        folder: 'inbox',
      });

      if (!result.success || !result.messages) {
        Logger.warn('[EmailIngestion] Failed to read emails:', result.error);
        return;
      }

      Logger.info('[EmailIngestion] Polled inbox', { count: result.messages.length });

      // Process each email
      for (const email of result.messages) {
        // Skip if already processed
        if (processedEmailIds.has(email.id)) {
          continue;
        }

        await EmailIngestionService.processEmail(email, credentials, config);
        processedEmailIds.add(email.id);
      }

      // Clean up old processed IDs (keep last 1000)
      if (processedEmailIds.size > 1000) {
        const idsArray = Array.from(processedEmailIds);
        processedEmailIds = new Set(idsArray.slice(-1000));
      }
    } catch (error: any) {
      Logger.error('[EmailIngestion] Poll inbox failed:', error);
    } finally {
      isPolling = false;
    }
  },

  /**
   * Processes a single email
   */
  processEmail: async (
    email: EmailReadResult,
    credentials: any,
    config?: EmailIngestionConfig
  ): Promise<void> => {
    try {
      const senderEmail = email.from?.emailAddress?.address;
      if (!senderEmail) {
        Logger.warn('[EmailIngestion] Email missing sender address', { emailId: email.id });
        return;
      }

      // Find matching importer by email
      const importers = await EmailIngestionService.findImportersByEmail(senderEmail);
      
      if (importers.length === 0) {
        Logger.debug('[EmailIngestion] No matching lead found for email', { senderEmail });
        return;
      }

      // Process for each matching importer (in case of multiple leads with same email)
      for (const importer of importers) {
        await EmailIngestionService.handleLeadEmail(importer, email, credentials, config);
      }
    } catch (error: any) {
      Logger.error('[EmailIngestion] Process email failed:', error);
    }
  },

  /**
   * Finds importers by email address
   */
  findImportersByEmail: async (email: string): Promise<Importer[]> => {
    try {
      // Load importers from storage
      const { StorageService } = await import('./storageService');
      const allImporters = StorageService.loadImporters() || [];
      
      // Match by email field or contactDetail
      return allImporters.filter(imp => {
        const importerEmail = imp.email || (imp.contactDetail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(imp.contactDetail) ? imp.contactDetail : null);
        return importerEmail && importerEmail.toLowerCase() === email.toLowerCase();
      });
    } catch (error: any) {
      Logger.error('[EmailIngestion] Find importers by email failed:', error);
      return [];
    }
  },

  /**
   * Handles an email from a lead
   */
  handleLeadEmail: async (
    importer: Importer,
    email: EmailReadResult,
    credentials: any,
    config?: EmailIngestionConfig
  ): Promise<void> => {
    try {
      // Extract email content
      const emailBody = email.body?.content || '';
      const emailSubject = email.subject || '(No Subject)';
      
      // Add message to chat history
      const newMessage: Message = {
        id: `email_${email.id}_${Date.now()}`,
        sender: 'importer',
        content: emailBody,
        timestamp: new Date(email.receivedDateTime).getTime(),
        channel: Channel.EMAIL,
        status: 'delivered',
      };

      // Update importer
      const updatedImporter: Importer = {
        ...importer,
        chatHistory: [...importer.chatHistory, newMessage],
        status: importer.status === LeadStatus.PENDING ? LeadStatus.ENGAGED : importer.status,
        lastContacted: new Date(email.receivedDateTime).getTime(),
      };

      // Save updated importer
      const { StorageService } = await import('./storageService');
      const allImporters = StorageService.loadImporters() || [];
      const updatedImporters = allImporters.map(imp => imp.id === updatedImporter.id ? updatedImporter : imp);
      StorageService.saveImporters(updatedImporters);

      Logger.info('[EmailIngestion] Processed email from lead', {
        importerId: importer.id,
        emailId: email.id,
        subject: emailSubject,
      });

      // Trigger AI reply generation if auto-reply is enabled
      const ingestionConfig = config || {
        enabled: true,
        autoReply: await PlatformService.getAppConfig('emailAutoReply', false),
        draftApprovalRequired: await PlatformService.getAppConfig('emailDraftApproval', true),
      };

      if (ingestionConfig.autoReply) {
        await EmailIngestionService.generateAndSendReply(
          updatedImporter,
          email,
          credentials,
          ingestionConfig.draftApprovalRequired
        );
      } else {
        // Even if auto-reply is disabled, we can still generate a draft for user review
        if (ingestionConfig.draftApprovalRequired) {
          await EmailIngestionService.generateDraftReply(updatedImporter, email);
        }
      }
    } catch (error: any) {
      Logger.error('[EmailIngestion] Handle lead email failed:', error);
    }
  },

  /**
   * Generates and sends AI reply
   */
  generateAndSendReply: async (
    importer: Importer,
    email: EmailReadResult,
    credentials: any,
    requireApproval: boolean
  ): Promise<void> => {
    try {
      // Generate reply using AI
      const { GeminiService } = await import('./geminiService');
      const replyContent = await GeminiService.generateEmailReply(
        importer,
        email.body?.content || '',
        email.subject || ''
      );

      if (!replyContent) {
        Logger.warn('[EmailIngestion] Failed to generate reply');
        return;
      }

      if (requireApproval) {
        // Store draft for user approval (would need UI to show drafts)
        Logger.info('[EmailIngestion] Draft reply generated, awaiting approval', {
          importerId: importer.id,
          emailId: email.id,
        });
        // TODO: Store draft in a drafts queue/UI
        return;
      }

      // Send reply immediately
      const result = await OutlookEmailService.replyToEmail(
        email.id,
        replyContent,
        'html',
        credentials
      );

      if (result.success) {
        Logger.info('[EmailIngestion] Auto-reply sent', {
          importerId: importer.id,
          emailId: email.id,
        });
      } else {
        Logger.error('[EmailIngestion] Failed to send auto-reply:', result.error);
      }
    } catch (error: any) {
      Logger.error('[EmailIngestion] Generate and send reply failed:', error);
    }
  },

  /**
   * Generates draft reply (for user review)
   */
  generateDraftReply: async (
    importer: Importer,
    email: EmailReadResult
  ): Promise<void> => {
    try {
      const { GeminiService } = await import('./geminiService');
      const replyContent = await GeminiService.generateEmailReply(
        importer,
        email.body?.content || '',
        email.subject || ''
      );

      if (replyContent) {
        Logger.info('[EmailIngestion] Draft reply generated', {
          importerId: importer.id,
          emailId: email.id,
        });
        // TODO: Store draft in UI for user review
      }
    } catch (error: any) {
      Logger.error('[EmailIngestion] Generate draft reply failed:', error);
    }
  },

  /**
   * Gets polling status
   */
  getStatus: (): {
    isPolling: boolean;
    lastPollTime: number | null;
    processedCount: number;
  } => {
    return {
      isPolling: pollingInterval !== null,
      lastPollTime,
      processedCount: processedEmailIds.size,
    };
  },
};
