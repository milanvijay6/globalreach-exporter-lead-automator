import { ApiKey, ApiKeyProvider } from '../types';
import { onKeyChange } from './apiKeyService';
import { Logger } from './loggerService';

/**
 * API Key Cache Service
 * Manages in-memory cache of API keys and handles invalidation
 */

// Cache for decrypted API keys (only for active use)
const decryptedKeyCache = new Map<string, { key: string; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Cache for API key metadata
const keyMetadataCache = new Map<string, ApiKey>();

// Cache invalidation callbacks
type CacheInvalidationCallback = () => void;
const invalidationCallbacks: CacheInvalidationCallback[] = [];

/**
 * Registers a callback to be called when cache is invalidated
 */
export const onCacheInvalidation = (callback: CacheInvalidationCallback): (() => void) => {
  invalidationCallbacks.push(callback);
  return () => {
    const index = invalidationCallbacks.indexOf(callback);
    if (index > -1) {
      invalidationCallbacks.splice(index, 1);
    }
  };
};

/**
 * Invalidates all caches
 */
export const invalidateCache = (reason?: string) => {
  Logger.info(`[ApiKeyCache] Invalidating cache${reason ? `: ${reason}` : ''}`);
  
  decryptedKeyCache.clear();
  keyMetadataCache.clear();
  
  // Notify all registered callbacks
  invalidationCallbacks.forEach(callback => {
    try {
      callback();
    } catch (error) {
      Logger.error('[ApiKeyCache] Error in invalidation callback:', error);
    }
  });
};

/**
 * Caches a decrypted key value (short-lived)
 */
export const cacheDecryptedKey = (keyId: string, decryptedValue: string) => {
  decryptedKeyCache.set(keyId, {
    key: decryptedValue,
    timestamp: Date.now(),
  });
};

/**
 * Gets a cached decrypted key if still valid
 */
export const getCachedDecryptedKey = (keyId: string): string | null => {
  const cached = decryptedKeyCache.get(keyId);
  if (!cached) {
    return null;
  }
  
  // Check if cache is still valid
  if (Date.now() - cached.timestamp > CACHE_TTL_MS) {
    decryptedKeyCache.delete(keyId);
    return null;
  }
  
  return cached.key;
};

/**
 * Caches API key metadata
 */
export const cacheKeyMetadata = (key: ApiKey) => {
  keyMetadataCache.set(key.id, key);
};

/**
 * Gets cached API key metadata
 */
export const getCachedKeyMetadata = (keyId: string): ApiKey | null => {
  return keyMetadataCache.get(keyId) || null;
};

/**
 * Clears cache for a specific key
 */
export const clearKeyCache = (keyId: string) => {
  decryptedKeyCache.delete(keyId);
  keyMetadataCache.delete(keyId);
};

/**
 * Clears cache for all keys of a provider
 */
export const clearProviderCache = (provider: ApiKeyProvider) => {
  keyMetadataCache.forEach((key, keyId) => {
    if (key.provider === provider) {
      decryptedKeyCache.delete(keyId);
      keyMetadataCache.delete(keyId);
    }
  });
};

// Listen for key changes and invalidate cache
onKeyChange((event, keyId, provider) => {
  Logger.debug(`[ApiKeyCache] Key change event: ${event} for key ${keyId}`);
  
  switch (event) {
    case 'deleted':
      clearKeyCache(keyId);
      break;
    case 'revoked':
    case 'rotated':
    case 'updated':
      clearKeyCache(keyId);
      // Also invalidate provider cache to force refresh
      clearProviderCache(provider);
      break;
    case 'created':
      // New key created, no need to clear existing cache
      break;
  }
  
  // Always invalidate to ensure fresh data
  invalidateCache(`Key ${event}: ${keyId}`);
});

