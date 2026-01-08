/**
 * React Hook for Parse LiveQuery
 * Subscribes to active chat conversations only
 * For use in ChatInterface component
 * 
 * Note: This hook is prepared for when messages are stored in Parse
 * Currently, messages are in IndexedDB, so this is a placeholder for future integration
 */

import { useEffect, useRef, useState } from 'react';

interface UseLiveQueryOptions {
  importerId: string;
  enabled?: boolean;
  onMessage?: (event: 'create' | 'update' | 'delete', message: any) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for subscribing to Parse LiveQuery for active chats
 * Only subscribes when chat is active (enabled = true)
 */
export function useLiveQuery(options: UseLiveQueryOptions) {
  const { importerId, enabled = false, onMessage, onError } = options;
  const [isConnected, setIsConnected] = useState(false);
  const subscriptionIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Only subscribe if enabled (chat is active)
    if (!enabled || !importerId) {
      return;
    }

    let mounted = true;

    // Subscribe to LiveQuery via API
    const subscribe = async () => {
      try {
        // Call backend API to subscribe to LiveQuery
        // The backend LiveQuery service will handle the Parse subscription
        const response = await fetch(`/api/livequery/subscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ importerId }),
        });

        if (!response.ok) {
          throw new Error('Failed to subscribe to LiveQuery');
        }

        const data = await response.json();
        subscriptionIdRef.current = data.subscriptionId;
        
        if (mounted) {
          setIsConnected(true);
        }

        // Set up polling or WebSocket for message updates
        // For now, this is a placeholder - actual implementation would use
        // Parse LiveQuery WebSocket connection
      } catch (error) {
        console.error('[useLiveQuery] Subscription error:', error);
        if (mounted && onError) {
          onError(error as Error);
        }
      }
    };

    subscribe();

    // Cleanup: unsubscribe when component unmounts or chat closes
    return () => {
      mounted = false;
      
      if (subscriptionIdRef.current) {
        // Unsubscribe via API
        fetch(`/api/livequery/unsubscribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ subscriptionId: subscriptionIdRef.current }),
        }).catch(err => {
          console.error('[useLiveQuery] Unsubscribe error:', err);
        });
        
        subscriptionIdRef.current = null;
      }
      
      setIsConnected(false);
    };
  }, [importerId, enabled, onMessage, onError]);

  return {
    isConnected,
    subscriptionId: subscriptionIdRef.current,
  };
}

