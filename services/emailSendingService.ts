
// Use types from emailTypes instead of emailService to avoid Vite analyzing emailService.ts
import type { SendEmailOptions } from './emailTypes';
import { Importer, AppTemplates, Channel } from '../types';

/**
 * Email Sending Service
 * Handles template application, personalization, and validation
 */
export const EmailSendingService = {
  /**
   * Replaces template placeholders with actual values
   */
  replacePlaceholders: (template: string, values: Record<string, string>): string => {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] || `{{${key}}}`);
  },

  /**
   * Applies branded HTML template to email content
   */
  applyHTMLTemplate: (
    content: string,
    options: {
      companyName?: string;
      companyLogo?: string;
      primaryColor?: string;
      footerText?: string;
    } = {}
  ): string => {
    const {
      companyName = 'Global Exports',
      companyLogo = '',
      primaryColor = '#4F46E5',
      footerText = '© 2024 Global Exports. All rights reserved.',
    } = options;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${companyName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .email-container {
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .email-header {
      background-color: ${primaryColor};
      color: white;
      padding: 20px;
      text-align: center;
    }
    .email-header h1 {
      margin: 0;
      font-size: 24px;
    }
    ${companyLogo ? `.email-header img { max-width: 150px; height: auto; }` : ''}
    .email-body {
      padding: 30px 20px;
    }
    .email-body p {
      margin: 0 0 15px 0;
    }
    .email-footer {
      background-color: #f8f9fa;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #666;
      border-top: 1px solid #e9ecef;
    }
    .email-footer a {
      color: ${primaryColor};
      text-decoration: none;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: ${primaryColor};
      color: white;
      text-decoration: none;
      border-radius: 4px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      ${companyLogo ? `<img src="${companyLogo}" alt="${companyName}" />` : `<h1>${companyName}</h1>`}
    </div>
    <div class="email-body">
      ${content.replace(/\n/g, '<br>')}
    </div>
    <div class="email-footer">
      <p>${footerText}</p>
      <p><a href="{{unsubscribe_url}}">Unsubscribe</a> | <a href="{{preferences_url}}">Email Preferences</a></p>
    </div>
  </div>
</body>
</html>
    `.trim();
  },

  /**
   * Extracts subject line from email content if present
   */
  extractSubject: (content: string): { subject: string; body: string } => {
    const subjectMatch = content.match(/^Subject:\s*(.+)$/m);
    if (subjectMatch) {
      return {
        subject: subjectMatch[1],
        body: content.replace(/^Subject:\s*.+$/m, '').trim(),
      };
    }
    return { subject: '', body: content };
  },

  /**
   * Personalizes email content with importer data
   */
  personalizeContent: (
    template: string,
    importer: Importer,
    templates: AppTemplates,
    contextualInfo?: {
      recentInteractions?: string;
      productMentions?: string[];
      lastContactDate?: Date;
    }
  ): string => {
    const values: Record<string, string> = {
      importerName: importer.name,
      companyName: importer.companyName,
      country: importer.country,
      productCategory: importer.productsImported,
      myCompany: 'Global Exports',
      myProduct: 'Agri-Products',
    };

    if (contextualInfo) {
      if (contextualInfo.recentInteractions) {
        values.recentInteractions = contextualInfo.recentInteractions;
      }
      if (contextualInfo.productMentions) {
        values.productMentions = contextualInfo.productMentions.join(', ');
      }
      if (contextualInfo.lastContactDate) {
        values.lastContactDate = contextualInfo.lastContactDate.toLocaleDateString();
      }
    }

    return EmailSendingService.replacePlaceholders(template, values);
  },

  /**
   * Sanitizes email content to prevent XSS
   */
  sanitizeContent: (html: string): string => {
    // Basic XSS prevention - remove script tags and dangerous attributes
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
      .replace(/javascript:/gi, '');
  },

  /**
   * Validates email address format
   */
  validateEmailAddress: (email: string): { valid: boolean; error?: string } => {
    if (!email || typeof email !== 'string') {
      return { valid: false, error: 'Email is required' };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return { valid: false, error: 'Invalid email format' };
    }
    if (email.length > 254) {
      return { valid: false, error: 'Email address too long' };
    }
    return { valid: true };
  },

  /**
   * Validates email before sending
   */
  validateBeforeSend: async (
    to: string | string[],
    subject: string,
    content: string
  ): Promise<{ valid: boolean; errors: string[] }> => {
    const errors: string[] = [];
    const recipients = Array.isArray(to) ? to : [to];

    // Validate recipients
    for (const email of recipients) {
      const validation = EmailSendingService.validateEmailAddress(email);
      if (!validation.valid) {
        errors.push(`Invalid email: ${email} - ${validation.error}`);
      }
    }

    // Validate subject
    if (!subject || subject.trim().length === 0) {
      errors.push('Subject is required');
    }
    if (subject.length > 255) {
      errors.push('Subject line too long (max 255 characters)');
    }

    // Validate content
    if (!content || content.trim().length === 0) {
      errors.push('Email content is required');
    }

    // Check for common spam triggers
    const spamWords = ['free', 'click here', 'limited time', 'act now'];
    const contentLower = content.toLowerCase();
    const foundSpamWords = spamWords.filter(word => contentLower.includes(word));
    if (foundSpamWords.length > 2) {
      errors.push(`Content may trigger spam filters (contains: ${foundSpamWords.join(', ')})`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  /**
   * Sends email with template and personalization
   */
  sendEmail: async (
    importer: Importer,
    template: string,
    templates: AppTemplates,
    options: {
      subject?: string;
      useHTML?: boolean;
      contextualInfo?: {
        recentInteractions?: string;
        productMentions?: string[];
        lastContactDate?: Date;
      };
      inReplyTo?: string;
      references?: string[];
    } = {}
  ): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    try {
      // Get email connection via IPC
      const { EmailIPCService } = await import('./emailIPCService');
      const connection = await EmailIPCService.getEmailConnection();
      if (!connection?.emailCredentials) {
        return { success: false, error: 'Email not connected. Please connect your email account in Settings.' };
      }

      // Personalize content
      const personalizedContent = EmailSendingService.personalizeContent(
        template,
        importer,
        templates,
        options.contextualInfo
      );

      // Extract subject if not provided
      const { subject: extractedSubject, body: bodyContent } = EmailSendingService.extractSubject(personalizedContent);
      const subject = options.subject || extractedSubject || 'Message from Global Exports';

      // Validate before sending
      const validation = await EmailSendingService.validateBeforeSend(
        importer.contactDetail,
        subject,
        bodyContent
      );

      if (!validation.valid) {
        return { success: false, error: validation.errors.join('; ') };
      }

      // Prepare email options with threading support
      const emailOptions: SendEmailOptions = {
        to: importer.contactDetail,
        subject,
        text: bodyContent,
        inReplyTo: options.inReplyTo,
        references: options.references || (options.inReplyTo ? [options.inReplyTo] : undefined),
      };
      
      // Ensure proper threading headers
      if (options.inReplyTo && !emailOptions.references) {
        emailOptions.references = [options.inReplyTo];
      }

      // Apply HTML template if requested
      if (options.useHTML !== false) {
        emailOptions.html = EmailSendingService.applyHTMLTemplate(
          EmailSendingService.sanitizeContent(bodyContent),
          {
            companyName: 'Global Exports',
            primaryColor: '#4F46E5',
          }
        );
      }

      // Send via appropriate provider using IPC
      const credentials = connection.emailCredentials;
      if (credentials.provider === 'gmail') {
        return await EmailIPCService.sendViaGmail(credentials, emailOptions);
      } else if (credentials.provider === 'smtp' || credentials.provider === 'imap' || credentials.provider === 'outlook') {
        return await EmailIPCService.sendViaSMTP(credentials, emailOptions);
      }

      return { success: false, error: 'Unsupported email provider' };
    } catch (error: any) {
      console.error('[EmailSendingService] Send error:', error);
      return { success: false, error: error.message || 'Failed to send email' };
    }
  },
};

