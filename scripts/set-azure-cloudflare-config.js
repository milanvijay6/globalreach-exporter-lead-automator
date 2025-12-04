/**
 * Azure, Gmail, and Cloudflare Configuration Setup Script
 * Sets Azure OAuth, Gmail OAuth credentials and Cloudflare configuration
 * 
 * Usage: node scripts/set-azure-cloudflare-config.js
 */

const path = require('path');
const fs = require('fs');

// Azure OAuth Configuration
const AZURE_CONFIG = {
  clientId: '649aa87d-4799-466b-ae15-078049518573',
  tenantId: 'e87ff696-4a5a-4482-aec1-3ad475608ee1',
  clientSecret: 'qke8Q~Ie5CeQlTfogCm147w.rF~Axl~8mWYb5c8r',
  secretId: '6a7e6b99-8edc-4d0e-81cc-d881ac3fa6e1' // For reference
};

// Gmail OAuth Configuration
const GMAIL_CONFIG = {
  clientId: '393499424376-424k11sm0pij9a49v02atceotjh5f091.apps.googleusercontent.com',
  clientSecret: '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'
};

// Cloudflare Configuration
const CLOUDFLARE_CONFIG = {
  apiKey: 'TMBjozKlShmeEytu93qfEYfpIZzWuix2DgVwDvpO',
  url: 'globalreach-exporter-lead-automator.duckdns.org'
};

// Get config path (Electron app config location)
function getConfigPath() {
  const configPath = path.join(
    process.env.APPDATA || 
    (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config'), 
    'GlobalReach', 
    'config.json'
  );
  return configPath;
}

// Main function
function main() {
  console.log('='.repeat(60));
  console.log('Azure, Gmail & Cloudflare Configuration Setup');
  console.log('='.repeat(60));
  console.log('');

  const configPath = getConfigPath();
  const configDir = path.dirname(configPath);

  // Ensure directory exists
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
    console.log(`✅ Created config directory: ${configDir}`);
  }

  // Read existing config
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      console.log(`✅ Loaded existing config from: ${configPath}`);
    } catch (e) {
      console.warn(`⚠️  Error reading existing config: ${e.message}`);
      console.log('   Creating new config file...');
    }
  } else {
    console.log(`📝 Creating new config file: ${configPath}`);
  }

  // Set Azure OAuth configuration
  console.log('');
  console.log('Setting Azure OAuth Configuration...');
  
  // Load or create oauthConfig
  let oauthConfig = {};
  if (config.oauthConfig) {
    try {
      oauthConfig = typeof config.oauthConfig === 'string' 
        ? JSON.parse(config.oauthConfig) 
        : config.oauthConfig;
    } catch (e) {
      console.warn('   ⚠️  Error parsing existing oauthConfig, creating new one');
      oauthConfig = {};
    }
  }

  // Set Outlook OAuth config
  oauthConfig.outlook = {
    clientId: AZURE_CONFIG.clientId,
    clientSecret: AZURE_CONFIG.clientSecret,
    tenantId: AZURE_CONFIG.tenantId
  };

  // Set Gmail OAuth config
  oauthConfig.gmail = {
    clientId: GMAIL_CONFIG.clientId,
    clientSecret: GMAIL_CONFIG.clientSecret
  };

  config.oauthConfig = JSON.stringify(oauthConfig);

  // Also set individual config keys for backward compatibility
  config.outlookClientId = AZURE_CONFIG.clientId;
  config.outlookClientSecret = AZURE_CONFIG.clientSecret;
  config.outlookTenantId = AZURE_CONFIG.tenantId;
  config.gmailClientId = GMAIL_CONFIG.clientId;
  config.gmailClientSecret = GMAIL_CONFIG.clientSecret;

  console.log('   ✅ Azure Client ID:', AZURE_CONFIG.clientId);
  console.log('   ✅ Azure Tenant ID:', AZURE_CONFIG.tenantId);
  console.log('   ✅ Azure Client Secret: [HIDDEN]');

  // Set Gmail OAuth configuration
  console.log('');
  console.log('Setting Gmail OAuth Configuration...');
  console.log('   ✅ Gmail Client ID:', GMAIL_CONFIG.clientId);
  console.log('   ✅ Gmail Client Secret: [HIDDEN]');

  // Set Cloudflare configuration
  console.log('');
  console.log('Setting Cloudflare Configuration...');
  
  // Set Cloudflare URL (ensure it has protocol)
  let cloudflareUrl = CLOUDFLARE_CONFIG.url;
  if (!cloudflareUrl.startsWith('http://') && !cloudflareUrl.startsWith('https://')) {
    cloudflareUrl = `https://${cloudflareUrl}`;
  }
  
  config.cloudflareUrl = cloudflareUrl;
  config.cloudflareApiKey = CLOUDFLARE_CONFIG.apiKey;
  
  // Also set related URLs
  config.webhookUrl = `${cloudflareUrl}/webhooks/whatsapp`;
  config.oauthCallbackUrl = `${cloudflareUrl}/api/oauth/callback`;

  console.log('   ✅ Cloudflare URL:', cloudflareUrl);
  console.log('   ✅ Cloudflare API Key: [HIDDEN]');
  console.log('   ✅ Webhook URL:', config.webhookUrl);
  console.log('   ✅ OAuth Callback URL:', config.oauthCallbackUrl);

  // Write config
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('');
    console.log('✅ Configuration saved successfully!');
    console.log('');
    console.log('📋 Configuration Summary:');
    console.log('   Config file:', configPath);
    console.log('');
    console.log('   Azure OAuth:');
    console.log('   - Client ID:', AZURE_CONFIG.clientId);
    console.log('   - Tenant ID:', AZURE_CONFIG.tenantId);
    console.log('   - Client Secret: [CONFIGURED]');
    console.log('');
    console.log('   Gmail OAuth:');
    console.log('   - Client ID:', GMAIL_CONFIG.clientId);
    console.log('   - Client Secret: [CONFIGURED]');
    console.log('');
    console.log('   Cloudflare:');
    console.log('   - URL:', cloudflareUrl);
    console.log('   - API Key: [CONFIGURED]');
    console.log('   - Webhook URL:', config.webhookUrl);
    console.log('   - OAuth Callback URL:', config.oauthCallbackUrl);
    console.log('');
    console.log('⚠️  IMPORTANT: Cloudflare API Key');
    console.log('   For server-side usage, also set as environment variable:');
    console.log(`   CLOUDFLARE_API_TOKEN=${CLOUDFLARE_CONFIG.apiKey}`);
    console.log('');
    console.log('💡 Next Steps:');
    console.log('   1. Restart the app for changes to take effect');
    console.log('   2. Update Azure Portal redirect URI to:');
    console.log(`      ${config.oauthCallbackUrl}`);
    console.log('   3. Update Google Cloud Console redirect URI to:');
    console.log(`      ${config.oauthCallbackUrl}`);
    console.log('   4. For Back4App deployment, set CLOUDFLARE_API_TOKEN environment variable');
    console.log('');
  } catch (e) {
    console.error('');
    console.error('❌ Error saving config:', e.message);
    process.exit(1);
  }

  console.log('='.repeat(60));
}

if (require.main === module) {
  main();
}

module.exports = { AZURE_CONFIG, GMAIL_CONFIG, CLOUDFLARE_CONFIG, getConfigPath };

