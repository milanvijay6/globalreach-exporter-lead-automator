/**
 * Email Configuration Setup Script
 * Configures Outlook email account for GlobalReach
 * 
 * Usage: node scripts/setup-email-config.js
 * 
 * This script helps configure email credentials programmatically.
 * For production, use the app UI instead for security.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Email configuration
const EMAIL_CONFIG = {
  email: 'Shreenathjimarketingassociate@outlook.com',
  password: 'vijayvargiya@24',
  smtpHost: 'smtp-mail.outlook.com',
  smtpPort: 587,
  imapHost: 'outlook.office365.com',
  imapPort: 993,
  provider: 'imap' // Use 'imap' to support both sending and reading
};

// Simple encryption (in production, use proper encryption)
function encrypt(text, key = 'globalreach_secret_key') {
  const cipher = crypto.createCipheriv('aes-256-cbc', 
    crypto.scryptSync(key, 'salt', 32), 
    Buffer.alloc(16, 0)
  );
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

function createEmailConnection() {
  const connection = {
    channel: 'Email',
    status: 'Connected',
    accountName: EMAIL_CONFIG.email,
    connectedAt: Date.now(),
    provider: 'microsoft',
    lastTested: Date.now(),
    healthStatus: 'healthy',
    emailCredentials: {
      provider: EMAIL_CONFIG.provider,
      username: EMAIL_CONFIG.email,
      password: EMAIL_CONFIG.password, // In production, this should be encrypted
      smtpHost: EMAIL_CONFIG.smtpHost,
      smtpPort: EMAIL_CONFIG.smtpPort,
      imapHost: EMAIL_CONFIG.imapHost,
      imapPort: EMAIL_CONFIG.imapPort
    }
  };

  return connection;
}

function generateConfigInstructions() {
  const config = `
# Email Configuration Instructions

## Your Email Account Details

Email: ${EMAIL_CONFIG.email}
Password: ${EMAIL_CONFIG.password}

## Server Configuration

### SMTP (Outgoing Mail Server)
- Server: ${EMAIL_CONFIG.smtpHost}
- Port: ${EMAIL_CONFIG.smtpPort}
- Encryption: STARTTLS
- Authentication: Required

### IMAP (Incoming Mail Server)
- Server: ${EMAIL_CONFIG.imapHost}
- Port: ${EMAIL_CONFIG.imapPort}
- Encryption: SSL/TLS
- Authentication: Required

## How to Configure in GlobalReach App

1. Open GlobalReach application
2. Go to Settings → Platforms → Connect Email
3. Select "Custom" provider
4. Click "Outlook.com" preset button (or fill manually)
5. Enter:
   - Email Address: ${EMAIL_CONFIG.email}
   - SMTP Host: ${EMAIL_CONFIG.smtpHost}
   - SMTP Port: ${EMAIL_CONFIG.smtpPort}
   - IMAP Host: ${EMAIL_CONFIG.imapHost}
   - IMAP Port: ${EMAIL_CONFIG.imapPort}
   - Password: ${EMAIL_CONFIG.password}
6. Click "Test & Connect"

## Quick Copy-Paste Configuration

Email Address: ${EMAIL_CONFIG.email}
SMTP Host: ${EMAIL_CONFIG.smtpHost}
SMTP Port: ${EMAIL_CONFIG.smtpPort}
IMAP Host: ${EMAIL_CONFIG.imapHost}
IMAP Port: ${EMAIL_CONFIG.imapPort}
Password: ${EMAIL_CONFIG.password}
`;

  return config;
}

// Main function
function main() {
  console.log('='.repeat(60));
  console.log('GlobalReach Email Configuration Helper');
  console.log('='.repeat(60));
  console.log('');
  console.log('Email Account:', EMAIL_CONFIG.email);
  console.log('');
  console.log('Server Configuration:');
  console.log(`  SMTP: ${EMAIL_CONFIG.smtpHost}:${EMAIL_CONFIG.smtpPort}`);
  console.log(`  IMAP: ${EMAIL_CONFIG.imapHost}:${EMAIL_CONFIG.imapPort}`);
  console.log('');
  
  // Generate instructions file
  const instructionsPath = path.join(__dirname, '..', 'EMAIL_CONFIG_INSTRUCTIONS.txt');
  const instructions = generateConfigInstructions();
  
  try {
    fs.writeFileSync(instructionsPath, instructions, 'utf8');
    console.log(`✅ Configuration instructions saved to: ${instructionsPath}`);
    console.log('');
    console.log('Next Steps:');
    console.log('1. Open the GlobalReach app');
    console.log('2. Go to Settings → Platforms');
    console.log('3. Click "Connect" next to Email');
    console.log('4. Select "Custom" provider');
    console.log('5. Use the configuration details above');
    console.log('');
    console.log('Or use the preset button: Click "Outlook.com" then fill in your email and password');
    console.log('');
  } catch (error) {
    console.error('Error saving instructions:', error.message);
  }
  
  console.log('='.repeat(60));
}

if (require.main === module) {
  main();
}

module.exports = { EMAIL_CONFIG, createEmailConnection, generateConfigInstructions };

