/**
 * Set tunnel URL in app configuration
 */

const fs = require('fs');
const path = require('path');

const tunnelUrl = process.argv[2];

if (!tunnelUrl) {
  console.error('Usage: node scripts/set-tunnel-url.js <tunnel-url>');
  process.exit(1);
}

// Get config path
const configPath = path.join(
  process.env.APPDATA || 
  (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config'), 
  'GlobalReach', 
  'config.json'
);

// Ensure directory exists
const configDir = path.dirname(configPath);
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

// Read existing config
let config = {};
if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    console.error('Error reading config:', e.message);
  }
}

// Update tunnel URL
config.tunnelUrl = tunnelUrl.replace(/\/$/, ''); // Remove trailing slash

// Write config
try {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log('\n✅ Tunnel URL updated successfully!');
  console.log('   Tunnel URL:', config.tunnelUrl);
  console.log('   Webhook URL:', config.tunnelUrl + '/webhooks/whatsapp');
  console.log('\n📋 Use this webhook URL in Meta Business Manager:');
  console.log('   ' + config.tunnelUrl + '/webhooks/whatsapp');
  console.log('\n💡 Restart the app for changes to take effect.\n');
} catch (e) {
  console.error('Error writing config:', e.message);
  process.exit(1);
}

