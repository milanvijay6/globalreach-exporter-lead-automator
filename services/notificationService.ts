import { PlatformService } from './platformService';
import { Logger } from './loggerService';

const STORAGE_KEY_NOTIFICATIONS = 'globalreach_notifications';

export interface Notification {
  id: string;
  type: 'signup_request' | 'signup_approved' | 'signup_rejected' | 'account_locked' | 'account_unlocked' | 'security_alert';
  title: string;
  message: string;
  data?: Record<string, any>;
  timestamp: number;
  read: boolean;
}

/**
 * Notification Service
 * Handles in-app notifications and optional email/SMS/WhatsApp alerts
 */
export const NotificationService = {
  /**
   * Creates a new notification
   */
  createNotification: async (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>): Promise<Notification> => {
    try {
      const newNotification: Notification = {
        ...notification,
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        read: false,
      };

      const stored = await PlatformService.secureLoad(STORAGE_KEY_NOTIFICATIONS);
      const notifications: Notification[] = stored ? JSON.parse(stored) : [];
      notifications.unshift(newNotification);
      
      // Keep only last 100 notifications
      if (notifications.length > 100) {
        notifications.splice(100);
      }

      await PlatformService.secureSave(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(notifications));

      Logger.info(`[NotificationService] Notification created: ${newNotification.id}`);
      return newNotification;
    } catch (error) {
      Logger.error('[NotificationService] Failed to create notification:', error);
      throw error;
    }
  },

  /**
   * Gets all notifications
   */
  getNotifications: async (unreadOnly: boolean = false): Promise<Notification[]> => {
    try {
      const stored = await PlatformService.secureLoad(STORAGE_KEY_NOTIFICATIONS);
      if (!stored) return [];

      const notifications: Notification[] = JSON.parse(stored);
      return unreadOnly ? notifications.filter(n => !n.read) : notifications;
    } catch (error) {
      Logger.error('[NotificationService] Failed to get notifications:', error);
      return [];
    }
  },

  /**
   * Marks a notification as read
   */
  markAsRead: async (notificationId: string): Promise<void> => {
    try {
      const stored = await PlatformService.secureLoad(STORAGE_KEY_NOTIFICATIONS);
      if (!stored) return;

      const notifications: Notification[] = JSON.parse(stored);
      const updated = notifications.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      );

      await PlatformService.secureSave(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(updated));
    } catch (error) {
      Logger.error('[NotificationService] Failed to mark notification as read:', error);
    }
  },

  /**
   * Marks all notifications as read
   */
  markAllAsRead: async (): Promise<void> => {
    try {
      const stored = await PlatformService.secureLoad(STORAGE_KEY_NOTIFICATIONS);
      if (!stored) return;

      const notifications: Notification[] = JSON.parse(stored);
      const updated = notifications.map(n => ({ ...n, read: true }));

      await PlatformService.secureSave(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(updated));
    } catch (error) {
      Logger.error('[NotificationService] Failed to mark all as read:', error);
    }
  },

  /**
   * Deletes a notification
   */
  deleteNotification: async (notificationId: string): Promise<void> => {
    try {
      const stored = await PlatformService.secureLoad(STORAGE_KEY_NOTIFICATIONS);
      if (!stored) return;

      const notifications: Notification[] = JSON.parse(stored);
      const filtered = notifications.filter(n => n.id !== notificationId);

      await PlatformService.secureSave(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(filtered));
    } catch (error) {
      Logger.error('[NotificationService] Failed to delete notification:', error);
    }
  },

  /**
   * Gets unread notification count
   */
  getUnreadCount: async (): Promise<number> => {
    try {
      const notifications = await NotificationService.getNotifications(true);
      return notifications.length;
    } catch (error) {
      Logger.error('[NotificationService] Failed to get unread count:', error);
      return 0;
    }
  },

  /**
   * Sends email notification (if email service is configured)
   */
  sendEmailNotification: async (email: string, subject: string, body: string): Promise<void> => {
    try {
      // This would integrate with email service
      // For now, just log it
      Logger.info(`[NotificationService] Email notification would be sent to ${email}: ${subject}`);
    } catch (error) {
      Logger.error('[NotificationService] Failed to send email notification:', error);
    }
  },

  /**
   * Sends SMS notification (if SMS service is configured)
   */
  sendSMSNotification: async (mobile: string, message: string): Promise<void> => {
    try {
      // This would integrate with SMS service
      Logger.info(`[NotificationService] SMS notification would be sent to ${mobile}`);
    } catch (error) {
      Logger.error('[NotificationService] Failed to send SMS notification:', error);
    }
  },

  /**
   * Sends WhatsApp notification (if WhatsApp service is configured)
   */
  sendWhatsAppNotification: async (mobile: string, message: string): Promise<void> => {
    try {
      // This would integrate with WhatsApp service
      Logger.info(`[NotificationService] WhatsApp notification would be sent to ${mobile}`);
    } catch (error) {
      Logger.error('[NotificationService] Failed to send WhatsApp notification:', error);
    }
  },
};

