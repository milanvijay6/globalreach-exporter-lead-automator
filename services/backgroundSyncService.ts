/**
 * Background Sync Service
 * Uses Workbox Background Sync to queue and retry failed message sends
 */

import { BackgroundSyncPlugin } from 'workbox-background-sync';

const SYNC_QUEUE_NAME = process.env.SYNC_QUEUE_NAME || 'message-queue';

// Create background sync plugin
let backgroundSyncPlugin: BackgroundSyncPlugin | null = null;

/**
 * Initialize background sync
 */
export function initializeBackgroundSync() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('[BackgroundSync] Service Worker not available');
    return null;
  }

  try {
    backgroundSyncPlugin = new BackgroundSyncPlugin(SYNC_QUEUE_NAME, {
      maxRetentionTime: 24 * 60, // 24 hours in minutes
    });

    console.log('[BackgroundSync] Initialized');
    return backgroundSyncPlugin;
  } catch (error) {
    console.error('[BackgroundSync] Failed to initialize:', error);
    return null;
  }
}

/**
 * Queue a message for background sync
 */
export async function queueMessage(message: {
  messageId: string;
  to: string;
  content: string;
  channel: string;
  importerId?: string;
}): Promise<boolean> {
  try {
    if (!backgroundSyncPlugin) {
      backgroundSyncPlugin = initializeBackgroundSync();
    }

    if (!backgroundSyncPlugin) {
      console.warn('[BackgroundSync] Plugin not available, message not queued');
      return false;
    }

    // Register the request with Workbox
    // This would typically be done via a fetch event listener in the service worker
    // For now, we'll store it in IndexedDB and let the service worker handle it
    
    const { MobileStorageService } = await import('./mobileStorageService');
    const queueKey = `${SYNC_QUEUE_NAME}_${message.messageId}`;
    await MobileStorageService.set(queueKey, JSON.stringify({
      ...message,
      queuedAt: Date.now(),
    }));

    console.log(`[BackgroundSync] Message queued: ${message.messageId}`);
    return true;
  } catch (error) {
    console.error('[BackgroundSync] Failed to queue message:', error);
    return false;
  }
}

/**
 * Get queued messages count
 */
export async function getQueuedMessagesCount(): Promise<number> {
  try {
    const { MobileStorageService } = await import('./mobileStorageService');
    const keys = await MobileStorageService.keys();
    const queueKeys = keys.filter(key => key.startsWith(`${SYNC_QUEUE_NAME}_`));
    return queueKeys.length;
  } catch (error) {
    console.error('[BackgroundSync] Failed to get queued messages count:', error);
    return 0;
  }
}

/**
 * Get all queued messages
 */
export async function getQueuedMessages(): Promise<any[]> {
  try {
    const { MobileStorageService } = await import('./mobileStorageService');
    const keys = await MobileStorageService.keys();
    const queueKeys = keys.filter(key => key.startsWith(`${SYNC_QUEUE_NAME}_`));
    
    const messages = await Promise.all(
      queueKeys.map(async (key) => {
        const value = await MobileStorageService.get(key);
        if (value) {
          return JSON.parse(value);
        }
        return null;
      })
    );

    return messages.filter(Boolean);
  } catch (error) {
    console.error('[BackgroundSync] Failed to get queued messages:', error);
    return [];
  }
}

/**
 * Remove queued message (after successful send)
 */
export async function removeQueuedMessage(messageId: string): Promise<void> {
  try {
    const { MobileStorageService } = await import('./mobileStorageService');
    const queueKey = `${SYNC_QUEUE_NAME}_${messageId}`;
    await MobileStorageService.remove(queueKey);
    console.log(`[BackgroundSync] Removed queued message: ${messageId}`);
  } catch (error) {
    console.error('[BackgroundSync] Failed to remove queued message:', error);
  }
}

/**
 * Clear all queued messages
 */
export async function clearQueuedMessages(): Promise<void> {
  try {
    const { MobileStorageService } = await import('./mobileStorageService');
    const keys = await MobileStorageService.keys();
    const queueKeys = keys.filter(key => key.startsWith(`${SYNC_QUEUE_NAME}_`));
    
    await Promise.all(queueKeys.map(key => MobileStorageService.remove(key)));
    console.log(`[BackgroundSync] Cleared ${queueKeys.length} queued messages`);
  } catch (error) {
    console.error('[BackgroundSync] Failed to clear queued messages:', error);
  }
}

