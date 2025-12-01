const Parse = require('../config/parse');
const crypto = require('crypto');

/**
 * Integration Model - Stores OAuth tokens and integration configurations
 * Uses encrypted fields for sensitive data
 */
class Integration extends Parse.Object {
  constructor() {
    super('Integration');
  }

  // Simple encryption/decryption helpers
  static encrypt(text, secret) {
    if (!text || !secret) return text;
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(secret, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  static decrypt(encryptedText, secret) {
    if (!encryptedText || !secret) return encryptedText;
    try {
      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync(secret, 'salt', 32);
      const parts = encryptedText.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      return encryptedText;
    }
  }

  static async get(service, userId = null) {
    try {
      const query = new Parse.Query(Integration);
      query.equalTo('service', service);
      if (userId) {
        query.equalTo('userId', userId);
      }
      const result = await query.first({ useMasterKey: true });
      if (!result) return null;
      
      const data = result.toJSON();
      const secret = process.env.ENCRYPTION_KEY_SECRET || 'shreenathji_secret';
      
      // Decrypt sensitive fields
      if (data.accessToken) {
        data.accessToken = Integration.decrypt(data.accessToken, secret);
      }
      if (data.refreshToken) {
        data.refreshToken = Integration.decrypt(data.refreshToken, secret);
      }
      if (data.clientSecret) {
        data.clientSecret = Integration.decrypt(data.clientSecret, secret);
      }
      
      return data;
    } catch (error) {
      console.error('Error getting integration:', error);
      return null;
    }
  }

  static async set(service, data, userId = null) {
    try {
      const query = new Parse.Query(Integration);
      query.equalTo('service', service);
      if (userId) {
        query.equalTo('userId', userId);
      }
      let integration = await query.first({ useMasterKey: true });
      
      const secret = process.env.ENCRYPTION_KEY_SECRET || 'shreenathji_secret';
      
      if (integration) {
        Object.keys(data).forEach(key => {
          let value = data[key];
          // Encrypt sensitive fields
          if (['accessToken', 'refreshToken', 'clientSecret'].includes(key) && value) {
            value = Integration.encrypt(value, secret);
          }
          integration.set(key, value);
        });
        await integration.save(null, { useMasterKey: true });
      } else {
        integration = new Integration();
        integration.set('service', service);
        if (userId) {
          integration.set('userId', userId);
        }
        Object.keys(data).forEach(key => {
          let value = data[key];
          // Encrypt sensitive fields
          if (['accessToken', 'refreshToken', 'clientSecret'].includes(key) && value) {
            value = Integration.encrypt(value, secret);
          }
          integration.set(key, value);
        });
        await integration.save(null, { useMasterKey: true });
      }
      return true;
    } catch (error) {
      console.error('Error setting integration:', error);
      return false;
    }
  }

  static async delete(service, userId = null) {
    try {
      const query = new Parse.Query(Integration);
      query.equalTo('service', service);
      if (userId) {
        query.equalTo('userId', userId);
      }
      const result = await query.first({ useMasterKey: true });
      if (result) {
        await result.destroy({ useMasterKey: true });
      }
      return true;
    } catch (error) {
      console.error('Error deleting integration:', error);
      return false;
    }
  }

  static async getAll(userId = null) {
    try {
      const query = new Parse.Query(Integration);
      if (userId) {
        query.equalTo('userId', userId);
      }
      const results = await query.find({ useMasterKey: true });
      return results.map(r => r.toJSON());
    } catch (error) {
      console.error('Error getting all integrations:', error);
      return [];
    }
  }
}

Parse.Object.registerSubclass('Integration', Integration);

module.exports = Integration;

