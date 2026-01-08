/**
 * Product Catalog Cache Service
 * In-memory cache for product catalog with 5-minute TTL
 * L3 Cache: In-memory cache for frequently accessed product data
 */

const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// In-memory cache: Map<userId, { data: Array, expiresAt: number }>
const productCache = new Map();

// Cache TTL: 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Generate cache key
 */
function getCacheKey(userId) {
  return `product:catalog:${userId || 'global'}`;
}

/**
 * Check if cache entry is valid
 */
function isCacheValid(entry) {
  if (!entry) return false;
  return Date.now() < entry.expiresAt;
}

/**
 * Product Catalog Cache Service
 */
const productCatalogCache = {
  /**
   * Get products from cache
   * @param {string} userId - User ID (optional, for user-specific catalogs)
   * @returns {Array|null} Cached products or null if not found/expired
   */
  get(userId = null) {
    try {
      const key = getCacheKey(userId);
      const entry = productCache.get(key);
      
      if (!isCacheValid(entry)) {
        // Remove expired entry
        if (entry) {
          productCache.delete(key);
        }
        return null;
      }
      
      logger.debug(`[ProductCatalogCache] Cache HIT for ${key}`);
      return entry.data;
    } catch (error) {
      logger.error('[ProductCatalogCache] Failed to get from cache:', error);
      return null;
    }
  },

  /**
   * Set products in cache
   * @param {Array} products - Product array
   * @param {string} userId - User ID (optional)
   */
  set(products, userId = null) {
    try {
      const key = getCacheKey(userId);
      const entry = {
        data: products,
        expiresAt: Date.now() + CACHE_TTL_MS,
      };
      
      productCache.set(key, entry);
      logger.debug(`[ProductCatalogCache] Cached ${products.length} products for ${key}`);
    } catch (error) {
      logger.error('[ProductCatalogCache] Failed to set cache:', error);
    }
  },

  /**
   * Invalidate cache for user
   * @param {string} userId - User ID (optional, null invalidates all)
   */
  invalidate(userId = null) {
    try {
      if (userId === null) {
        // Invalidate all product caches
        const keysToDelete = [];
        for (const key of productCache.keys()) {
          if (key.startsWith('product:catalog:')) {
            keysToDelete.push(key);
          }
        }
        keysToDelete.forEach(key => productCache.delete(key));
        logger.info(`[ProductCatalogCache] Invalidated all product caches (${keysToDelete.length} entries)`);
      } else {
        const key = getCacheKey(userId);
        productCache.delete(key);
        logger.info(`[ProductCatalogCache] Invalidated cache for ${key}`);
      }
    } catch (error) {
      logger.error('[ProductCatalogCache] Failed to invalidate cache:', error);
    }
  },

  /**
   * Clear all product caches
   */
  clear() {
    try {
      const keysToDelete = [];
      for (const key of productCache.keys()) {
        if (key.startsWith('product:catalog:')) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => productCache.delete(key));
      logger.info(`[ProductCatalogCache] Cleared all product caches (${keysToDelete.length} entries)`);
    } catch (error) {
      logger.error('[ProductCatalogCache] Failed to clear cache:', error);
    }
  },

  /**
   * Get cache statistics
   */
  getStats() {
    const stats = {
      totalEntries: 0,
      validEntries: 0,
      expiredEntries: 0,
      memoryUsage: 0,
    };

    try {
      for (const [key, entry] of productCache.entries()) {
        if (key.startsWith('product:catalog:')) {
          stats.totalEntries++;
          if (isCacheValid(entry)) {
            stats.validEntries++;
            // Rough estimate of memory usage
            stats.memoryUsage += JSON.stringify(entry.data).length;
          } else {
            stats.expiredEntries++;
          }
        }
      }
    } catch (error) {
      logger.error('[ProductCatalogCache] Failed to get stats:', error);
    }

    return stats;
  },

  /**
   * Clean up expired entries (should be called periodically)
   */
  cleanup() {
    try {
      const now = Date.now();
      const keysToDelete = [];
      
      for (const [key, entry] of productCache.entries()) {
        if (key.startsWith('product:catalog:') && now >= entry.expiresAt) {
          keysToDelete.push(key);
        }
      }
      
      keysToDelete.forEach(key => productCache.delete(key));
      
      if (keysToDelete.length > 0) {
        logger.info(`[ProductCatalogCache] Cleaned up ${keysToDelete.length} expired entries`);
      }
    } catch (error) {
      logger.error('[ProductCatalogCache] Failed to cleanup:', error);
    }
  },
};

// Cleanup expired entries every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    productCatalogCache.cleanup();
  }, 10 * 60 * 1000);
}

module.exports = { productCatalogCache };

