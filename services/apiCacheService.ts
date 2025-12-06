/**
 * API Cache Service
 * Caches API responses in IndexedDB for offline support and performance
 */

import { IndexedDBService } from './indexedDBService';

const DEFAULT_TTL = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_STORE = 'apiCache';

interface CacheEntry {
  id: string;
  url: string;
  method: string;
  response: any;
  headers: Record<string, string>;
  status: number;
  statusText: string;
  timestamp: number;
  expiresAt: number;
}

// Request deduplication map
const pendingRequests = new Map<string, Promise<any>>();

/**
 * Generate cache key from URL and method
 */
function getCacheKey(url: string, method: string = 'GET'): string {
  return `${method}:${url}`;
}

/**
 * Check if cache entry is still valid
 */
function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() < entry.expiresAt;
}

/**
 * Get cached response
 */
export async function getCachedResponse<T>(
  url: string,
  method: string = 'GET',
  ttl: number = DEFAULT_TTL
): Promise<T | null> {
  try {
    const key = getCacheKey(url, method);
    const entry = await IndexedDBService.get<CacheEntry>(CACHE_STORE, key);

    if (!entry) {
      return null;
    }

    if (!isCacheValid(entry)) {
      // Cache expired, remove it
      await IndexedDBService.remove(CACHE_STORE, key);
      return null;
    }

    return entry.response as T;
  } catch (error) {
    console.warn('[APICacheService] Failed to get cached response:', error);
    return null;
  }
}

/**
 * Cache API response
 */
export async function cacheResponse<T>(
  url: string,
  method: string,
  response: T,
  headers: Record<string, string> = {},
  status: number = 200,
  statusText: string = 'OK',
  ttl: number = DEFAULT_TTL
): Promise<void> {
  try {
    const key = getCacheKey(url, method);
    const entry: CacheEntry = {
      id: key,
      url,
      method,
      response,
      headers,
      status,
      statusText,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl
    };

    await IndexedDBService.put(CACHE_STORE, entry);
  } catch (error) {
    console.warn('[APICacheService] Failed to cache response:', error);
  }
}

/**
 * Invalidate cache for URL pattern
 */
export async function invalidateCache(
  urlPattern: string | RegExp
): Promise<void> {
  try {
    const allEntries = await IndexedDBService.getAll<CacheEntry>(CACHE_STORE);
    const toDelete: string[] = [];

    allEntries.forEach(entry => {
      const matches = typeof urlPattern === 'string'
        ? entry.url.includes(urlPattern)
        : urlPattern.test(entry.url);

      if (matches) {
        toDelete.push(entry.id);
      }
    });

    if (toDelete.length > 0) {
      await IndexedDBService.remove(CACHE_STORE, toDelete);
    }
  } catch (error) {
    console.warn('[APICacheService] Failed to invalidate cache:', error);
  }
}

/**
 * Clear all cache
 */
export async function clearCache(): Promise<void> {
  try {
    await IndexedDBService.clear(CACHE_STORE);
  } catch (error) {
    console.warn('[APICacheService] Failed to clear cache:', error);
  }
}

/**
 * Request deduplication - returns same promise if same request is in flight
 */
export function deduplicateRequest<T>(
  url: string,
  method: string,
  requestFn: () => Promise<T>
): Promise<T> {
  const key = getCacheKey(url, method);

  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)!;
  }

  const promise = requestFn().finally(() => {
    pendingRequests.delete(key);
  });

  pendingRequests.set(key, promise);
  return promise;
}

/**
 * Cached fetch wrapper
 */
export async function cachedFetch<T>(
  url: string,
  options: RequestInit = {},
  ttl?: number
): Promise<T> {
  const method = options.method || 'GET';
  
  // Only cache GET requests
  if (method === 'GET') {
    // Check cache first
    const cached = await getCachedResponse<T>(url, method, ttl);
    if (cached !== null) {
      return cached;
    }
  }

  // Deduplicate requests
  return deduplicateRequest(url, method, async () => {
    const response = await fetch(url, options);
    const data = await response.json();

    // Cache successful GET responses
    if (method === 'GET' && response.ok) {
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      await cacheResponse(
        url,
        method,
        data,
        headers,
        response.status,
        response.statusText,
        ttl
      );
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return data;
  });
}

