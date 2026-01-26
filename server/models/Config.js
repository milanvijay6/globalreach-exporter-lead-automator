const { getDatabase } = require('../config/database');
const { ObjectId } = require('mongodb');

/**
 * Config Model - MongoDB implementation
 * Manages application configuration (user-specific and global)
 */
class Config {
  /**
   * Get config value (user-specific or global)
   * @param {string} key - Config key
   * @param {any} defaultValue - Default value if not found
   * @param {string|null} userId - Optional user ID for user-specific config
   * @param {boolean} useMasterKey - Kept for API compatibility (not used in MongoDB)
   */
  static async get(key, defaultValue = null, userId = null, useMasterKey = false) {
    const db = getDatabase();
    if (!db) {
      return defaultValue;
    }

    try {
      const collection = db.collection('Config');
      
      // Try user-specific config first if userId is provided
      if (userId) {
        const userKey = `config_${userId}_${key}`;
        const userConfig = await collection.findOne({ key: userKey });
        
        if (userConfig) {
          return userConfig.value;
        }
        
        // Fallback to global config for migration
        const globalConfig = await collection.findOne({ key });
        if (globalConfig) {
          // Migrate global config to user-specific
          await Config.set(key, globalConfig.value, userId, useMasterKey);
          return globalConfig.value;
        }
      } else {
        // Try global config
        const config = await collection.findOne({ key });
        return config ? config.value : defaultValue;
      }
      
      return defaultValue;
    } catch (error) {
      console.error(`[Config] Error getting config for key ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Set config value (user-specific or global)
   * @param {string} key - Config key
   * @param {any} value - Config value
   * @param {string|null} userId - Optional user ID for user-specific config
   * @param {boolean} useMasterKey - Kept for API compatibility
   */
  static async set(key, value, userId = null, useMasterKey = false) {
    const db = getDatabase();
    if (!db) {
      return false;
    }

    try {
      const collection = db.collection('Config');
      
      // Use user-specific key if userId is provided
      const configKey = userId ? `config_${userId}_${key}` : key;
      
      const result = await collection.updateOne(
        { key: configKey },
        { 
          $set: { 
            value,
            updatedAt: new Date()
          },
          $setOnInsert: {
            createdAt: new Date()
          }
        },
        { upsert: true }
      );
      
      return true;
    } catch (error) {
      console.error(`[Config] Error setting config for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get all configs for a user (or global if no userId)
   * @param {string|null} userId - Optional user ID
   * @param {boolean} useMasterKey - Kept for API compatibility
   */
  static async getAll(userId = null, useMasterKey = false) {
    const db = getDatabase();
    if (!db) {
      return {};
    }

    try {
      const collection = db.collection('Config');
      let query = {};
      
      if (userId) {
        // Get user-specific configs
        query = { key: { $regex: `^config_${userId}_` } };
      } else {
        // Get global configs (those that don't start with 'config_')
        query = { key: { $not: { $regex: '^config_' } } };
      }
      
      const configs = await collection.find(query).toArray();
      const result = {};
      
      configs.forEach(config => {
        const key = config.key;
        
        if (userId) {
          // Remove user prefix for result
          const cleanKey = key.replace(`config_${userId}_`, '');
          result[cleanKey] = config.value;
        } else {
          result[key] = config.value;
        }
      });
      
      return result;
    } catch (error) {
      console.error(`[Config] Error getting all configs for userId ${userId || 'global'}:`, error);
      return {};
    }
  }
}

module.exports = Config;
