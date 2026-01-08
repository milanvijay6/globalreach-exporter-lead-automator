/**
 * Cache Tag Management Utilities
 * Implements cache tagging for intelligent invalidation
 * L3 Cache: Cache tags for Redis-based cache invalidation
 */

const { redis } = require('../config/redis');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

/**
 * Generate tag key
 */
function getTagKey(tag) {
  return `cache:tag:${tag}`;
}

/**
 * Cache Tag Management
 */
const cacheTags = {
  /**
   * Tag a cache key with one or more tags
   * @param {string} cacheKey - Cache key to tag
   * @param {string|Array<string>} tags - Tag(s) to associate with the key
   */
  async tag(cacheKey, tags) {
    try {
      if (!redis) {
        logger.warn('[CacheTags] Redis not available, skipping tag');
        return false;
      }

      const tagArray = Array.isArray(tags) ? tags : [tags];
      
      for (const tag of tagArray) {
        const tagKey = getTagKey(tag);
        
        // Get existing keys for this tag
        const existing = await redis.get(tagKey);
        const keySet = existing ? new Set(JSON.parse(existing)) : new Set();
        
        // Add new key
        keySet.add(cacheKey);
        
        // Store updated set
        await redis.set(tagKey, JSON.stringify(Array.from(keySet)));
      }
      
      logger.debug(`[CacheTags] Tagged ${cacheKey} with tags: ${tagArray.join(', ')}`);
      return true;
    } catch (error) {
      logger.error('[CacheTags] Failed to tag cache key:', error);
      return false;
    }
  },

  /**
   * Invalidate all cache keys with a specific tag
   * @param {string|Array<string>} tags - Tag(s) to invalidate
   * @returns {number} Number of keys invalidated
   */
  async invalidateByTag(tags) {
    try {
      if (!redis) {
        logger.warn('[CacheTags] Redis not available, skipping invalidation');
        return 0;
      }

      const tagArray = Array.isArray(tags) ? tags : [tags];
      let totalInvalidated = 0;
      
      for (const tag of tagArray) {
        const tagKey = getTagKey(tag);
        
        // Get all keys for this tag
        const keysJson = await redis.get(tagKey);
        if (!keysJson) {
          continue;
        }
        
        const keys = JSON.parse(keysJson);
        
        // Delete all tagged keys
        if (keys.length > 0) {
          // Use pipeline for batch deletion if available
          if (redis.pipeline) {
            const pipeline = redis.pipeline();
            keys.forEach(key => pipeline.del(key));
            await pipeline.exec();
          } else {
            // Fallback: delete one by one
            for (const key of keys) {
              await redis.del(key);
            }
          }
          
          totalInvalidated += keys.length;
        }
        
        // Delete the tag itself
        await redis.del(tagKey);
        
        logger.info(`[CacheTags] Invalidated ${keys.length} keys for tag: ${tag}`);
      }
      
      return totalInvalidated;
    } catch (error) {
      logger.error('[CacheTags] Failed to invalidate by tag:', error);
      return 0;
    }
  },

  /**
   * Remove a tag from a cache key
   * @param {string} cacheKey - Cache key
   * @param {string|Array<string>} tags - Tag(s) to remove
   */
  async untag(cacheKey, tags) {
    try {
      if (!redis) {
        return false;
      }

      const tagArray = Array.isArray(tags) ? tags : [tags];
      
      for (const tag of tagArray) {
        const tagKey = getTagKey(tag);
        
        // Get existing keys for this tag
        const existing = await redis.get(tagKey);
        if (!existing) {
          continue;
        }
        
        const keySet = new Set(JSON.parse(existing));
        keySet.delete(cacheKey);
        
        // Update or delete tag
        if (keySet.size > 0) {
          await redis.set(tagKey, JSON.stringify(Array.from(keySet)));
        } else {
          await redis.del(tagKey);
        }
      }
      
      logger.debug(`[CacheTags] Untagged ${cacheKey} from tags: ${tagArray.join(', ')}`);
      return true;
    } catch (error) {
      logger.error('[CacheTags] Failed to untag:', error);
      return false;
    }
  },

  /**
   * Get all tags for a cache key
   * @param {string} cacheKey - Cache key
   * @returns {Array<string>} Array of tags
   */
  async getTags(cacheKey) {
    try {
      if (!redis) {
        return [];
      }

      // This is inefficient - would need to scan all tags
      // For production, consider using Redis Sets with SADD/SMEMBERS
      // For now, return empty array (tags are stored in tag->keys mapping, not key->tags)
      logger.warn('[CacheTags] getTags not fully implemented - would require scanning all tags');
      return [];
    } catch (error) {
      logger.error('[CacheTags] Failed to get tags:', error);
      return [];
    }
  },

  /**
   * Get all cache keys for a tag
   * @param {string} tag - Tag name
   * @returns {Array<string>} Array of cache keys
   */
  async getKeysByTag(tag) {
    try {
      if (!redis) {
        return [];
      }

      const tagKey = getTagKey(tag);
      const keysJson = await redis.get(tagKey);
      
      if (!keysJson) {
        return [];
      }
      
      return JSON.parse(keysJson);
    } catch (error) {
      logger.error('[CacheTags] Failed to get keys by tag:', error);
      return [];
    }
  },
};

module.exports = { cacheTags };

