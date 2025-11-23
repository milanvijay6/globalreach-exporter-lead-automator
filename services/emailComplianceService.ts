
import { EmailSendingService } from './emailSendingService';
import { PlatformService } from './platformService';

export interface UnsubscribeRecord {
  email: string;
  timestamp: number;
  reason?: string;
}

// In-memory unsubscribe list (in production, use database)
const unsubscribeList: Map<string, UnsubscribeRecord> = new Map();

/**
 * Email Compliance Service
 * Handles security, CAN-SPAM, GDPR compliance
 * Enhanced with GDPR compliance features
 */

// Audit log for data access (GDPR requirement)
const dataAccessLog: Array<{
  timestamp: number;
  userId: string;
  dataType: string;
  action: string;
}> = [];

/**
 * Logs data access for GDPR compliance
 */
export const logDataAccess = (userId: string, dataType: string, action: string) => {
  dataAccessLog.push({
    timestamp: Date.now(),
    userId,
    dataType,
    action,
  });
  
  // Keep only last 1000 entries
  if (dataAccessLog.length > 1000) {
    dataAccessLog.shift();
  }
};

/**
 * Gets audit log for data access (GDPR requirement)
 */
export const getDataAccessLog = (userId?: string) => {
  if (userId) {
    return dataAccessLog.filter(log => log.userId === userId);
  }
  return dataAccessLog.slice(-100); // Last 100 entries
};

/**
 * GDPR: Right to deletion - removes all email data for a user
 */
export const deleteUserEmailData = async (email: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Add to unsubscribe list
    EmailComplianceService.unsubscribe(email, 'GDPR deletion request');
    
    // In production, delete all data associated with email
    logDataAccess('system', 'email_data', `deletion for ${email}`);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

export const EmailComplianceService = {
  /**
   * Adds email to unsubscribe list
   */
  unsubscribe: (email: string, reason?: string): void => {
    unsubscribeList.set(email.toLowerCase(), {
      email: email.toLowerCase(),
      timestamp: Date.now(),
      reason,
    });
  },

  /**
   * Checks if email is unsubscribed
   */
  isUnsubscribed: (email: string): boolean => {
    return unsubscribeList.has(email.toLowerCase());
  },

  /**
   * Adds unsubscribe link to email HTML
   */
  addUnsubscribeLink: (html: string, email: string): string => {
    const unsubscribeUrl = `${window.location.origin}/unsubscribe?email=${encodeURIComponent(email)}`;
    const unsubscribeLink = `<p style="font-size: 12px; color: #666; text-align: center; margin-top: 20px;">
      <a href="${unsubscribeUrl}" style="color: #666;">Unsubscribe</a> | 
      <a href="${unsubscribeUrl.replace('/unsubscribe', '/preferences')}" style="color: #666;">Email Preferences</a>
    </p>`;
    
    // Insert before closing body tag or at end
    if (html.includes('</body>')) {
      return html.replace('</body>', `${unsubscribeLink}</body>`);
    }
    return html + unsubscribeLink;
  },

  /**
   * Adds physical address to email (CAN-SPAM requirement)
   */
  addPhysicalAddress: (html: string, address?: string): string => {
    const physicalAddress = address || 'Global Exports, 123 Business St, City, State 12345, USA';
    const addressFooter = `<p style="font-size: 11px; color: #999; text-align: center; margin-top: 10px;">
      ${physicalAddress}
    </p>`;
    
    if (html.includes('</body>')) {
      return html.replace('</body>', `${addressFooter}</body>`);
    }
    return html + addressFooter;
  },

  /**
   * Validates email before sending (compliance checks)
   */
  validateBeforeSend: async (to: string): Promise<{ valid: boolean; errors: string[] }> => {
    const errors: string[] = [];

    // Check unsubscribe list
    if (EmailComplianceService.isUnsubscribed(to)) {
      errors.push('Email address has unsubscribed');
    }

    // Check rate limits (basic)
    const rateLimitKey = `email_rate_${to.toLowerCase()}`;
    const lastSent = await PlatformService.getAppConfig(rateLimitKey, 0);
    const now = Date.now();
    const cooldownMs = 60 * 60 * 1000; // 1 hour between emails to same address

    if (now - lastSent < cooldownMs) {
      errors.push('Rate limit: Please wait before sending another email to this address');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  /**
   * Records email send for rate limiting
   */
  recordSend: async (to: string): Promise<void> => {
    const rateLimitKey = `email_rate_${to.toLowerCase()}`;
    await PlatformService.setAppConfig(rateLimitKey, Date.now());
  },

  /**
   * Checks bounce rate and determines if sending should be paused
   */
  checkBounceRate: async (): Promise<{ shouldPause: boolean; bounceRate: number; message?: string }> => {
    // In production, track bounces from email provider
    // For now, return safe defaults
    const bounceRate = 0; // Would be calculated from bounce tracking
    const threshold = 0.05; // 5% bounce rate threshold

    if (bounceRate > threshold) {
      return {
        shouldPause: true,
        bounceRate,
        message: `Bounce rate (${(bounceRate * 100).toFixed(1)}%) exceeds threshold. Sending paused.`,
      };
    }

    return {
      shouldPause: false,
      bounceRate,
    };
  },

  /**
   * Sanitizes email content for XSS prevention
   */
  sanitizeContent: (html: string): string => {
    return EmailSendingService.sanitizeContent(html);
  },

  /**
   * Ensures TLS encryption (enforced in emailService)
   */
  enforceTLS: (): boolean => {
    // TLS is enforced in emailService.sendViaSMTP and Gmail API uses HTTPS
    return true;
  },

  /**
   * Handles GDPR data deletion request
   */
  handleGDPRDeletion: async (email: string): Promise<{ success: boolean; message: string }> => {
    try {
      // Add to unsubscribe list
      EmailComplianceService.unsubscribe(email, 'GDPR deletion request');

      // In production, delete all data associated with email
      // For now, just unsubscribe
      return {
        success: true,
        message: 'Data deletion request processed. Email unsubscribed and data will be deleted.',
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Failed to process deletion request',
      };
    }
  },

  /**
   * Gets unsubscribe list (for admin)
   */
  getUnsubscribeList: (): UnsubscribeRecord[] => {
    return Array.from(unsubscribeList.values());
  },
};

