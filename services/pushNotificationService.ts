/**
 * Push Notification Service
 * Handles native push notifications for mobile platforms
 * Uses FCM for Android and APNs for iOS
 */

import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

let isInitialized = false;
let deviceToken: string | null = null;

/**
 * Check if push notifications are available
 */
function isPushAvailable(): boolean {
  return Capacitor.isNativePlatform() && !!PushNotifications;
}

/**
 * Initialize push notifications
 */
export async function initializePushNotifications(): Promise<boolean> {
  if (!isPushAvailable()) {
    console.log('[PushNotifications] Not available on this platform');
    return false;
  }

  if (isInitialized) {
    return true;
  }

  try {
    // Request permission
    let permResult = await PushNotifications.requestPermissions();
    
    if (permResult.receive === 'prompt') {
      // Permission was requested, wait for user response
      console.log('[PushNotifications] Permission requested, waiting for user response');
    } else if (permResult.receive === 'granted') {
      // Permission granted
      console.log('[PushNotifications] Permission granted');
    } else {
      // Permission denied
      console.warn('[PushNotifications] Permission denied');
      return false;
    }

    // Register for push notifications
    await PushNotifications.register();

    // Set up event listeners
    PushNotifications.addListener('registration', (token) => {
      console.log('[PushNotifications] Registered with token:', token.value);
      deviceToken = token.value;
      
      // Register token with backend
      registerDeviceToken(token.value).catch(error => {
        console.error('[PushNotifications] Failed to register token with backend:', error);
      });
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.error('[PushNotifications] Registration error:', error);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[PushNotifications] Push notification received:', notification);
      // Handle notification received (app is in foreground)
      handleNotificationReceived(notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[PushNotifications] Push notification action performed:', action);
      // Handle notification action (user tapped notification)
      handleNotificationAction(action);
    });

    isInitialized = true;
    return true;
  } catch (error) {
    console.error('[PushNotifications] Failed to initialize:', error);
    return false;
  }
}

/**
 * Register device token with backend
 */
async function registerDeviceToken(token: string): Promise<void> {
  try {
    const { apiService } = await import('./apiService');
    await apiService.post('/api/push-notifications/register', {
      token,
      platform: Capacitor.getPlatform(),
    });
    console.log('[PushNotifications] Token registered with backend');
  } catch (error) {
    console.error('[PushNotifications] Failed to register token:', error);
    throw error;
  }
}

/**
 * Handle notification received (app in foreground)
 */
function handleNotificationReceived(notification: any): void {
  // Show in-app notification or update UI
  // This would integrate with your notification system
  console.log('[PushNotifications] Handling received notification:', notification);
}

/**
 * Handle notification action (user tapped notification)
 */
function handleNotificationAction(action: any): void {
  const notification = action.notification;
  const data = notification.data;

  // Navigate to relevant screen based on notification data
  if (data.type === 'lead-update') {
    // Navigate to lead detail
    window.location.href = `#/lead/${data.leadId}`;
  } else if (data.type === 'message') {
    // Navigate to chat
    window.location.href = `#/chat/${data.importerId}`;
  } else if (data.type === 'email') {
    // Navigate to email/lead
    window.location.href = `#/lead/${data.leadId}`;
  }
}

/**
 * Get device token
 */
export function getDeviceToken(): string | null {
  return deviceToken;
}

/**
 * Check if notifications are enabled
 */
export async function areNotificationsEnabled(): Promise<boolean> {
  if (!isPushAvailable()) {
    return false;
  }

  try {
    const permResult = await PushNotifications.checkPermissions();
    return permResult.receive === 'granted';
  } catch (error) {
    console.error('[PushNotifications] Failed to check permissions:', error);
    return false;
  }
}

/**
 * Remove all listeners (cleanup)
 */
export function removeAllListeners(): void {
  if (isPushAvailable()) {
    PushNotifications.removeAllListeners();
    isInitialized = false;
    deviceToken = null;
  }
}

