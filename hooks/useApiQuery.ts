/**
 * Custom React Query hooks for API calls
 * Provides typed hooks for common API endpoints
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import { apiService } from '../services/apiService';

/**
 * Hook for fetching products
 */
export function useProducts(options?: {
  category?: string;
  search?: string;
  tags?: string[];
  status?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['products', options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.category) params.append('category', options.category);
      if (options?.search) params.append('search', options.search);
      if (options?.tags) params.append('tags', options.tags.join(','));
      if (options?.status) params.append('status', options.status);
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());
      
      const queryString = params.toString();
      const endpoint = `/api/products${queryString ? `?${queryString}` : ''}`;
      return apiService.get<any>(endpoint);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook for fetching a single product
 */
export function useProduct(productId: string) {
  return useQuery({
    queryKey: ['product', productId],
    queryFn: () => apiService.get<any>(`/api/products/${productId}`),
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook for fetching leads
 */
export function useLeads(options?: {
  status?: string;
  country?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  return useQuery({
    queryKey: ['leads', options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.status) params.append('status', options.status);
      if (options?.country) params.append('country', options.country);
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());
      if (options?.sortBy) params.append('sortBy', options.sortBy);
      if (options?.sortOrder) params.append('sortOrder', options.sortOrder);
      
      const queryString = params.toString();
      const endpoint = `/api/leads${queryString ? `?${queryString}` : ''}`;
      return apiService.get<any>(endpoint);
    },
    staleTime: 1 * 60 * 1000, // 1 minute (leads change more frequently)
  });
}

/**
 * Hook for fetching app configuration
 */
export function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: () => apiService.get<any>('/api/config'),
    staleTime: 10 * 60 * 1000, // 10 minutes (config changes rarely)
  });
}

/**
 * Generic API query hook
 */
export function useApiQuery<T>(
  queryKey: string[],
  endpoint: string,
  options?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>
) {
  return useQuery<T>({
    queryKey,
    queryFn: () => apiService.get<T>(endpoint),
    ...options,
  });
}

/**
 * Generic API mutation hook
 */
export function useApiMutation<TData = any, TVariables = any>(
  endpoint: string,
  method: 'POST' | 'PUT' | 'DELETE' = 'POST',
  options?: Omit<UseMutationOptions<TData, Error, TVariables>, 'mutationFn'>
) {
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables: TVariables) => {
      if (method === 'POST') {
        return apiService.post<TData>(endpoint, variables);
      } else if (method === 'PUT') {
        return apiService.put<TData>(endpoint, variables);
      } else {
        return apiService.delete<TData>(endpoint);
      }
    },
    onSuccess: () => {
      // Invalidate related queries on successful mutation
      const baseKey = endpoint.split('?')[0].replace('/api/', '');
      queryClient.invalidateQueries({ queryKey: [baseKey] });
    },
    ...options,
  });
}

/**
 * Hook for creating a product
 */
export function useCreateProduct() {
  return useApiMutation<any, any>('/api/products', 'POST');
}

/**
 * Hook for updating a product
 */
export function useUpdateProduct(productId: string) {
  return useApiMutation<any, any>(`/api/products/${productId}`, 'PUT');
}

/**
 * Hook for deleting a product
 */
export function useDeleteProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (productId: string) => {
      return apiService.delete(`/api/products/${productId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

