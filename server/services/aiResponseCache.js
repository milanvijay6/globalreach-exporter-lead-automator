const crypto = require('crypto');
const { redis } = require('../config/redis');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

const CACHE_TTL = parseInt(process.env.AI_CACHE_TTL || '86400', 10); // 24 hours default
const CACHE_PREFIX = 'ai:prompt:';

/**
 * Normalizes a prompt by removing extra whitespace and normalizing formatting
 */
function normalizePrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return '';
  }
  
  // Remove extra whitespace, normalize line breaks
  return prompt
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

/**
 * Generates a hash key for a prompt
 */
function hashPrompt(prompt) {
  const normalized = normalizePrompt(prompt);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Gets cache key for a prompt
 */
function getCacheKey(prompt) {
  const hash = hashPrompt(prompt);
  return `${CACHE_PREFIX}${hash}`;
}

/**
 * Gets cached AI response for a prompt
 */
async function getCachedResponse(prompt) {
  try {
    if (!prompt || typeof prompt !== 'string') {
      return null;
    }

    const cacheKey = getCacheKey(prompt);
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      try {
        const data = JSON.parse(cached);
        logger.debug(`[AIResponseCache] Cache HIT for prompt hash: ${hashPrompt(prompt).substring(0, 8)}...`);
        return data;
      } catch (parseError) {
        logger.warn('[AIResponseCache] Failed to parse cached response:', parseError.message);
        // Delete corrupted cache entry
        await redis.del(cacheKey);
        return null;
      }
    }
    
    logger.debug(`[AIResponseCache] Cache MISS for prompt hash: ${hashPrompt(prompt).substring(0, 8)}...`);
    return null;
  } catch (error) {
    logger.error('[AIResponseCache] Error getting cached response:', error.message);
    return null;
  }
}

/**
 * Caches an AI response for a prompt
 */
async function cacheResponse(prompt, response, metadata = {}) {
  try {
    if (!prompt || typeof prompt !== 'string') {
      return false;
    }

    const cacheKey = getCacheKey(prompt);
    const cacheData = {
      response,
      metadata: {
        ...metadata,
        cachedAt: Date.now(),
        promptHash: hashPrompt(prompt).substring(0, 16), // Store partial hash for debugging
      }
    };

    const serialized = JSON.stringify(cacheData);
    const result = await redis.setex(cacheKey, CACHE_TTL, serialized);
    
    if (result) {
      logger.debug(`[AIResponseCache] Cached response for prompt hash: ${hashPrompt(prompt).substring(0, 8)}... (TTL: ${CACHE_TTL}s)`);
    }
    
    return result;
  } catch (error) {
    logger.error('[AIResponseCache] Error caching response:', error.message);
    return false;
  }
}

/**
 * Invalidates cache for a specific prompt (by exact match)
 */
async function invalidatePrompt(prompt) {
  try {
    if (!prompt || typeof prompt !== 'string') {
      return false;
    }

    const cacheKey = getCacheKey(prompt);
    const result = await redis.del(cacheKey);
    
    if (result) {
      logger.debug(`[AIResponseCache] Invalidated cache for prompt hash: ${hashPrompt(prompt).substring(0, 8)}...`);
    }
    
    return result > 0;
  } catch (error) {
    logger.error('[AIResponseCache] Error invalidating prompt:', error.message);
    return false;
  }
}

/**
 * Invalidates all AI response caches (use with caution)
 */
async function invalidateAll() {
  try {
    // Note: This is a simple implementation. For production, you might want to use
    // Redis SCAN to find all keys matching the prefix pattern
    logger.warn('[AIResponseCache] Invalidating all AI response caches - this is a destructive operation');
    // In a production system, you'd want to track cache keys or use a pattern-based deletion
    // For now, we'll just log a warning as full invalidation requires Redis SCAN
    return false;
  } catch (error) {
    logger.error('[AIResponseCache] Error invalidating all caches:', error.message);
    return false;
  }
}

/**
 * Gets cache statistics
 */
async function getCacheStats() {
  try {
    // This would require Redis SCAN to count keys with the prefix
    // For now, return basic info
    return {
      ttl: CACHE_TTL,
      prefix: CACHE_PREFIX,
      note: 'Full statistics require Redis SCAN implementation'
    };
  } catch (error) {
    logger.error('[AIResponseCache] Error getting cache stats:', error.message);
    return null;
  }
}

module.exports = {
  getCachedResponse,
  cacheResponse,
  invalidatePrompt,
  invalidateAll,
  getCacheStats,
  hashPrompt,
  normalizePrompt,
  CACHE_TTL,
};

