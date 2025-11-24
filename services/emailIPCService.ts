/**
 * Email IPC Service
 * Wrapper service that routes all email operations through Electron IPC
 * This prevents Vite from analyzing emailService.ts which contains nodemailer imports
 */

import type { EmailCredentials, EmailMessage, SendEmailOptions } from './emailTypes';
import type { PlatformConnection } from '../types';

export const EmailIPCService = {
  /**
   * Tests email connection via IPC (main process)
   */
  testConnection: async (credentials: EmailCredentials): Promise<{ success: boolean; error?: string }> => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.testEmailConnection) {
      try {
        const result = await (window as any).electronAPI.testEmailConnection(credentials);
        return result || { success: false, error: 'No response from connection test' };
      } catch (error: any) {
        return { 
          success: false, 
          error: error.message || 'Connection test failed' 
        };
      }
    }
    
    return { 
      success: false, 
      error: 'Email service is only available in Electron environment' 
    };
  },

  /**
   * Sends email via SMTP using IPC (main process)
   * Works for Outlook, Gmail SMTP, and custom SMTP servers
   */
  sendViaSMTP: async (
    credentials: EmailCredentials,
    options: SendEmailOptions
  ): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.sendEmailSMTP) {
      try {
        const result = await (window as any).electronAPI.sendEmailSMTP(credentials, options);
        return result || { success: false, error: 'No response from email send' };
      } catch (error: any) {
        return { 
          success: false, 
          error: error.message || 'Failed to send email via SMTP' 
        };
      }
    }
    
    return { 
      success: false, 
      error: 'Email service is only available in Electron environment' 
    };
  },

  /**
   * Sends email via Gmail API using IPC (main process)
   */
  sendViaGmail: async (
    credentials: EmailCredentials,
    options: SendEmailOptions
  ): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.sendEmailGmail) {
      try {
        const result = await (window as any).electronAPI.sendEmailGmail(credentials, options);
        return result || { success: false, error: 'No response from email send' };
      } catch (error: any) {
        return { 
          success: false, 
          error: error.message || 'Failed to send email via Gmail' 
        };
      }
    }
    
    return { 
      success: false, 
      error: 'Email service is only available in Electron environment' 
    };
  },

  /**
   * Reads emails via IMAP using IPC (main process)
   * Works for Outlook, Gmail IMAP, and custom IMAP servers
   */
  readViaIMAP: async (
    credentials: EmailCredentials,
    maxResults: number = 10
  ): Promise<{ success: boolean; messages?: EmailMessage[]; error?: string }> => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.readEmailsIMAP) {
      try {
        const result = await (window as any).electronAPI.readEmailsIMAP(credentials, maxResults);
        return result || { success: false, error: 'No response from email read' };
      } catch (error: any) {
        return { 
          success: false, 
          error: error.message || 'Failed to read emails via IMAP' 
        };
      }
    }
    
    return { 
      success: false, 
      error: 'Email service is only available in Electron environment' 
    };
  },

  /**
   * Reads emails via Gmail API using IPC (main process)
   */
  readViaGmail: async (
    credentials: EmailCredentials,
    maxResults: number = 10,
    query?: string
  ): Promise<{ success: boolean; messages?: EmailMessage[]; error?: string }> => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.readEmailsGmail) {
      try {
        const result = await (window as any).electronAPI.readEmailsGmail(credentials, maxResults, query);
        return result || { success: false, error: 'No response from email read' };
      } catch (error: any) {
        return { 
          success: false, 
          error: error.message || 'Failed to read emails via Gmail' 
        };
      }
    }
    
    return { 
      success: false, 
      error: 'Email service is only available in Electron environment' 
    };
  },

  /**
   * Gets email connection via IPC (main process)
   */
  getEmailConnection: async (): Promise<PlatformConnection | null> => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.getEmailConnection) {
      try {
        const result = await (window as any).electronAPI.getEmailConnection();
        if (result && result.success && result.connection) {
          return result.connection;
        }
        return null;
      } catch (error: any) {
        console.error('[EmailIPCService] Failed to get email connection:', error);
        return null;
      }
    }
    
    return null;
  }
};

