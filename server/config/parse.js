const Parse = require('parse/node');

/**
 * Validates and initializes Parse SDK with Back4App credentials
 * This module ensures Parse is initialized synchronously when loaded
 */
function initializeParse() {
  const appId = process.env.PARSE_APPLICATION_ID;
  const jsKey = process.env.PARSE_JAVASCRIPT_KEY || '';
  const masterKey = process.env.PARSE_MASTER_KEY;
  const serverURL = process.env.PARSE_SERVER_URL || 'https://parseapi.back4app.com/';

  // Check if Parse is already initialized
  if (Parse.applicationId && Parse.applicationId.trim() !== '') {
    // Already initialized, just ensure master key is set if available
    if (masterKey && !Parse.masterKey) {
      Parse.masterKey = masterKey;
    }
    return true;
  }

  // Validate required environment variables
  if (!appId || appId.trim() === '') {
    console.warn('[Parse Config] ⚠️  PARSE_APPLICATION_ID not set or empty.');
    console.warn('[Parse Config] Parse features (Config API, etc.) will be disabled.');
    console.warn('[Parse Config] To enable Parse:');
    console.warn('[Parse Config]   1. Go to Back4App Dashboard → Your App → App Settings → Environment Variables');
    console.warn('[Parse Config]   2. Add PARSE_APPLICATION_ID with your Back4App Application ID');
    console.warn('[Parse Config]   3. Add PARSE_MASTER_KEY with your Back4App Master Key (optional but recommended)');
    console.warn('[Parse Config]   4. Add PARSE_JAVASCRIPT_KEY with your Back4App JavaScript Key (optional)');
    return false;
  }

  try {
    // Initialize Parse
    Parse.initialize(appId, jsKey);
    Parse.serverURL = serverURL;
    
    // Set master key if available
    if (masterKey) {
      Parse.masterKey = masterKey;
    }

    // Verify initialization succeeded
    if (Parse.applicationId && Parse.applicationId.trim() !== '') {
      console.log('[Parse Config] ✅ Parse initialized successfully');
      console.log(`[Parse Config] Application ID: ${Parse.applicationId.substring(0, 8)}...`);
      console.log(`[Parse Config] Server URL: ${Parse.serverURL}`);
      console.log(`[Parse Config] Master Key: ${Parse.masterKey ? 'Set' : 'Not set (optional)'}`);
      return true;
    } else {
      console.error('[Parse Config] ❌ Parse initialization failed - applicationId not set after initialization');
      return false;
    }
  } catch (error) {
    console.error('[Parse Config] ❌ Failed to initialize Parse:', error.message);
    console.error('[Parse Config] Stack:', error.stack);
    return false;
  }
}

// Initialize Parse immediately when module loads
const isInitialized = initializeParse();

// Export Parse instance and initialization status
module.exports = Parse;
module.exports.isInitialized = isInitialized;
module.exports.initializeParse = initializeParse;








