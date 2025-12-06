/**
 * API Batching Service
 * Batches multiple API calls, deduplicates requests, and manages connection pooling
 */

import { LoadingService } from './loadingService';

interface PendingRequest {
  url: string;
  method: string;
  options: RequestInit;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  timestamp: number;
}

const BATCH_DELAY = 300; // 300ms debounce
const MAX_CONCURRENT = 10; // Maximum concurrent requests
const RETRY_DELAYS = [1000, 2000, 4000, 8000]; // Exponential backoff

let pendingRequests: Map<string, PendingRequest[]> = new Map();
let batchTimer: NodeJS.Timeout | null = null;
let activeRequests = 0;
const requestQueue: PendingRequest[] = [];

/**
 * Generate request key for deduplication
 */
function getRequestKey(url: string, method: string, body?: any): string {
  const bodyStr = body ? JSON.stringify(body) : '';
  return `${method}:${url}:${bodyStr}`;
}

/**
 * Process request queue
 */
async function processQueue() {
  while (requestQueue.length > 0 && activeRequests < MAX_CONCURRENT) {
    const request = requestQueue.shift();
    if (!request) break;

    activeRequests++;
    executeRequest(request)
      .finally(() => {
        activeRequests--;
        // Process next request
        if (requestQueue.length > 0) {
          processQueue();
        }
      });
  }
}

/**
 * Execute a single request with retry logic
 */
async function executeRequest(request: PendingRequest, retryCount = 0): Promise<void> {
  const taskId = `api_${request.method}_${Date.now()}`;
  
  try {
    LoadingService.start(taskId, `${request.method} ${new URL(request.url).pathname}`);
    
    const response = await fetch(request.url, request.options);

    if (!response.ok) {
      // Retry on server errors (5xx)
      if (response.status >= 500 && retryCount < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[retryCount];
        await new Promise(resolve => setTimeout(resolve, delay));
        return executeRequest(request, retryCount + 1);
      }

      const error = await response.json().catch(() => ({
        error: response.statusText
      }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    LoadingService.complete(taskId);
    request.resolve(data);
  } catch (error) {
    LoadingService.stop(taskId);
    // Retry on network errors
    if (retryCount < RETRY_DELAYS.length && (
      error instanceof TypeError || // Network error
      (error as any).message?.includes('Failed to fetch')
    )) {
      const delay = RETRY_DELAYS[retryCount];
      await new Promise(resolve => setTimeout(resolve, delay));
      return executeRequest(request, retryCount + 1);
    }

    request.reject(error);
  }
}

/**
 * Add request to batch
 */
function addToBatch(request: PendingRequest): void {
  const key = getRequestKey(request.url, request.method, request.options.body as string);

  // Check for duplicate requests within deduplication window
  const existing = pendingRequests.get(key);
  if (existing && existing.length > 0) {
    // Deduplicate - return same promise
    const latest = existing[existing.length - 1];
    if (Date.now() - latest.timestamp < 100) {
      // Very recent duplicate, reuse promise
      const promise = new Promise((resolve, reject) => {
        latest.resolve = resolve;
        latest.reject = reject;
      });
      return;
    }
  }

  // Add to pending batch
  if (!pendingRequests.has(key)) {
    pendingRequests.set(key, []);
  }
  pendingRequests.get(key)!.push(request);

  // Clear existing timer
  if (batchTimer) {
    clearTimeout(batchTimer);
  }

  // Set new batch timer
  batchTimer = setTimeout(() => {
    flushBatch();
  }, BATCH_DELAY);
}

/**
 * Flush pending batch
 */
function flushBatch(): void {
  if (batchTimer) {
    clearTimeout(batchTimer);
    batchTimer = null;
  }

  // Process all pending requests
  pendingRequests.forEach((requests, key) => {
    // If multiple requests with same key, only keep the latest
    const latestRequest = requests[requests.length - 1];
    
    // Resolve all older requests with the same promise
    const promise = new Promise((resolve, reject) => {
      latestRequest.resolve = resolve;
      latestRequest.reject = reject;
    });

    requests.forEach((req, index) => {
      if (index < requests.length - 1) {
        // Older requests - they'll get resolved when latest completes
        req.resolve = latestRequest.resolve;
        req.reject = latestRequest.reject;
      }
    });

    // Add to queue
    requestQueue.push(latestRequest);
  });

  pendingRequests.clear();

  // Start processing queue
  processQueue();
}

/**
 * Batched fetch - deduplicates and batches requests
 */
export async function batchedFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request: PendingRequest = {
      url,
      method: options.method || 'GET',
      options,
      resolve: resolve as (value: any) => void,
      reject,
      timestamp: Date.now()
    };

    addToBatch(request);
  });
}

/**
 * Immediate fetch - bypasses batching (for critical requests)
 */
export async function immediateFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const request: PendingRequest = {
      url,
      method: options.method || 'GET',
      options,
      resolve: resolve as (value: any) => void,
      reject,
      timestamp: Date.now()
    };

    activeRequests++;
    try {
      await executeRequest(request);
    } finally {
      activeRequests--;
      processQueue();
    }
  });
}

/**
 * Get current queue status
 */
export function getQueueStatus(): {
  pending: number;
  active: number;
  queued: number;
} {
  return {
    pending: pendingRequests.size,
    active: activeRequests,
    queued: requestQueue.length
  };
}

