/**
 * API Service for making REST API calls to the backend server
 * Includes caching, batching, and request deduplication
 */

import { getCachedResponse, cacheResponse, invalidateCache, cachedFetch } from './apiCacheService';
import { batchedFetch, immediateFetch } from './apiBatchService';
import { LoadingService } from './loadingService';

// Detect if running on Cloudflare Pages
const isCloudflarePages = typeof window !== 'undefined' && 
  (window.location.hostname.includes('pages.dev') || 
   window.location.hostname.includes('cloudflarepages.com'));

// Use relative URLs for Cloudflare Pages (middleware will proxy to Back4App)
// Otherwise use explicit API URL or empty string for relative URLs
const API_BASE_URL = process.env.REACT_APP_API_URL || (isCloudflarePages ? '' : '');
const REQUEST_TIMEOUT = 30000; // 30 seconds

class ApiService {
  private getHeaders(): HeadersInit {
    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Add Parse session token if available
    const sessionToken = localStorage.getItem('parse_session_token');
    if (sessionToken) {
      defaultHeaders['X-Parse-Session-Token'] = sessionToken;
    }

    // Add user ID from session if available
    try {
      const sessionData = localStorage.getItem('web_secure_globalreach_user_session');
      if (sessionData) {
        const parsed = JSON.parse(atob(sessionData));
        if (parsed && parsed.user && parsed.user.id) {
          defaultHeaders['X-User-Id'] = parsed.user.id;
        }
      }
    } catch (error) {
      // Ignore errors getting user ID
    }

    return defaultHeaders;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    useCache: boolean = true,
    useBatch: boolean = true
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const method = options.method || 'GET';
    const isGet = method === 'GET';
    const taskId = `api_${method}_${endpoint}_${Date.now()}`;

    // Check cache for GET requests
    if (isGet && useCache) {
      const cached = await getCachedResponse<T>(url, method);
      if (cached !== null) {
        return cached;
      }
    }

    // Start loading tracking
    LoadingService.start(taskId, `${method} ${endpoint}`);

    // Prepare request options
    const requestOptions: RequestInit = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    };

    // Add timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    requestOptions.signal = controller.signal;

    const startTime = Date.now();

    try {
      // Use batched fetch for non-critical requests, immediate for critical
      const response = useBatch && isGet
        ? await batchedFetch<T>(url, requestOptions)
        : await immediateFetch<T>(url, requestOptions);

      clearTimeout(timeoutId);

      // Cache successful GET responses
      if (isGet && useCache && response) {
        await cacheResponse(url, method, response);
      }

      // Complete loading
      LoadingService.complete(taskId);

      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);

      // Stop loading on error
      LoadingService.stop(taskId);

      // Don't cache errors
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  async get<T>(endpoint: string, useCache: boolean = true, useBatch: boolean = true): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' }, useCache, useBatch);
  }

  async post<T>(endpoint: string, data?: any, invalidateCachePattern?: string | RegExp): Promise<T> {
    // Invalidate cache if pattern provided
    if (invalidateCachePattern) {
      await invalidateCache(invalidateCachePattern);
    }

    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }, false, false); // POST requests don't use cache or batching
  }

  async put<T>(endpoint: string, data?: any, invalidateCachePattern?: string | RegExp): Promise<T> {
    // Invalidate cache if pattern provided
    if (invalidateCachePattern) {
      await invalidateCache(invalidateCachePattern);
    }

    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }, false, false); // PUT requests don't use cache or batching
  }

  async delete<T>(endpoint: string, invalidateCachePattern?: string | RegExp): Promise<T> {
    // Invalidate cache if pattern provided
    if (invalidateCachePattern) {
      await invalidateCache(invalidateCachePattern);
    }

    return this.request<T>(endpoint, { method: 'DELETE' }, false, false); // DELETE requests don't use cache or batching
  }
}

export const apiService = new ApiService();





