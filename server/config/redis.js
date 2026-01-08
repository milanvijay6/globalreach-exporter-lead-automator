const Redis = require('ioredis');
const { Redis: UpstashRedis } = require('@upstash/redis');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

let redisClient = null;
let useUpstash = false;

/**
 * Initialize Redis client
 * Supports both standard Redis (ioredis) and Upstash Redis (REST API)
 */
function initRedis() {
  // Check for Upstash credentials (REST API)
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Check for standard Redis URL
  const redisUrl = process.env.REDIS_URL;

  if (upstashUrl && upstashToken) {
    // Use Upstash Redis (REST API)
    logger.info('[Redis] Initializing Upstash Redis (REST API)');
    redisClient = new UpstashRedis({
      url: upstashUrl,
      token: upstashToken,
    });
    useUpstash = true;
    logger.info('[Redis] ✅ Upstash Redis connected');
  } else if (redisUrl) {
    // Use standard Redis (ioredis)
    logger.info('[Redis] Initializing standard Redis connection');
    redisClient = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    redisClient.on('connect', () => {
      logger.info('[Redis] ✅ Redis connected');
    });

    redisClient.on('error', (err) => {
      logger.error('[Redis] ❌ Redis connection error:', err.message);
    });

    redisClient.on('ready', () => {
      logger.info('[Redis] ✅ Redis ready');
    });

    // Connect to Redis
    redisClient.connect().catch((err) => {
      logger.warn('[Redis] ⚠️  Redis connection failed, continuing without cache:', err.message);
      redisClient = null;
    });
  } else {
    logger.warn('[Redis] ⚠️  No Redis configuration found. Caching disabled.');
    logger.warn('[Redis] Set REDIS_URL or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN to enable caching');
    return null;
  }

  return redisClient;
}

/**
 * Get Redis client
 */
function getRedis() {
  if (!redisClient) {
    return initRedis();
  }
  return redisClient;
}

/**
 * Redis operations wrapper (handles both ioredis and Upstash)
 */
const redis = {
  /**
   * Get value from Redis
   */
  async get(key) {
    try {
      const client = getRedis();
      if (!client) return null;

      if (useUpstash) {
        return await client.get(key);
      } else {
        return await client.get(key);
      }
    } catch (error) {
      logger.error('[Redis] Get error:', error.message);
      return null;
    }
  },

  /**
   * Set value in Redis
   */
  async set(key, value, ttl = null) {
    try {
      const client = getRedis();
      if (!client) return false;

      if (useUpstash) {
        if (ttl) {
          return await client.set(key, value, { ex: ttl });
        } else {
          return await client.set(key, value);
        }
      } else {
        if (ttl) {
          return await client.setex(key, ttl, value);
        } else {
          return await client.set(key, value);
        }
      }
    } catch (error) {
      logger.error('[Redis] Set error:', error.message);
      return false;
    }
  },

  /**
   * Delete key from Redis
   */
  async del(key) {
    try {
      const client = getRedis();
      if (!client) return false;

      if (useUpstash) {
        return await client.del(key);
      } else {
        return await client.del(key);
      }
    } catch (error) {
      logger.error('[Redis] Delete error:', error.message);
      return false;
    }
  },

  /**
   * Set with expiration (alias for set with TTL)
   */
  async setex(key, ttl, value) {
    return await this.set(key, value, ttl);
  },

  /**
   * Check if key exists
   */
  async exists(key) {
    try {
      const client = getRedis();
      if (!client) return false;

      if (useUpstash) {
        const result = await client.exists(key);
        return result === 1;
      } else {
        const result = await client.exists(key);
        return result === 1;
      }
    } catch (error) {
      logger.error('[Redis] Exists error:', error.message);
      return false;
    }
  },

  /**
   * Get multiple keys
   */
  async mget(keys) {
    try {
      const client = getRedis();
      if (!client) return [];

      if (useUpstash) {
        return await client.mget(...keys);
      } else {
        return await client.mget(...keys);
      }
    } catch (error) {
      logger.error('[Redis] MGet error:', error.message);
      return [];
    }
  },

  /**
   * Set multiple key-value pairs
   */
  async mset(keyValuePairs) {
    try {
      const client = getRedis();
      if (!client) return false;

      if (useUpstash) {
        // Upstash mset format: { key1: value1, key2: value2 }
        return await client.mset(keyValuePairs);
      } else {
        // ioredis mset format: ['key1', 'value1', 'key2', 'value2']
        const flat = Object.entries(keyValuePairs).flat();
        return await client.mset(...flat);
      }
    } catch (error) {
      logger.error('[Redis] MSet error:', error.message);
      return false;
    }
  },

  /**
   * Increment key value
   */
  async incr(key) {
    try {
      const client = getRedis();
      if (!client) return 0;

      if (useUpstash) {
        return await client.incr(key);
      } else {
        return await client.incr(key);
      }
    } catch (error) {
      logger.error('[Redis] Incr error:', error.message);
      return 0;
    }
  },

  /**
   * Set expiration on key
   */
  async expire(key, ttl) {
    try {
      const client = getRedis();
      if (!client) return false;

      if (useUpstash) {
        return await client.expire(key, ttl);
      } else {
        return await client.expire(key, ttl);
      }
    } catch (error) {
      logger.error('[Redis] Expire error:', error.message);
      return false;
    }
  },
};

// Initialize on module load
if (process.env.REDIS_URL || (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)) {
  initRedis();
}

module.exports = {
  redis,
  getRedis,
  initRedis,
};






