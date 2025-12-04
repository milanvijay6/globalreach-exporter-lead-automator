const Parse = require('parse/node');

// Initialize Parse with Back4App credentials
Parse.initialize(
  process.env.PARSE_APPLICATION_ID || '',
  process.env.PARSE_JAVASCRIPT_KEY || ''
);

// Set server URL
Parse.serverURL = process.env.PARSE_SERVER_URL || 'https://parseapi.back4app.com/';

// Set master key for server-side operations
if (process.env.PARSE_MASTER_KEY) {
  Parse.masterKey = process.env.PARSE_MASTER_KEY;
}

module.exports = Parse;








