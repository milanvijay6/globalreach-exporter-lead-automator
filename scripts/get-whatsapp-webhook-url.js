/**
 * Quick script to get the WhatsApp Webhook URL
 * Run with: node scripts/get-whatsapp-webhook-url.js
 */

const fs = require('fs');
const path = require('path');

// Get config path
const configPath = path.join(process.env.APPDATA || 
  (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config'), 
  'GlobalReach', 'config.json');

let config = {};
if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    console.error('Error reading config:', e.message);
  }
}

const port = config.serverPort || 4000;
const tunnelUrl = config.tunnelUrl || '';
const productionUrl = config.productionWebhookUrl || '';

let webhookUrl;
if (productionUrl) {
  webhookUrl = `${productionUrl}/webhooks/whatsapp`;
} else if (tunnelUrl) {
  webhookUrl = `${tunnelUrl}/webhooks/whatsapp`;
} else {
  webhookUrl = `http://localhost:${port}/webhooks/whatsapp`;
}

console.log('\n📱 WhatsApp Webhook URL:');
console.log('');
console.log(webhookUrl);
console.log('');
console.log('📋 Copy this URL and configure it in:');
console.log('   Meta Business Manager → WhatsApp → Configuration → Webhooks');
console.log('');
console.log('💡 Tip: For local development, use a tunnel service (ngrok) to make');
console.log('   localhost accessible. Then update the Tunnel URL in Settings.');
console.log('');

