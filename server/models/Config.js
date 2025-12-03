const Parse = require('parse/node');

// Ensure Parse is initialized with master key if available
// This is important when Config is used in scripts (like deploy-cloudflare-worker.js)
if (process.env.PARSE_APPLICATION_ID && !Parse.applicationId) {
  Parse.initialize(
    process.env.PARSE_APPLICATION_ID,
    process.env.PARSE_JAVASCRIPT_KEY || ''
  );
  Parse.serverURL = process.env.PARSE_SERVER_URL || 'https://parseapi.back4app.com/';
}

if (process.env.PARSE_MASTER_KEY && !Parse.masterKey) {
  Parse.masterKey = process.env.PARSE_MASTER_KEY;
}

const Config = Parse.Object.extend('Config', {
  // Parse automatically handles objectId, createdAt, updatedAt
}, {
  // Class methods
  async get(key, defaultValue = null) {
    const query = new Parse.Query(Config);
    query.equalTo('key', key);
    const config = await query.first({ useMasterKey: true });
    return config ? config.get('value') : defaultValue;
  },

  async set(key, value) {
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
  },

  async getAll() {
    const query = new Parse.Query(Config);
    const configs = await query.find({ useMasterKey: true });
    const result = {};
    configs.forEach(config => {
      result[config.get('key')] = config.get('value');
    });
    return result;
  }
});

module.exports = Config;






