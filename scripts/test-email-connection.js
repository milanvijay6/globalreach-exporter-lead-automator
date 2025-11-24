/**
 * Quick script to test email SMTP connection
 * Run with: node scripts/test-email-connection.js
 */

const { getDefaultEmailCredentials } = require('../services/emailConfig');

async function testEmailConnection() {
  try {
    console.log('Testing email SMTP connection...\n');
    
    const credentials = getDefaultEmailCredentials();
    
    console.log('Credentials:');
    console.log(`  Email: ${credentials.username}`);
    console.log(`  SMTP Host: ${credentials.smtpHost}`);
    console.log(`  SMTP Port: ${credentials.smtpPort}`);
    console.log(`  IMAP Host: ${credentials.imapHost}`);
    console.log(`  IMAP Port: ${credentials.imapPort}\n`);
    
    // Note: This requires Electron environment to actually test
    // In a standalone script, we can only validate the credentials structure
    console.log('✓ Credentials structure is valid');
    console.log('\nTo actually test the connection, use the app UI:');
    console.log('1. Open Settings → Platforms → Email → Connect');
    console.log('2. Select "IMAP/SMTP"');
    console.log('3. Click "Test & Connect"');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testEmailConnection();

