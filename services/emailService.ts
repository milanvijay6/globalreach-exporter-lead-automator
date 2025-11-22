
import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { PlatformConnection, Channel } from '../types';
import { loadPlatformConnections } from './securityService';
import { PlatformService } from './platformService';

export interface EmailCredentials {
  provider: 'gmail' | 'outlook' | 'smtp' | 'imap';
  accessToken?: string;
  refreshToken?: string;
  smtpHost?: string;
  smtpPort?: number;
  imapHost?: string;
  imapPort?: number;
  username?: string;
  password?: string; // Encrypted
  oauthClientId?: string;
  oauthClientSecret?: string;
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

/**
 * Core Email Service
 * Handles Gmail API, SMTP, and IMAP connections
 */
export const EmailService = {
  /**
   * Gets email connection credentials from platform connections
   */
  getEmailConnection: async (): Promise<PlatformConnection | null> => {
    const connections = await loadPlatformConnections();
    return connections.find(
      conn => conn.channel === Channel.EMAIL && 
      conn.status === 'Connected' && 
      conn.emailCredentials
    ) || null;
  },

  /**
   * Initializes Gmail API client with OAuth credentials
   */
  getGmailClient: async (credentials: EmailCredentials) => {
    if (credentials.provider !== 'gmail' || !credentials.accessToken) {
      throw new Error('Gmail credentials not available');
    }

    const oauth2Client = new google.auth.OAuth2(
      credentials.oauthClientId,
      credentials.oauthClientSecret,
      'urn:ietf:wg:oauth:2.0:oob' // For desktop app
    );

    oauth2Client.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
    });

    // Auto-refresh token if expired
    oauth2Client.on('tokens', async (tokens) => {
      if (tokens.refresh_token) {
        // Update stored refresh token
        const connection = await EmailService.getEmailConnection();
        if (connection?.emailCredentials) {
          connection.emailCredentials.refreshToken = tokens.refresh_token;
          // Save updated credentials
          const { savePlatformConnections } = await import('./securityService');
          const allConnections = await loadPlatformConnections();
          const updated = allConnections.map(c => 
            c.channel === Channel.EMAIL ? connection : c
          );
          savePlatformConnections(updated);
        }
      }
    });

    return google.gmail({ version: 'v1', auth: oauth2Client });
  },

  /**
   * Sends email via Gmail API
   */
  sendViaGmail: async (
    credentials: EmailCredentials,
    options: SendEmailOptions
  ): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    try {
      const gmail = await EmailService.getGmailClient(credentials);
      
      // Build email message
      const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;
      const cc = options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined;
      const bcc = options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined;

      const messageParts: string[] = [];
      messageParts.push(`To: ${to}`);
      if (cc) messageParts.push(`Cc: ${cc}`);
      if (bcc) messageParts.push(`Bcc: ${bcc}`);
      messageParts.push(`Subject: ${options.subject}`);
      if (options.inReplyTo) messageParts.push(`In-Reply-To: ${options.inReplyTo}`);
      if (options.references) messageParts.push(`References: ${options.references.join(' ')}`);
      messageParts.push('Content-Type: multipart/alternative; boundary="boundary123"');
      messageParts.push('');

      // Add text part
      if (options.text) {
        messageParts.push('--boundary123');
        messageParts.push('Content-Type: text/plain; charset=utf-8');
        messageParts.push('');
        messageParts.push(options.text);
      }

      // Add HTML part
      if (options.html) {
        messageParts.push('--boundary123');
        messageParts.push('Content-Type: text/html; charset=utf-8');
        messageParts.push('');
        messageParts.push(options.html);
        messageParts.push('--boundary123--');
      }

      const rawMessage = messageParts.join('\r\n');
      const encodedMessage = Buffer.from(rawMessage)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
          threadId: options.inReplyTo ? undefined : undefined, // Gmail auto-threads
        },
      });

      return { success: true, messageId: response.data.id || undefined };
    } catch (error: any) {
      console.error('[EmailService] Gmail send error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to send email via Gmail' 
      };
    }
  },

  /**
   * Sends email via SMTP
   */
  sendViaSMTP: async (
    credentials: EmailCredentials,
    options: SendEmailOptions
  ): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    try {
      if (!credentials.smtpHost || !credentials.username) {
        throw new Error('SMTP credentials incomplete');
      }

      // Decrypt password if needed (in production, decrypt from secure storage)
      const password = credentials.password || '';

      const transporter = nodemailer.createTransport({
        host: credentials.smtpHost,
        port: credentials.smtpPort || 587,
        secure: credentials.smtpPort === 465, // true for 465, false for other ports
        auth: {
          user: credentials.username,
          pass: password,
        },
        tls: {
          rejectUnauthorized: false, // For self-signed certificates
        },
      });

      const mailOptions: any = {
        from: credentials.username,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        text: options.text,
        html: options.html,
      };

      if (options.cc) mailOptions.cc = Array.isArray(options.cc) ? options.cc : [options.cc];
      if (options.bcc) mailOptions.bcc = Array.isArray(options.bcc) ? options.bcc : [options.bcc];
      if (options.attachments) mailOptions.attachments = options.attachments;
      if (options.inReplyTo) mailOptions.inReplyTo = options.inReplyTo;
      if (options.references) mailOptions.references = options.references;

      const info = await transporter.sendMail(mailOptions);
      
      return { success: true, messageId: info.messageId };
    } catch (error: any) {
      console.error('[EmailService] SMTP send error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to send email via SMTP' 
      };
    }
  },

  /**
   * Reads emails via Gmail API
   */
  readViaGmail: async (
    credentials: EmailCredentials,
    maxResults: number = 10,
    query?: string
  ): Promise<{ success: boolean; messages?: EmailMessage[]; error?: string }> => {
    try {
      const gmail = await EmailService.getGmailClient(credentials);
      
      // List messages
      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: query || 'is:unread', // Default to unread
      });

      const messages: EmailMessage[] = [];
      
      if (listResponse.data.messages) {
        for (const msg of listResponse.data.messages) {
          const fullMessage = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id!,
            format: 'full',
          });

          const payload = fullMessage.data.payload;
          if (!payload) continue;

          const headers = payload.headers || [];
          const getHeader = (name: string) => 
            headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

          const fromHeader = getHeader('From');
          const toHeader = getHeader('To');
          const subject = getHeader('Subject');
          const dateHeader = getHeader('Date');
          const inReplyTo = getHeader('In-Reply-To');
          const references = getHeader('References');

          // Parse body
          let textBody = '';
          let htmlBody = '';
          
          const parsePart = (part: any) => {
            if (part.mimeType === 'text/plain' && part.body?.data) {
              textBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
            } else if (part.mimeType === 'text/html' && part.body?.data) {
              htmlBody = Buffer.from(part.body.data, 'base64').toString('utf-8');
            }
            if (part.parts) {
              part.parts.forEach(parsePart);
            }
          };
          parsePart(payload);

          // Parse from/to
          const parseEmail = (header: string) => {
            const match = header.match(/(.*?)\s*<(.+?)>/);
            if (match) {
              return { name: match[1].trim(), email: match[2].trim() };
            }
            return { email: header.trim() };
          };

          messages.push({
            id: msg.id!,
            threadId: fullMessage.data.threadId,
            from: parseEmail(fromHeader),
            to: toHeader.split(',').map(parseEmail),
            subject,
            body: { html: htmlBody || undefined, text: textBody },
            date: new Date(dateHeader || Date.now()),
            inReplyTo: inReplyTo || undefined,
            references: references ? references.split(' ') : undefined,
          });
        }
      }

      return { success: true, messages };
    } catch (error: any) {
      console.error('[EmailService] Gmail read error:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to read emails via Gmail' 
      };
    }
  },

  /**
   * Reads emails via IMAP
   */
  readViaIMAP: async (
    credentials: EmailCredentials,
    maxResults: number = 10
  ): Promise<{ success: boolean; messages?: EmailMessage[]; error?: string }> => {
    return new Promise((resolve) => {
      if (!credentials.imapHost || !credentials.username) {
        resolve({ success: false, error: 'IMAP credentials incomplete' });
        return;
      }

      const imap = new Imap({
        user: credentials.username,
        password: credentials.password || '',
        host: credentials.imapHost,
        port: credentials.imapPort || 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
      });

      const messages: EmailMessage[] = [];

      imap.once('ready', () => {
        imap.openBox('INBOX', false, (err, box) => {
          if (err) {
            resolve({ success: false, error: err.message });
            imap.end();
            return;
          }

          imap.search(['UNSEEN'], (err, results) => {
            if (err) {
              resolve({ success: false, error: err.message });
              imap.end();
              return;
            }

            if (!results || results.length === 0) {
              resolve({ success: true, messages: [] });
              imap.end();
              return;
            }

            const fetch = imap.fetch(results.slice(0, maxResults), { bodies: '' });
            let processed = 0;

            fetch.on('message', (msg, seqno) => {
              msg.on('body', (stream) => {
                simpleParser(stream, (err, parsed) => {
                  if (err) {
                    processed++;
                    if (processed === Math.min(results.length, maxResults)) {
                      resolve({ success: true, messages });
                      imap.end();
                    }
                    return;
                  }

                  messages.push({
                    id: `${seqno}-${Date.now()}`,
                    from: { 
                      email: parsed.from?.value[0]?.address || '', 
                      name: parsed.from?.value[0]?.name 
                    },
                    to: parsed.to?.value.map(v => ({ email: v.address, name: v.name })) || [],
                    subject: parsed.subject || '',
                    body: { 
                      html: parsed.html || undefined, 
                      text: parsed.text || '' 
                    },
                    date: parsed.date || new Date(),
                    inReplyTo: parsed.inReplyTo || undefined,
                    references: parsed.references ? parsed.references.map(String) : undefined,
                  });

                  processed++;
                  if (processed === Math.min(results.length, maxResults)) {
                    resolve({ success: true, messages });
                    imap.end();
                  }
                });
              });
            });

            fetch.once('error', (err) => {
              resolve({ success: false, error: err.message });
              imap.end();
            });
          });
        });
      });

      imap.once('error', (err) => {
        resolve({ success: false, error: err.message });
      });

      imap.connect();
    });
  },

  /**
   * Validates email address format (RFC 5322)
   */
  validateEmail: (email: string): { valid: boolean; error?: string } => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { valid: false, error: 'Invalid email format' };
    }

    // Check for common typos
    const commonTypos: Record<string, string> = {
      'gmial.com': 'gmail.com',
      'gmai.com': 'gmail.com',
      'gmal.com': 'gmail.com',
      'yahooo.com': 'yahoo.com',
      'yaho.com': 'yahoo.com',
    };

    const domain = email.split('@')[1]?.toLowerCase();
    if (domain && commonTypos[domain]) {
      return { valid: false, error: `Did you mean ${email.replace(domain, commonTypos[domain])}?` };
    }

    return { valid: true };
  },

  /**
   * Tests email connection
   */
  testConnection: async (credentials: EmailCredentials): Promise<{ success: boolean; error?: string }> => {
    try {
      if (credentials.provider === 'gmail') {
        const gmail = await EmailService.getGmailClient(credentials);
        await gmail.users.getProfile({ userId: 'me' });
        return { success: true };
      } else if (credentials.provider === 'smtp' || credentials.provider === 'imap') {
        // Test SMTP connection
        if (credentials.smtpHost) {
          const transporter = nodemailer.createTransport({
            host: credentials.smtpHost,
            port: credentials.smtpPort || 587,
            secure: credentials.smtpPort === 465,
            auth: {
              user: credentials.username,
              pass: credentials.password,
            },
          });
          await transporter.verify();
          return { success: true };
        }
        return { success: false, error: 'SMTP configuration incomplete' };
      }
      return { success: false, error: 'Unsupported provider' };
    } catch (error: any) {
      return { success: false, error: error.message || 'Connection test failed' };
    }
  },
};

