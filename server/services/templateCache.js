/**
 * Template Cache Service
 * Caches compiled email/WhatsApp templates
 * L3 Cache: In-memory cache for compiled templates
 */

const crypto = require('crypto');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// In-memory cache: Map<templateKey, { compiled: string, expiresAt: number }>
const templateCache = new Map();

// Cache TTL: 1 hour (templates don't change frequently)
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Generate hash from template content
 */
function hashTemplate(templateId, templateContent, variables = {}) {
  const content = `${templateId}:${JSON.stringify(templateContent)}:${JSON.stringify(variables)}`;
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * Generate cache key
 */
function getCacheKey(templateId, hash) {
  return `template:compiled:${templateId}:${hash}`;
}

/**
 * Check if cache entry is valid
 */
function isCacheValid(entry) {
  if (!entry) return false;
  return Date.now() < entry.expiresAt;
}

/**
 * Compile template (placeholder - replace with actual template compilation logic)
 */
function compileTemplate(templateContent, variables = {}) {
  // Simple template compilation - replace {{variable}} with values
  let compiled = templateContent;
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    compiled = compiled.replace(regex, String(value || ''));
  }
  
  return compiled;
}

/**
 * Template Cache Service
 */
const templateCacheService = {
  /**
   * Get compiled template from cache or compile and cache it
   * @param {string} templateId - Template identifier
   * @param {string} templateContent - Raw template content
   * @param {Object} variables - Template variables to replace
   * @returns {string} Compiled template
   */
  getCompiled(templateId, templateContent, variables = {}) {
    try {
      // Generate hash for this template + variables combination
      const hash = hashTemplate(templateId, templateContent, variables);
      const key = getCacheKey(templateId, hash);
      
      // Check cache
      const entry = templateCache.get(key);
      if (isCacheValid(entry)) {
        logger.debug(`[TemplateCache] Cache HIT for ${templateId}:${hash}`);
        return entry.compiled;
      }
      
      // Compile template
      const compiled = compileTemplate(templateContent, variables);
      
      // Cache it
      templateCache.set(key, {
        compiled,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      
      logger.debug(`[TemplateCache] Compiled and cached ${templateId}:${hash}`);
      return compiled;
    } catch (error) {
      logger.error('[TemplateCache] Failed to get compiled template:', error);
      // Fallback to compilation without caching
      return compileTemplate(templateContent, variables);
    }
  },

  /**
   * Invalidate cache for a specific template
   * @param {string} templateId - Template identifier
   */
  invalidate(templateId) {
    try {
      const keysToDelete = [];
      for (const key of templateCache.keys()) {
        if (key.startsWith(`template:compiled:${templateId}:`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => templateCache.delete(key));
      logger.info(`[TemplateCache] Invalidated ${keysToDelete.length} entries for template ${templateId}`);
    } catch (error) {
      logger.error('[TemplateCache] Failed to invalidate:', error);
    }
  },

  /**
   * Clear all template caches
   */
  clear() {
    try {
      const keysToDelete = [];
      for (const key of templateCache.keys()) {
        if (key.startsWith('template:compiled:')) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => templateCache.delete(key));
      logger.info(`[TemplateCache] Cleared all template caches (${keysToDelete.length} entries)`);
    } catch (error) {
      logger.error('[TemplateCache] Failed to clear cache:', error);
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
    };

    try {
      for (const [key, entry] of templateCache.entries()) {
        if (key.startsWith('template:compiled:')) {
          stats.totalEntries++;
          if (isCacheValid(entry)) {
            stats.validEntries++;
          } else {
            stats.expiredEntries++;
          }
        }
      }
    } catch (error) {
      logger.error('[TemplateCache] Failed to get stats:', error);
    }

    return stats;
  },

  /**
   * Clean up expired entries
   */
  cleanup() {
    try {
      const now = Date.now();
      const keysToDelete = [];
      
      for (const [key, entry] of templateCache.entries()) {
        if (key.startsWith('template:compiled:') && now >= entry.expiresAt) {
          keysToDelete.push(key);
        }
      }
      
      keysToDelete.forEach(key => templateCache.delete(key));
      
      if (keysToDelete.length > 0) {
        logger.info(`[TemplateCache] Cleaned up ${keysToDelete.length} expired entries`);
      }
    } catch (error) {
      logger.error('[TemplateCache] Failed to cleanup:', error);
    }
  },
};

// Cleanup expired entries every 30 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    templateCacheService.cleanup();
  }, 30 * 60 * 1000);
}

module.exports = { templateCacheService };

