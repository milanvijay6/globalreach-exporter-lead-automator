/**
 * Email Service (Main Process)
 * Handles Gmail API, SMTP, and IMAP connections
 * This file runs only in Electron's main process where Node.js modules are available
 */

const nodemailer = require('nodemailer');
const { google } = require('googleapis');
const Imap = require('imap');
const { simpleParser } = require('mailparser');

// Helper function to get Gmail client
async function getGmailClient(credentials, getConfig, loadPlatformConnections, savePlatformConnections) {
  if (credentials.provider !== 'gmail' || !credentials.accessToken) {
    throw new Error('Gmail credentials not available');
  }

  // Check if token needs refresh (expires in < 5 minutes)
  const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes
  const now = Date.now();
  const needsRefresh = credentials.tokenExpiryDate 
    ? (credentials.tokenExpiryDate - now) < REFRESH_BUFFER_MS
    : true;

  // Get redirect URI from stored credentials or construct from server port
  let redirectUri = credentials.redirectUri;
  if (!redirectUri) {
    const port = getConfig('serverPort', 4000);
    redirectUri = `http://localhost:${port}/auth/oauth/callback`;
  }
  
  const oauth2Client = new google.auth.OAuth2(
    credentials.oauthClientId,
    credentials.oauthClientSecret,
    redirectUri
  );

  oauth2Client.setCredentials({
    access_token: credentials.accessToken,
    refresh_token: credentials.refreshToken,
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

const EmailService = {
  /**
   * Sends email via Gmail API
   */
  sendViaGmail: async (credentials, options, getConfig, loadPlatformConnections, savePlatformConnections) => {
    try {
      const gmail = await getGmailClient(credentials, getConfig, loadPlatformConnections, savePlatformConnections);
      
      // Build email message
      const to = Array.isArray(options.to) ? options.to.join(', ') : options.to;
      const cc = options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined;
      const bcc = options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined;

      const messageParts = [];
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

      // When replying, fetch the original message to get the threadId
      let threadId = undefined;
      if (options.inReplyTo) {
        try {
          const originalMessage = await gmail.users.messages.get({
            userId: 'me',
            id: options.inReplyTo,
            format: 'minimal',
          });
          threadId = originalMessage.data.threadId || undefined;
        } catch (error) {
          // If we can't fetch the original message, Gmail will still auto-thread based on headers
          console.warn('[EmailService] Could not fetch threadId for reply:', error.message);
        }
      }

      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
          threadId: threadId,
        },
      });

      return { success: true, messageId: response.data.id || undefined };
    } catch (error) {
      console.error('[EmailService] Gmail send error:', error);
      
      let errorMessage = error.message || 'Failed to send email via Gmail';
      let retryable = false;
      
      if (error.code === 429 || error.message?.includes('quota') || error.message?.includes('rate limit')) {
        errorMessage = 'Gmail quota exceeded. Please try again later.';
      } else if (error.code === 401 || error.code === 403) {
        errorMessage = 'Authentication failed. Please reconnect your Gmail account.';
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
        errorMessage = 'Connection failed. Please check your internet connection.';
        retryable = true;
      }
      
      return { 
        success: false, 
        error: errorMessage,
        retryable,
      };
    }
  },

  /**
   * Sends email via SMTP (works for Outlook, Gmail, and custom servers)
   */
  sendViaSMTP: async (credentials, options) => {
    try {
      if (!credentials.smtpHost || !credentials.username) {
        throw new Error('SMTP credentials incomplete');
      }

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

      const mailOptions = {
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
    } catch (error) {
      console.error('[EmailService] SMTP send error:', error);
      
      let errorMessage = error.message || 'Failed to send email via SMTP';
      let retryable = false;
      
      if (error.responseCode === 550 || error.message?.includes('quota') || error.message?.includes('limit')) {
        errorMessage = 'Email quota exceeded. Please try again later.';
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        errorMessage = 'Connection failed. Please check your internet connection.';
        retryable = true;
      } else if (error.responseCode === 535 || error.message?.includes('authentication')) {
        errorMessage = 'Authentication failed. Please check your credentials.';
      }
      
      return { 
        success: false, 
        error: errorMessage,
        retryable,
      };
    }
  },

  /**
   * Reads emails via Gmail API
   */
  readViaGmail: async (credentials, maxResults = 10, query, getConfig, loadPlatformConnections, savePlatformConnections) => {
    try {
      const gmail = await getGmailClient(credentials, getConfig, loadPlatformConnections, savePlatformConnections);
      
      // List messages  
      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: query || 'is:unread',
      });

      const messages = [];
      
      if (listResponse.data.messages) {
        for (const msg of listResponse.data.messages) {
          const fullMessage = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'full',
          });

          const payload = fullMessage.data.payload;
          if (!payload) continue;

          const headers = payload.headers || [];
          const getHeader = (name) => 
            headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

          const fromHeader = getHeader('From');
          const toHeader = getHeader('To');
          const subject = getHeader('Subject');
          const dateHeader = getHeader('Date');
          const inReplyTo = getHeader('In-Reply-To');
          const references = getHeader('References');

          // Parse body
          let textBody = '';
          let htmlBody = '';
          
          const parsePart = (part) => {
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
          const parseEmail = (header) => {
            const match = header.match(/(.*?)\s*<(.+?)>/);
            if (match) {
              return { name: match[1].trim(), email: match[2].trim() };
            }
            return { email: header.trim() };
          };

          messages.push({
            id: msg.id,
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
    } catch (error) {
      console.error('[EmailService] Gmail read error:', error);
      
      return { 
        success: false, 
        error: error.message || 'Failed to read emails via Gmail' 
      };
    }
  },

  /**
   * Reads emails via IMAP (works for Outlook, Gmail, and custom servers)
   */
  readViaIMAP: async (credentials, maxResults = 10) => {
    if (!credentials.imapHost || !credentials.username) {
      return { success: false, error: 'IMAP credentials incomplete' };
    }
    
    return new Promise((resolve) => {
      const imap = new Imap({
        user: credentials.username,
        password: credentials.password || '',
        host: credentials.imapHost,
        port: credentials.imapPort || 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
      });

      const messages = [];

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
   * Tests email connection
   */
  testConnection: async (credentials, getConfig) => {
    try {
      if (credentials.provider === 'gmail') {
        try {
          const gmail = await getGmailClient(credentials, getConfig, null, null);
          await gmail.users.getProfile({ userId: 'me' });
          return { success: true };
        } catch (error) {
          return { success: false, error: error.message || 'Gmail connection test failed' };
        }
      } else if (credentials.provider === 'smtp' || credentials.provider === 'imap' || credentials.provider === 'outlook') {
        // Test SMTP connection (for Outlook SMTP/IMAP or custom SMTP)
        if (!credentials.smtpHost || !credentials.username || !credentials.password) {
          return { success: false, error: 'SMTP configuration incomplete' };
        }

        const transporter = nodemailer.createTransport({
          host: credentials.smtpHost,
          port: credentials.smtpPort || 587,
          secure: credentials.smtpPort === 465,
          auth: {
            user: credentials.username,
            pass: credentials.password,
          },
          connectionTimeout: 10000,
          greetingTimeout: 5000,
        });

        await transporter.verify();
        transporter.close();
        return { success: true };
      }
      return { success: false, error: 'Unsupported provider' };
    } catch (error) {
      return { success: false, error: error.message || 'Connection test failed' };
    }
  },
};

module.exports = EmailService;

