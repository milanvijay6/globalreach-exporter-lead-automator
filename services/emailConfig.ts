/**
 * Default Email Configuration
 * Contains default Outlook email credentials for auto-connection
 * 
 * WARNING: In production, use environment variables instead of hardcoded credentials.
 * Set these environment variables:
 * - DEFAULT_EMAIL_USERNAME
 * - DEFAULT_EMAIL_PASSWORD
 * - DEFAULT_EMAIL_SMTP_HOST (optional, defaults to smtp-mail.outlook.com)
 * - DEFAULT_EMAIL_SMTP_PORT (optional, defaults to 587)
 * - DEFAULT_EMAIL_IMAP_HOST (optional, defaults to outlook.office365.com)
 * - DEFAULT_EMAIL_IMAP_PORT (optional, defaults to 993)
 */

import type { EmailCredentials } from './emailTypes';

/**
 * Default Outlook email credentials
 * Used for auto-connection on app startup
 * 
 * In production, credentials are read from environment variables.
 * Falls back to defaults for development/testing only.
 */
export const DEFAULT_EMAIL_CREDENTIALS: EmailCredentials = {
  provider: 'outlook',
  smtpHost: process.env.DEFAULT_EMAIL_SMTP_HOST || 'smtp-mail.outlook.com',
  smtpPort: parseInt(process.env.DEFAULT_EMAIL_SMTP_PORT || '587', 10),
  imapHost: process.env.DEFAULT_EMAIL_IMAP_HOST || 'outlook.office365.com',
  imapPort: parseInt(process.env.DEFAULT_EMAIL_IMAP_PORT || '993', 10),
  username: process.env.DEFAULT_EMAIL_USERNAME || 'Shreenathjimarketingassociate@outlook.com',
  password: process.env.DEFAULT_EMAIL_PASSWORD || 'xziwdfmguyypegmk', // App Password
};

/**
 * Gets default email credentials
 * Uses environment variables in production, falls back to defaults in development
 */
export const getDefaultEmailCredentials = (): EmailCredentials => {
  const credentials = { ...DEFAULT_EMAIL_CREDENTIALS };
  
  // Warn in production if using default credentials (not from env vars)
  if (process.env.NODE_ENV === 'production' && !process.env.DEFAULT_EMAIL_USERNAME) {
    console.warn('[EmailConfig] WARNING: Using default email credentials. Set DEFAULT_EMAIL_USERNAME and DEFAULT_EMAIL_PASSWORD environment variables for production.');
  }
  
  return credentials;
};

/**
 * Checks if email credentials are configured
 */
export const isEmailConfigured = (): boolean => {
  return !!(process.env.DEFAULT_EMAIL_USERNAME && process.env.DEFAULT_EMAIL_PASSWORD);
};

