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

// Use Config model from server (if available) or Parse directly
let Config;
try {
  // Try to use server Config model first
  Config = require('../server/models/Config');
} catch (error) {
  // Fallback to Parse directly if server model not available
  const Parse = require('parse/node');
  if (process.env.PARSE_APPLICATION_ID && process.env.PARSE_MASTER_KEY) {
    Parse.initialize(
      process.env.PARSE_APPLICATION_ID,
      process.env.PARSE_JAVASCRIPT_KEY || '',
      process.env.PARSE_MASTER_KEY
    );
    Parse.serverURL = process.env.PARSE_SERVER_URL || 'https://parseapi.back4app.com/';
    Parse.masterKey = process.env.PARSE_MASTER_KEY;
  }
  Config = Parse.Object.extend('Config');
}

async function getConfig(key, defaultValue = null) {
  try {
    // If Config has a get method (from server/models/Config.js), use it
    if (typeof Config.get === 'function') {
      return await Config.get(key, defaultValue);
    }
    // Otherwise, use Parse directly
    const Parse = require('parse/node');
    const query = new Parse.Query(Config);
    query.equalTo('key', key);
    const config = await query.first({ useMasterKey: true });
    return config ? config.get('value') : defaultValue;
  } catch (error) {
    console.error(`[Deploy Worker] Failed to get config ${key}:`, error.message);
    return defaultValue;
  }
}

async function setConfig(key, value) {
  try {
    // If Config has a set method (from server/models/Config.js), use it
    if (typeof Config.set === 'function') {
      return await Config.set(key, value);
    }
    // Otherwise, use Parse directly
    const Parse = require('parse/node');
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
    const deployCommand = accountId 
      ? `wrangler deploy --config ${wranglerPath}`
      : `wrangler deploy --config ${wranglerPath}`;

    console.log('[Deploy Worker] Deploying worker...');
    const output = execSync(deployCommand, {
      cwd: workerDir,
      env: {
        ...process.env,
        CLOUDFLARE_API_TOKEN: apiToken,
        CLOUDFLARE_ACCOUNT_ID: accountId || ''
      },
      encoding: 'utf8',
      stdio: 'pipe'
    });

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

