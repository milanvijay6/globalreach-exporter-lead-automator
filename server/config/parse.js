const Parse = require('parse/node');

// Initialize Parse with Back4App credentials only if PARSE_APPLICATION_ID is set
// This prevents initializing with empty strings which causes issues
if (process.env.PARSE_APPLICATION_ID && process.env.PARSE_APPLICATION_ID.trim() !== '') {
  Parse.initialize(
    process.env.PARSE_APPLICATION_ID,
    process.env.PARSE_JAVASCRIPT_KEY || ''
  );
  
  // Set server URL
  Parse.serverURL = process.env.PARSE_SERVER_URL || 'https://parseapi.back4app.com/';
  
  // Set master key for server-side operations
  if (process.env.PARSE_MASTER_KEY) {
    Parse.masterKey = process.env.PARSE_MASTER_KEY;
  }
} else {
  // Log warning but don't throw - allows server to start without Parse
  console.warn('[Parse Config] PARSE_APPLICATION_ID not set. Parse features will be disabled.');
}

module.exports = Parse;








