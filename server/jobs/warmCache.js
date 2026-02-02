const { redis } = require('../config/redis');
const Product = require('../models/Product');
const Config = require('../models/Config');
const Parse = require('parse/node');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

/**
 * Cache Warming Job
 * Runs every 15 minutes
 * Pre-loads frequently accessed data into Redis cache
 */
async function warmCache() {
  logger.info('[WarmCache] Starting cache warming...');

  try {
    if (!redis) {
      logger.warn('[WarmCache] Redis not available, skipping cache warming');
      return { success: false, error: 'Redis not available' };
    }

    let warmed = 0;

    // Warm product catalog (most frequently accessed)
    try {
      const productQuery = new Parse.Query(Product);
      productQuery.limit(100);
      productQuery.descending('createdAt');
      const products = await productQuery.find({ useMasterKey: true });

      const productData = products.map(p => ({
        id: p.id,
        name: p.get('name'),
        description: p.get('description'),
        price: p.get('price'),
        category: p.get('category'),
        tags: p.get('tags') || [],
        photos: p.get('photos') || [],
        status: p.get('status'),
      }));

      const cacheKey = 'cache:/api/products:{"limit":"50","cursor":null}:anonymous';
      await redis.setex(cacheKey, 300, JSON.stringify({
        success: true,
        data: productData,
        pagination: { limit: 50, hasMore: false, nextCursor: null },
      }));

      warmed++;
      logger.info(`[WarmCache] Warmed product catalog (${products.length} products)`);
    } catch (error) {
      logger.warn('[WarmCache] Failed to warm product catalog:', error.message);
    }

    // Warm app configuration
    try {
      const config = await Config.getAll(null, false);
      const cacheKey = 'cache:/api/config:{}:anonymous';
      await redis.setex(cacheKey, 3600, JSON.stringify({
        success: true,
        config,
      }));

      warmed++;
      logger.info('[WarmCache] Warmed app configuration');
    } catch (error) {
      logger.warn('[WarmCache] Failed to warm app configuration:', error.message);
    }

    logger.info(`[WarmCache] Warmed ${warmed} cache entries`);
    return { success: true, warmed };
  } catch (error) {
    logger.error('[WarmCache] Error warming cache:', error);
    throw error;
  }
}

module.exports = {
  warmCache,
};










