/**
 * Email Service Types
 * Exported types and interfaces for email operations
 * This file contains only types - no runtime code that requires Node.js modules
 */

export interface EmailCredentials {
  provider: 'gmail' | 'outlook' | 'smtp' | 'imap';
  accessToken?: string;
  refreshToken?: string;
  tokenExpiryDate?: number; // Absolute timestamp when access token expires
  smtpHost?: string;
  smtpPort?: number;
  imapHost?: string;
  imapPort?: number;
  username?: string;
  password?: string; // Encrypted
  oauthClientId?: string;
  oauthClientSecret?: string;
  redirectUri?: string;
}

export interface EmailMessage {
  id: string;
  threadId?: string;
  from: { email: string; name?: string };
  to: { email: string; name?: string }[];
  cc?: { email: string; name?: string }[];
  bcc?: { email: string; name?: string }[];
  subject: string;
  body: { html?: string; text: string };
  date: Date;
  attachments?: Array<{ filename: string; contentType: string; size: number }>;
  inReplyTo?: string;
  references?: string[];
}

export interface SendEmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: Array<{ filename: string; path?: string; content?: Buffer; contentType?: string }>;
  inReplyTo?: string;
  references?: string[];
}

