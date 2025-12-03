/**
 * Deploy Cloudflare Worker for OAuth Callback Proxy
 * 
 * This script:
 * 1. Detects Back4App URL
 * 2. Updates worker configuration
 * 3. Deploys worker using Wrangler
 * 4. Stores worker URL in Parse Config
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { getBack4AppUrl } = require('./get-back4app-url');

// Initialize Parse FIRST with master key before loading Config model
const Parse = require('parse/node');

// Check for required Parse environment variables
const parseAppId = process.env.PARSE_APPLICATION_ID;
const parseMasterKey = process.env.PARSE_MASTER_KEY;
const parseJSKey = process.env.PARSE_JAVASCRIPT_KEY || '';
const parseServerURL = process.env.PARSE_SERVER_URL || 'https://parseapi.back4app.com/';

if (!parseAppId) {
  console.warn('[Deploy Worker] Warning: PARSE_APPLICATION_ID not set');
}

if (!parseMasterKey) {
  console.error('[Deploy Worker] ERROR: PARSE_MASTER_KEY not set!');
  console.error('[Deploy Worker] The deployment script requires PARSE_MASTER_KEY to access Parse Config.');
  console.error('[Deploy Worker] Please add PARSE_MASTER_KEY to your Back4App environment variables.');
}

// Initialize Parse with master key
if (parseAppId) {
  Parse.initialize(parseAppId, parseJSKey, parseMasterKey);
  Parse.serverURL = parseServerURL;
  if (parseMasterKey) {
    Parse.masterKey = parseMasterKey;
    console.log('[Deploy Worker] Parse initialized with master key');
  } else {
    console.warn('[Deploy Worker] Parse initialized without master key - Config operations will fail');
  }
}

// Now load Config model (it will use the initialized Parse instance)
let Config;
try {
  // Try to use server Config model first
  Config = require('../server/models/Config');
  console.log('[Deploy Worker] Using server Config model');
} catch (error) {
  // Fallback to Parse directly if server model not available
  console.log('[Deploy Worker] Using Parse Config directly');
  Config = Parse.Object.extend('Config');
}

async function getConfig(key, defaultValue = null) {
  try {
    // Check if master key is available
    if (!Parse.masterKey) {
      console.warn(`[Deploy Worker] Cannot get config ${key}: Master key not set`);
      return defaultValue;
    }

    // If Config has a get method (from server/models/Config.js), use it
    if (typeof Config.get === 'function') {
      return await Config.get(key, defaultValue);
    }
    // Otherwise, use Parse directly
    const query = new Parse.Query(Config);
    query.equalTo('key', key);
    const config = await query.first({ useMasterKey: true });
    return config ? config.get('value') : defaultValue;
  } catch (error) {
    console.error(`[Deploy Worker] Failed to get config ${key}:`, error.message);
    if (error.message.includes('Master Key')) {
      console.error(`[Deploy Worker] Make sure PARSE_MASTER_KEY is set in environment variables`);
    }
    return defaultValue;
  }
}

async function setConfig(key, value) {
  try {
    // Check if master key is available
    if (!Parse.masterKey) {
      const error = new Error('Cannot use the Master Key, it has not been provided. Please set PARSE_MASTER_KEY environment variable.');
      console.error(`[Deploy Worker] Failed to set config ${key}:`, error.message);
      throw error;
    }

    // If Config has a set method (from server/models/Config.js), use it
    if (typeof Config.set === 'function') {
      return await Config.set(key, value);
    }
    // Otherwise, use Parse directly
    const query = new Parse.Query(Config);
    query.equalTo('key', key);
    let config = await query.first({ useMasterKey: true });
    
    if (config) {
      config.set('value', value);
    } else {
      config = new Config();
      config.set('key', key);
      config.set('value', value);
    }
    
    await config.save(null, { useMasterKey: true });
    return true;
  } catch (error) {
    console.error(`[Deploy Worker] Failed to set config ${key}:`, error.message);
    if (error.message.includes('Master Key')) {
      console.error(`[Deploy Worker] Make sure PARSE_MASTER_KEY is set in Back4App environment variables`);
      console.error(`[Deploy Worker] Go to: Back4App Dashboard → Your App → App Settings → Environment Variables`);
    }
    throw error;
  }
}

async function deployWorker() {
  try {
    console.log('[Deploy Worker] Starting Cloudflare Worker deployment...');

    // Check for Cloudflare credentials
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

    if (!apiToken) {
      console.warn('[Deploy Worker] CLOUDFLARE_API_TOKEN not set. Skipping deployment.');
      console.warn('[Deploy Worker] Worker deployment requires Cloudflare API token.');
      return null;
    }

    // Check if wrangler is available
    try {
      const { execSync } = require('child_process');
      execSync('wrangler --version', { stdio: 'ignore' });
    } catch (error) {
      console.warn('[Deploy Worker] Wrangler CLI not available. Skipping deployment.');
      return null;
    }

    // Get Back4App URL
    const back4appUrl = getBack4AppUrl();
    console.log('[Deploy Worker] Back4App URL:', back4appUrl);

    // Get or generate worker name
    let workerName = await getConfig('cloudflareWorkerName');
    if (!workerName) {
      // Generate unique worker name
      const timestamp = Date.now();
      workerName = `shreenathji-oauth-${timestamp}`;
      await setConfig('cloudflareWorkerName', workerName);
      console.log('[Deploy Worker] Generated new worker name:', workerName);
    } else {
      console.log('[Deploy Worker] Using existing worker name:', workerName);
    }

    // Update wrangler.toml with Back4App URL
    const wranglerPath = path.join(__dirname, '..', 'cloudflare-worker', 'wrangler.toml');
    if (fs.existsSync(wranglerPath)) {
      let wranglerContent = fs.readFileSync(wranglerPath, 'utf8');
      
      // Update worker name
      wranglerContent = wranglerContent.replace(/name = ".*"/, `name = "${workerName}"`);
      
      // Update Back4App URL
      wranglerContent = wranglerContent.replace(
        /BACK4APP_BASE_URL = ".*"/,
        `BACK4APP_BASE_URL = "${back4appUrl}"`
      );
      
      // Update account ID if provided
      if (accountId) {
        if (wranglerContent.includes('[env.production]')) {
          // Add account_id to existing env section
          wranglerContent = wranglerContent.replace(
            /\[env.production\]/,
            `[env.production]\naccount_id = "${accountId}"`
          );
        } else {
          // Add account_id at top level
          wranglerContent = wranglerContent.replace(
            /compatibility_date = ".*"/,
            `compatibility_date = "2024-01-01"\naccount_id = "${accountId}"`
          );
        }
      }
      
      fs.writeFileSync(wranglerPath, wranglerContent);
      console.log('[Deploy Worker] Updated wrangler.toml');
    }

    // Deploy worker using Wrangler
    const workerDir = path.join(__dirname, '..', 'cloudflare-worker');
    
    // Check if worker directory exists
    if (!fs.existsSync(workerDir)) {
      console.warn('[Deploy Worker] Cloudflare worker directory not found. Skipping deployment.');
      return null;
    }

    const deployCommand = `wrangler deploy --config ${wranglerPath}`;

    console.log('[Deploy Worker] Deploying worker...');
    let output;
    try {
      output = execSync(deployCommand, {
        cwd: workerDir,
        env: {
          ...process.env,
          CLOUDFLARE_API_TOKEN: apiToken,
          CLOUDFLARE_ACCOUNT_ID: accountId || ''
        },
        encoding: 'utf8',
        stdio: 'pipe',
        timeout: 60000 // 60 second timeout
      });
    } catch (error) {
      console.error('[Deploy Worker] Wrangler deployment failed:', error.message);
      if (error.stdout) console.error('[Deploy Worker] stdout:', error.stdout);
      if (error.stderr) console.error('[Deploy Worker] stderr:', error.stderr);
      return null;
    }

    // Extract worker URL from output
    // Wrangler output format: "✨  Deployed to https://worker-name.account.workers.dev"
    const urlMatch = output.match(/https:\/\/[^\s]+\.workers\.dev/);
    if (urlMatch) {
      const workerUrl = urlMatch[0];
      console.log('[Deploy Worker] Worker deployed successfully:', workerUrl);
      
      // Store worker URL in Parse Config
      await setConfig('cloudflareWorkerUrl', workerUrl);
      console.log('[Deploy Worker] Worker URL stored in Parse Config');
      
      return workerUrl;
    } else {
      console.error('[Deploy Worker] Could not extract worker URL from output');
      console.error('[Deploy Worker] Output:', output);
      return null;
    }
  } catch (error) {
    console.error('[Deploy Worker] Deployment failed:', error.message);
    if (error.stdout) console.error('[Deploy Worker] stdout:', error.stdout);
    if (error.stderr) console.error('[Deploy Worker] stderr:', error.stderr);
    throw error;
  }
}

// If run directly, deploy worker
if (require.main === module) {
  deployWorker()
    .then((url) => {
      if (url) {
        console.log('\n✅ Worker deployed successfully!');
        console.log('Worker URL:', url);
        process.exit(0);
      } else {
        console.log('\n⚠️  Worker deployment skipped (no credentials)');
        process.exit(0);
      }
    })
    .catch((error) => {
      console.error('\n❌ Worker deployment failed:', error.message);
      process.exit(1);
    });
}

module.exports = { deployWorker };

