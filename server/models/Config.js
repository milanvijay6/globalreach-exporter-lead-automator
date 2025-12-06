const Parse = require('parse/node');

// Import Parse config to ensure initialization
// This ensures Parse is initialized before Config operations
let parseConfig;
try {
  parseConfig = require('../config/parse');
} catch (error) {
  console.error('[Config] Failed to load Parse config:', error);
}

// Track if we've logged the initialization warning to reduce log noise
let hasLoggedInitWarning = false;

// Helper function to check if Parse is initialized
function isParseInitialized() {
  // Check if Parse has a valid application ID (not empty string)
  return Parse.applicationId && Parse.applicationId.trim() !== '';
}

// Helper function to ensure Parse is initialized before using it
function ensureParseInitialized() {
  // If already initialized, return true
  if (isParseInitialized()) {
    return true;
  }

  // Try to initialize if we have the required environment variable
  if (process.env.PARSE_APPLICATION_ID && process.env.PARSE_APPLICATION_ID.trim() !== '') {
    try {
    Parse.initialize(
      process.env.PARSE_APPLICATION_ID,
      process.env.PARSE_JAVASCRIPT_KEY || ''
    );
    Parse.serverURL = process.env.PARSE_SERVER_URL || 'https://parseapi.back4app.com/';
    if (process.env.PARSE_MASTER_KEY) {
      Parse.masterKey = process.env.PARSE_MASTER_KEY;
    }
      
      // Verify initialization succeeded
      if (isParseInitialized()) {
        return true;
      }
    } catch (error) {
      // Initialization failed, will return false below
      console.error('[Config] Failed to initialize Parse:', error.message);
    }
  }
  
  // Log warning only once to reduce log noise
  if (!hasLoggedInitWarning) {
    console.warn('[Config] ⚠️  Parse not initialized. Config operations will return default values.');
    console.warn('[Config] Set PARSE_APPLICATION_ID in Back4App environment variables to enable Config API.');
    hasLoggedInitWarning = true;
  }
  
  return false;
}

const Config = Parse.Object.extend('Config', {
  // Parse automatically handles objectId, createdAt, updatedAt
}, {
  // Class methods
  /**
   * Get config value (user-specific or global)
   * @param {string} key - Config key
   * @param {any} defaultValue - Default value if not found
   * @param {string|null} userId - Optional user ID for user-specific config
   * @param {boolean} useMasterKey - Whether to use master key (default: false, uses user context)
   */
  async get(key, defaultValue = null, userId = null, useMasterKey = false) {
    // If Parse is not initialized, return default value silently
    // (Warning is logged once by ensureParseInitialized to reduce log noise)
    if (!ensureParseInitialized()) {
      return defaultValue;
    }
    
    try {
    // Try user-specific config first if userId is provided
    if (userId) {
      const userKey = `config_${userId}_${key}`;
      const query = new Parse.Query(Config);
      query.equalTo('key', userKey);
      const config = await query.first({ useMasterKey });
      if (config) {
        return config.get('value');
      }
      
      // Fallback to global config for migration
      const globalQuery = new Parse.Query(Config);
      globalQuery.equalTo('key', key);
      const globalConfig = await globalQuery.first({ useMasterKey });
      if (globalConfig) {
        // Migrate global config to user-specific
        const value = globalConfig.get('value');
        await Config.set(key, value, userId, useMasterKey);
        return value;
      }
    }
    
    // Try global config
    const query = new Parse.Query(Config);
    query.equalTo('key', key);
    const config = await query.first({ useMasterKey });
    return config ? config.get('value') : defaultValue;
    } catch (error) {
      console.error(`[Config] Error getting config for key ${key}:`, error);
      return defaultValue;
    }
  },

  /**
   * Set config value (user-specific or global)
   * @param {string} key - Config key
   * @param {any} value - Config value
   * @param {string|null} userId - Optional user ID for user-specific config
   * @param {boolean} useMasterKey - Whether to use master key (default: false)
   */
  async set(key, value, userId = null, useMasterKey = false) {
    // If Parse is not initialized, return false silently
    // (Warning is logged once by ensureParseInitialized to reduce log noise)
    if (!ensureParseInitialized()) {
      return false;
    }
    
    try {
    // Use user-specific key if userId is provided
    const configKey = userId ? `config_${userId}_${key}` : key;
    
    const query = new Parse.Query(Config);
    query.equalTo('key', configKey);
    let config = await query.first({ useMasterKey });
    
    if (config) {
      config.set('value', value);
    } else {
      config = new Config();
      config.set('key', configKey);
      config.set('value', value);
    }
    
    await config.save(null, { useMasterKey });
    return true;
    } catch (error) {
      console.error(`[Config] Error setting config for key ${key}:`, error);
      return false;
    }
  },

  /**
   * Get all configs for a user (or global if no userId)
   * @param {string|null} userId - Optional user ID
   * @param {boolean} useMasterKey - Whether to use master key
   */
  async getAll(userId = null, useMasterKey = false) {
    // If Parse is not initialized, return empty object silently
    // (Warning is logged once by ensureParseInitialized to reduce log noise)
    if (!ensureParseInitialized()) {
      return {};
    }
    
    try {
    const query = new Parse.Query(Config);
    
    if (userId) {
      // Get user-specific configs
      query.startsWith('key', `config_${userId}_`);
    }
    // If no userId, we'll get all and filter for global ones
    
    const configs = await query.find({ useMasterKey });
    const result = {};
    
    configs.forEach(config => {
      const key = config.get('key');
      // Filter: if userId provided, only include user-specific; otherwise only global
      if (userId) {
        if (key.startsWith(`config_${userId}_`)) {
          // Remove user prefix for result
          const cleanKey = key.replace(`config_${userId}_`, '');
          result[cleanKey] = config.get('value');
        }
      } else {
        // Only include global configs (not user-specific - those start with "config_")
        // Global configs don't have the "config_" prefix pattern
        if (!key.startsWith('config_') || key === 'config_') {
          result[key] = config.get('value');
        }
      }
    });
    
    return result;
    } catch (error) {
      console.error(`[Config] Error getting all configs for userId ${userId || 'global'}:`, error);
      return {};
    }
  }
});

module.exports = Config;
