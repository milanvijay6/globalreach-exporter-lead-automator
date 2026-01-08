const { redis } = require('../config/redis');
const { cacheTags } = require('../utils/cacheTags');
const crypto = require('crypto');

/**
 * Generate cache key from request
 */
function generateCacheKey(req) {
  const path = req.path;
  const query = JSON.stringify(req.query);
  const userId = req.userId || 'anonymous';
  const hash = crypto.createHash('md5').update(`${path}:${query}:${userId}`).digest('hex');
  return `cache:${path}:${hash}`;
}

/**
 * Cache middleware for GET requests
 * Checks Redis cache before executing route handler
 * Supports cache tags for intelligent invalidation
 * @param {number} ttl - Time to live in seconds
 * @param {string|Array<string>} tags - Optional cache tags for invalidation
 */
function cacheMiddleware(ttl = 300, tags = null) {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = generateCacheKey(req);
    
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        res.setHeader('X-Cache', 'HIT');
        return res.json(data);
      }
    } catch (error) {
      // If cache fails, continue without cache
      console.warn('[Cache] Cache read error:', error.message);
    }

    // Store cache key and tags in res.locals for later caching
    res.locals.cacheKey = cacheKey;
    res.locals.cacheTTL = ttl;
    res.locals.cacheTags = tags;
    res.setHeader('X-Cache', 'MISS');
    
    // Override res.json to cache response
    const originalJson = res.json;
    res.json = function(data) {
      // Cache the response
      if (res.locals.cacheKey && res.statusCode === 200) {
        cacheResponse(req, res, data, res.locals.cacheTTL, res.locals.cacheTags).catch(err => {
          console.warn('[Cache] Cache write error:', err.message);
        });
      }
      return originalJson.call(this, data);
    };

    next();
  };
}

/**
 * Cache response data with optional tags
 */
async function cacheResponse(req, res, data, ttl = 300, tags = null) {
  if (!res.locals.cacheKey) return;
  
  try {
    const cacheData = JSON.stringify(data);
    await redis.setex(res.locals.cacheKey, ttl, cacheData);
    
    // Tag the cache entry if tags provided
    if (tags) {
      await cacheTags.tag(res.locals.cacheKey, tags);
    }
  } catch (error) {
    console.warn('[Cache] Failed to cache response:', error.message);
  }
}

/**
 * Invalidate cache by pattern
 */
async function invalidateCache(pattern) {
  try {
    // Note: This is a simplified version
    // For production, use SCAN with pattern matching
    const keys = pattern.split('*');
    if (keys.length === 1) {
      // Exact key
      await redis.del(pattern);
    } else {
      // Pattern matching would require SCAN, which Upstash doesn't support directly
      // For now, we'll handle specific invalidation patterns
      console.warn('[Cache] Pattern invalidation not fully supported, use specific keys');
    }
  } catch (error) {
    console.warn('[Cache] Cache invalidation error:', error.message);
  }
}

/**
 * Invalidate cache by tag(s)
 * Uses cacheTags utility for intelligent invalidation
 */
async function invalidateByTag(tags) {
  try {
    return await cacheTags.invalidateByTag(tags);
  } catch (error) {
    console.warn('[Cache] Tag invalidation error:', error.message);
    return 0;
  }
}

module.exports = {
  cacheMiddleware,
  cacheResponse,
  invalidateCache,
  invalidateByTag,
  generateCacheKey,
};



