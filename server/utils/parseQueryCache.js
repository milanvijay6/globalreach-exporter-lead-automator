/**
 * Parse Query Cache Utility
 * Enables Parse query caching and optimizes query execution
 * L4 Cache: Parse Server built-in query cache
 */

const Parse = require('parse/node');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

/**
 * Execute Parse query with caching enabled
 * Parse Server (Back4App) has built-in query caching that can be enabled
 * by using the cachePolicy option
 * 
 * @param {Parse.Query} query - Parse query object
 * @param {Object} options - Query options
 * @param {string} options.cachePolicy - Cache policy: 'ignoreCache', 'cacheOnly', 'networkOnly', 'cacheElseNetwork', 'networkElseCache', 'cacheThenNetwork'
 * @param {number} options.maxCacheAge - Maximum age of cached results in seconds
 * @returns {Promise<Array>} Query results
 */
async function findWithCache(query, options = {}) {
  const {
    useMasterKey = true,
    cachePolicy = 'cacheElseNetwork', // Use cache if available, otherwise network
    maxCacheAge = 300, // 5 minutes default
  } = options;

  try {
    // Parse Server supports cachePolicy in query options
    // This enables Parse's built-in query cache (L4)
    const queryOptions = {
      useMasterKey,
      // Parse Server cache policy options:
      // - 'ignoreCache': Always fetch from network
      // - 'cacheOnly': Only use cache, fail if not cached
      // - 'networkOnly': Always fetch from network
      // - 'cacheElseNetwork': Use cache if available, otherwise network (default)
      // - 'networkElseCache': Try network first, fallback to cache
      // - 'cacheThenNetwork': Return cache immediately, then update from network
      cachePolicy,
      maxCacheAge,
    };

    const results = await query.find(queryOptions);
    logger.debug(`[ParseQueryCache] Query executed with cache policy: ${cachePolicy}`);
    return results;
  } catch (error) {
    logger.error('[ParseQueryCache] Query execution error:', error);
    throw error;
  }
}

/**
 * Get Parse object by ID with caching
 */
async function getWithCache(ParseClass, objectId, options = {}) {
  const {
    useMasterKey = true,
    cachePolicy = 'cacheElseNetwork',
    maxCacheAge = 300,
  } = options;

  try {
    const query = new Parse.Query(ParseClass);
    query.equalTo('objectId', objectId);

    const queryOptions = {
      useMasterKey,
      cachePolicy,
      maxCacheAge,
    };

    const results = await query.find(queryOptions);
    return results.length > 0 ? results[0] : null;
  } catch (error) {
    logger.error('[ParseQueryCache] Get error:', error);
    throw error;
  }
}

/**
 * Count query results with caching
 */
async function countWithCache(query, options = {}) {
  const {
    useMasterKey = true,
    cachePolicy = 'cacheElseNetwork',
    maxCacheAge = 300,
  } = options;

  try {
    const queryOptions = {
      useMasterKey,
      cachePolicy,
      maxCacheAge,
    };

    const count = await query.count(queryOptions);
    logger.debug(`[ParseQueryCache] Count query executed with cache policy: ${cachePolicy}`);
    return count;
  } catch (error) {
    logger.error('[ParseQueryCache] Count error:', error);
    throw error;
  }
}

/**
 * Helper to create a cached query wrapper
 * This can be used to wrap existing queries with caching
 */
function withCache(query, cachePolicy = 'cacheElseNetwork', maxCacheAge = 300) {
  return {
    find: (options = {}) => findWithCache(query, {
      ...options,
      cachePolicy,
      maxCacheAge,
    }),
    count: (options = {}) => countWithCache(query, {
      ...options,
      cachePolicy,
      maxCacheAge,
    }),
    get: async (objectId, options = {}) => {
      const q = query.clone();
      q.equalTo('objectId', objectId);
      const results = await findWithCache(q, {
        ...options,
        cachePolicy,
        maxCacheAge,
      });
      return results.length > 0 ? results[0] : null;
    },
  };
}

module.exports = {
  findWithCache,
  getWithCache,
  countWithCache,
  withCache,
};

