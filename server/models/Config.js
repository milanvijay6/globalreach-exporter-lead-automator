const Parse = require('../config/parse');

/**
 * Config Model - Replaces config.json file storage
 * Stores application configuration in Parse Database
 */
class Config extends Parse.Object {
  constructor() {
    super('Config');
  }

  // Static methods for config operations
  static async get(key, defaultValue = null) {
    try {
      const query = new Parse.Query(Config);
      query.equalTo('key', key);
      const result = await query.first({ useMasterKey: true });
      return result ? result.get('value') : defaultValue;
    } catch (error) {
      console.error('Error getting config:', error);
      return defaultValue;
    }
  }

  static async set(key, value) {
    try {
      const query = new Parse.Query(Config);
      query.equalTo('key', key);
      let config = await query.first({ useMasterKey: true });
      
      if (config) {
        config.set('value', value);
        await config.save(null, { useMasterKey: true });
      } else {
        config = new Config();
        config.set('key', key);
        config.set('value', value);
        await config.save(null, { useMasterKey: true });
      }
      return true;
    } catch (error) {
      console.error('Error setting config:', error);
      return false;
    }
  }

  static async getAll() {
    try {
      const query = new Parse.Query(Config);
      const results = await query.find({ useMasterKey: true });
      const config = {};
      results.forEach(item => {
        config[item.get('key')] = item.get('value');
      });
      return config;
    } catch (error) {
      console.error('Error getting all config:', error);
      return {};
    }
  }

  static async delete(key) {
    try {
      const query = new Parse.Query(Config);
      query.equalTo('key', key);
      const result = await query.first({ useMasterKey: true });
      if (result) {
        await result.destroy({ useMasterKey: true });
      }
      return true;
    } catch (error) {
      console.error('Error deleting config:', error);
      return false;
    }
  }
}

Parse.Object.registerSubclass('Config', Config);

module.exports = Config;

