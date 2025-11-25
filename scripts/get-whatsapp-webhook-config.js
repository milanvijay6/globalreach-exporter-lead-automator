/**
 * Get WhatsApp Webhook Configuration for Meta Business Manager
 * Run with: node scripts/get-whatsapp-webhook-config.js
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

// Get config path
const configPath = path.join(
  process.env.APPDATA || 
  (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config'), 
  'GlobalReach', 
  'config.json'
);

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
const verifyToken = config.webhookVerifyToken || config.webhookToken || 'globalreach_secret_token';

// Determine webhook URL
let webhookUrl;
let urlType;
if (productionUrl) {
  webhookUrl = `${productionUrl}/webhooks/whatsapp`;
  urlType = 'Production';
} else if (tunnelUrl) {
  webhookUrl = `${tunnelUrl}/webhooks/whatsapp`;
  urlType = 'Tunnel';
} else {
  webhookUrl = `http://localhost:${port}/webhooks/whatsapp`;
  urlType = 'Local (requires tunnel)';
}

console.log('\n' + '='.repeat(60));
console.log('📱 WHATSAPP WEBHOOK CONFIGURATION FOR META');
console.log('='.repeat(60));
console.log('');
console.log('🔗 CALLBACK URL (Webhook URL):');
console.log('   ' + webhookUrl);
console.log('');
console.log('🔑 VERIFY TOKEN:');
console.log('   ' + verifyToken);
console.log('');
console.log('📍 URL TYPE: ' + urlType);
console.log('');

// Important warnings
if (!productionUrl && !tunnelUrl) {
  console.log('⚠️  IMPORTANT: Localhost URLs are NOT publicly accessible!');
  console.log('   Meta requires a publicly accessible HTTPS URL.');
  console.log('');
  console.log('💡 SOLUTION: Use a tunnel service:');
  console.log('   1. Install ngrok: https://ngrok.com/download');
  console.log('   2. Run: ngrok http ' + port);
  console.log('   3. Copy the HTTPS URL (e.g., https://abc123.ngrok.io)');
  console.log('   4. Go to Settings → System → Tunnel URL');
  console.log('   5. Paste the tunnel URL');
  console.log('   6. Update webhook URL in Meta with the new tunnel URL');
  console.log('');
}

console.log('📋 INSTRUCTIONS:');
console.log('   1. Go to Meta Business Manager');
console.log('   2. Navigate to: WhatsApp → Configuration → Webhooks');
console.log('   3. Click "Edit" or "Configure"');
console.log('   4. Enter Callback URL:');
console.log('      ' + webhookUrl);
console.log('   5. Enter Verify Token:');
console.log('      ' + verifyToken);
console.log('   6. Subscribe to webhook fields:');
console.log('      ✅ messages');
console.log('      ✅ message_status');
console.log('   7. Click "Verify and Save"');
console.log('');

// Test if server is running (for localhost)
if (!productionUrl && !tunnelUrl) {
  console.log('🧪 Testing if server is running...');
  const testUrl = `http://localhost:${port}/webhooks/whatsapp`;
  
  const testReq = http.get(testUrl + '?hub.mode=subscribe&hub.verify_token=' + verifyToken + '&hub.challenge=test', (res) => {
    if (res.statusCode === 200) {
      console.log('   ✅ Server is running and responding!');
      console.log('');
    } else {
      console.log('   ⚠️  Server responded with status: ' + res.statusCode);
      console.log('');
    }
  });
  
  testReq.on('error', (err) => {
    console.log('   ❌ Server is NOT running or not accessible!');
    console.log('   Error: ' + err.message);
    console.log('');
    console.log('💡 Make sure the app is running (npm start)');
    console.log('');
  });
  
  testReq.setTimeout(3000, () => {
    testReq.destroy();
    console.log('   ⚠️  Server test timed out');
    console.log('');
  });
} else {
  console.log('💡 TIP: Make sure your server/tunnel is running and accessible');
  console.log('');
}

console.log('='.repeat(60));
console.log('');

