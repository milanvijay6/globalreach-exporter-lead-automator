/**
 * React Query Service
 * Configures React Query client with stale-while-revalidate strategy
 * L1 Cache: Frontend API response caching
 */

import { QueryClient } from '@tanstack/react-query';

// Configure QueryClient with stale-while-revalidate strategy
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 5 minutes
      staleTime: 5 * 60 * 1000, // 5 minutes
      
      // Cache data for 10 minutes after it becomes unused
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      
      // Stale-while-revalidate: return cached data immediately, then refetch in background
      refetchOnWindowFocus: false, // Don't refetch on window focus (stale-while-revalidate)
      refetchOnReconnect: true, // Refetch when network reconnects
      refetchOnMount: false, // Use cached data on mount if available
      
      // Retry configuration
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Network mode
      networkMode: 'online',
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
      networkMode: 'online',
    },
  },
});

/**
 * Invalidate queries by key pattern
 * Useful for cache invalidation on mutations
 */
export function invalidateQueries(pattern: string | string[]) {
  const patterns = Array.isArray(pattern) ? pattern : [pattern];
  patterns.forEach(p => {
    queryClient.invalidateQueries({ queryKey: [p] });
  });
}

/**
 * Prefetch query data
 * Useful for warming cache before navigation
 */
export async function prefetchQuery<T>(
  queryKey: string[],
  queryFn: () => Promise<T>
) {
  await queryClient.prefetchQuery({
    queryKey,
    queryFn,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get cached query data
 */
export function getCachedQuery<T>(queryKey: string[]): T | undefined {
  return queryClient.getQueryData<T>(queryKey);
}

/**
 * Set query data manually
 * Useful for optimistic updates
 */
export function setQueryData<T>(queryKey: string[], data: T) {
  queryClient.setQueryData<T>(queryKey, data);
}

