/**
 * OAuth Token Cache Service
 * Encrypts and caches OAuth tokens in Redis
 * L3 Cache: Backend Redis for OAuth tokens
 */

const { redis } = require('../config/redis');
const crypto = require('crypto');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Get encryption key from environment
const ENCRYPTION_KEY = process.env.REDIS_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';

/**
 * Derive encryption key from environment variable
 * If not set, generates a key (should be set in production)
 */
function getEncryptionKey() {
  if (!ENCRYPTION_KEY) {
    logger.warn('[OAuthTokenCache] REDIS_ENCRYPTION_KEY not set, using default (not secure for production)');
    // Generate a key from a default (should be overridden in production)
    return crypto.createHash('sha256').update('default-oauth-encryption-key-change-in-production').digest();
  }
  // Use first 32 bytes of SHA256 hash of the key
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
}

/**
 * Encrypt OAuth token data
 */
function encryptToken(data) {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Return encrypted data with IV and auth tag
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
  } catch (error) {
    logger.error('[OAuthTokenCache] Encryption error:', error);
    throw new Error('Failed to encrypt token');
  }
}

/**
 * Decrypt OAuth token data
 */
function decryptToken(encryptedData) {
  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    logger.error('[OAuthTokenCache] Decryption error:', error);
    throw new Error('Failed to decrypt token');
  }
}

/**
 * Generate cache key for OAuth token
 */
function getCacheKey(provider, userId) {
  return `oauth:token:${provider}:${userId}`;
}

/**
 * Cache OAuth tokens
 */
const oauthTokenCache = {
  /**
   * Store OAuth token in encrypted Redis cache
   * @param {string} provider - OAuth provider (gmail, outlook, etc.)
   * @param {string} userId - User ID
   * @param {Object} tokenData - Token data (accessToken, refreshToken, expiresIn, etc.)
   * @param {number} ttl - Time to live in seconds (defaults to token expiry with 5-min buffer)
   */
  async set(provider, userId, tokenData, ttl = null) {
    try {
      if (!redis) {
        logger.warn('[OAuthTokenCache] Redis not available, skipping cache');
        return false;
      }

      const cacheKey = getCacheKey(provider, userId);
      
      // Calculate TTL from token expiry if not provided
      let cacheTTL = ttl;
      if (!cacheTTL && tokenData.expiryDate) {
        const expiryTime = tokenData.expiryDate;
        const now = Date.now();
        const timeUntilExpiry = Math.floor((expiryTime - now) / 1000);
        // Add 5-minute buffer
        cacheTTL = Math.max(300, timeUntilExpiry + 300);
      } else if (!cacheTTL && tokenData.expiresIn) {
        // Add 5-minute buffer
        cacheTTL = tokenData.expiresIn + 300;
      } else if (!cacheTTL) {
        // Default to 1 hour if no expiry info
        cacheTTL = 3600;
      }

      // Encrypt token data
      const encrypted = encryptToken(tokenData);
      
      // Store in Redis
      const cacheData = JSON.stringify(encrypted);
      await redis.setex(cacheKey, cacheTTL, cacheData);
      
      logger.info(`[OAuthTokenCache] Cached token for ${provider}:${userId} (TTL: ${cacheTTL}s)`);
      return true;
    } catch (error) {
      logger.error('[OAuthTokenCache] Failed to cache token:', error);
      return false;
    }
  },

  /**
   * Get OAuth token from cache
   * @param {string} provider - OAuth provider
   * @param {string} userId - User ID
   * @returns {Object|null} Decrypted token data or null if not found
   */
  async get(provider, userId) {
    try {
      if (!redis) {
        return null;
      }

      const cacheKey = getCacheKey(provider, userId);
      const cached = await redis.get(cacheKey);
      
      if (!cached) {
        return null;
      }

      // Decrypt token data
      const encrypted = JSON.parse(cached);
      const decrypted = decryptToken(encrypted);
      
      logger.debug(`[OAuthTokenCache] Cache HIT for ${provider}:${userId}`);
      return decrypted;
    } catch (error) {
      logger.error('[OAuthTokenCache] Failed to get token from cache:', error);
      return null;
    }
  },

  /**
   * Delete OAuth token from cache
   * @param {string} provider - OAuth provider
   * @param {string} userId - User ID
   */
  async delete(provider, userId) {
    try {
      if (!redis) {
        return false;
      }

      const cacheKey = getCacheKey(provider, userId);
      await redis.del(cacheKey);
      
      logger.info(`[OAuthTokenCache] Deleted token cache for ${provider}:${userId}`);
      return true;
    } catch (error) {
      logger.error('[OAuthTokenCache] Failed to delete token from cache:', error);
      return false;
    }
  },

  /**
   * Check if token exists in cache
   * @param {string} provider - OAuth provider
   * @param {string} userId - User ID
   * @returns {boolean}
   */
  async exists(provider, userId) {
    try {
      if (!redis) {
        return false;
      }

      const cacheKey = getCacheKey(provider, userId);
      const exists = await redis.exists(cacheKey);
      return exists === 1;
    } catch (error) {
      logger.error('[OAuthTokenCache] Failed to check token existence:', error);
      return false;
    }
  },
};

module.exports = { oauthTokenCache };

