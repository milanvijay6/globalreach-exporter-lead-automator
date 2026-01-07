/**
 * Azure, Gmail, and Cloudflare Configuration Setup Script
 * Sets Azure OAuth, Gmail OAuth credentials and Cloudflare configuration
 * 
 * Usage: node scripts/set-azure-cloudflare-config.js
 */

const path = require('path');
const fs = require('fs');

// Azure OAuth Configuration (must be provided via environment variables)
const AZURE_CONFIG = {
  clientId: process.env.AZURE_CLIENT_ID || '',
  tenantId: process.env.AZURE_TENANT_ID || '',
  clientSecret: process.env.AZURE_CLIENT_SECRET || '',
  secretId: process.env.AZURE_SECRET_ID || ''
};

// Gmail OAuth Configuration (provide via environment variables)
const GMAIL_CONFIG = {
  clientId: process.env.GMAIL_CLIENT_ID || '',
  clientSecret: process.env.GMAIL_CLIENT_SECRET || ''
};

// Cloudflare Configuration (must be provided via environment variables)
const CLOUDFLARE_CONFIG = {
  apiKey: process.env.CLOUDFLARE_API_TOKEN || '',
  url: process.env.CLOUDFLARE_BASE_URL || process.env.PUBLIC_URL || ''
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
  if (AZURE_CONFIG.clientId && AZURE_CONFIG.clientSecret && AZURE_CONFIG.tenantId) {
    oauthConfig.outlook = {
      clientId: AZURE_CONFIG.clientId,
      clientSecret: AZURE_CONFIG.clientSecret,
      tenantId: AZURE_CONFIG.tenantId
    };
  }

  // Set Gmail OAuth config (only if provided)
  if (GMAIL_CONFIG.clientId && GMAIL_CONFIG.clientSecret) {
    oauthConfig.gmail = {
      clientId: GMAIL_CONFIG.clientId,
      clientSecret: GMAIL_CONFIG.clientSecret
    };
  }

  config.oauthConfig = JSON.stringify(oauthConfig);

  // Also set individual config keys for backward compatibility
  if (AZURE_CONFIG.clientId && AZURE_CONFIG.clientSecret && AZURE_CONFIG.tenantId) {
    config.outlookClientId = AZURE_CONFIG.clientId;
    config.outlookClientSecret = AZURE_CONFIG.clientSecret;
    config.outlookTenantId = AZURE_CONFIG.tenantId;
  }
  if (GMAIL_CONFIG.clientId && GMAIL_CONFIG.clientSecret) {
    config.gmailClientId = GMAIL_CONFIG.clientId;
    config.gmailClientSecret = GMAIL_CONFIG.clientSecret;
  }

  if (AZURE_CONFIG.clientId && AZURE_CONFIG.clientSecret && AZURE_CONFIG.tenantId) {
    console.log('   ✅ Azure Client ID:', AZURE_CONFIG.clientId);
    console.log('   ✅ Azure Tenant ID:', AZURE_CONFIG.tenantId);
    console.log('   ✅ Azure Client Secret: [HIDDEN]');
  } else {
    console.log('   ⚠️  Skipping Azure config: set AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, and AZURE_TENANT_ID env vars.');
  }

  // Set Gmail OAuth configuration
  console.log('');
  console.log('Setting Gmail OAuth Configuration...');
  if (GMAIL_CONFIG.clientId && GMAIL_CONFIG.clientSecret) {
    console.log('   ✅ Gmail Client ID:', GMAIL_CONFIG.clientId);
    console.log('   ✅ Gmail Client Secret: [HIDDEN]');
  } else {
    console.log('   ⚠️  Skipping Gmail config: set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET env vars.');
  }

  // Set Cloudflare configuration
  console.log('');
  console.log('Setting Cloudflare Configuration...');
  
  if (CLOUDFLARE_CONFIG.apiKey && CLOUDFLARE_CONFIG.url) {
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
  } else {
    console.log('   ⚠️  Skipping Cloudflare config: set CLOUDFLARE_API_TOKEN and CLOUDFLARE_BASE_URL env vars.');
  }

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
    if (AZURE_CONFIG.clientId && AZURE_CONFIG.clientSecret && AZURE_CONFIG.tenantId) {
      console.log('   - Client ID:', AZURE_CONFIG.clientId);
      console.log('   - Tenant ID:', AZURE_CONFIG.tenantId);
      console.log('   - Client Secret: [CONFIGURED]');
    } else {
      console.log('   - Not configured (set AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID)');
    }
    console.log('');
    console.log('   Gmail OAuth:');
    if (GMAIL_CONFIG.clientId && GMAIL_CONFIG.clientSecret) {
      console.log('   - Client ID:', GMAIL_CONFIG.clientId);
      console.log('   - Client Secret: [CONFIGURED]');
    } else {
      console.log('   - Not configured (set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET)');
    }
    console.log('');
    console.log('   Cloudflare:');
    if (CLOUDFLARE_CONFIG.apiKey && CLOUDFLARE_CONFIG.url) {
      console.log('   - URL:', CLOUDFLARE_CONFIG.url);
      console.log('   - API Key: [CONFIGURED]');
      if (config.webhookUrl) {
        console.log('   - Webhook URL:', config.webhookUrl);
      }
      if (config.oauthCallbackUrl) {
        console.log('   - OAuth Callback URL:', config.oauthCallbackUrl);
      }
    } else {
      console.log('   - Not configured (set CLOUDFLARE_API_TOKEN and CLOUDFLARE_BASE_URL)');
    }
    console.log('');
    console.log('⚠️  IMPORTANT: Keep secrets out of source control.');
    console.log('   Provide them via environment variables or a secure secrets manager.');
    console.log('');
    console.log('💡 Next Steps:');
    console.log('   1. Restart the app for changes to take effect');
    console.log('   2. Update Azure/Google redirect URIs to match your CLOUDFLARE_BASE_URL (if set)');
    console.log('   3. For Back4App deployment, set CLOUDFLARE_API_TOKEN and AZURE/GMAIL env vars');
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

