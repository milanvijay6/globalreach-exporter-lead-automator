const Parse = require('parse/node');

// Initialize Parse SDK with Back4App configuration
const APP_ID = process.env.PARSE_APPLICATION_ID || '';
const JS_KEY = process.env.PARSE_JAVASCRIPT_KEY || '';

if (!APP_ID || !JS_KEY) {
  console.warn('⚠️  WARNING: Parse credentials not configured. Set PARSE_APPLICATION_ID and PARSE_JAVASCRIPT_KEY environment variables.');
}

Parse.initialize(APP_ID, JS_KEY);

// Set Parse Server URL (Back4App)
Parse.serverURL = process.env.PARSE_SERVER_URL || 'https://parseapi.back4app.com/';

// Set Master Key for server-side operations (if available)
if (process.env.PARSE_MASTER_KEY) {
  Parse.masterKey = process.env.PARSE_MASTER_KEY;
}

// Enable local datastore (optional, for offline support)
// Parse.enableLocalDatastore();

module.exports = Parse;

