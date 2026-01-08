/**
 * LiveQuery Service
 * Manages Parse LiveQuery subscriptions with restrictions for active chats only
 * Optimizes real-time updates by limiting LiveQuery to critical data
 */

const Parse = require('parse/node');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Maximum number of active LiveQuery subscriptions
const MAX_SUBSCRIPTIONS = 100;
const SUBSCRIPTION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Track active subscriptions
const activeSubscriptions = new Map(); // Map<subscriptionId, { query, subscription, importerId, createdAt }>

/**
 * LiveQuery Service
 * Restricts LiveQuery to active chat conversations only
 */
const liveQueryService = {
  /**
   * Subscribe to messages for an active chat conversation
   * Only subscribes if conversation is active (status: 'active')
   * @param {string} importerId - Lead/Importer ID
   * @param {Function} onMessage - Callback for new/updated messages
   * @param {Function} onError - Error callback
   * @returns {Promise<string>} Subscription ID
   */
  async subscribeToActiveChat(importerId, onMessage, onError) {
    try {
      // Check subscription limit
      if (activeSubscriptions.size >= MAX_SUBSCRIPTIONS) {
        logger.warn(`[LiveQuery] Subscription limit reached (${MAX_SUBSCRIPTIONS}), rejecting new subscription`);
        throw new Error('LiveQuery subscription limit reached');
      }

      // Check if already subscribed
      for (const [subId, sub] of activeSubscriptions.entries()) {
        if (sub.importerId === importerId) {
          logger.debug(`[LiveQuery] Already subscribed to ${importerId}, returning existing subscription`);
          return subId;
        }
      }

      // Create query for active messages only
      const Message = require('../models/Message');
      const query = new Parse.Query(Message);
      
      // Only subscribe to messages for this importer that are in active conversations
      query.equalTo('importerId', importerId);
      query.equalTo('status', 'active'); // Only active messages
      query.descending('timestamp');
      query.limit(50); // Limit to recent messages

      // Create LiveQuery subscription
      // Note: Parse LiveQuery requires Parse Server with LiveQuery enabled
      // For Back4App, LiveQuery may need to be configured in dashboard
      const subscription = await query.subscribe();

      const subscriptionId = `livequery_${importerId}_${Date.now()}`;

      // Set up event handlers
      subscription.on('create', (message) => {
        logger.debug(`[LiveQuery] New message created for ${importerId}`);
        if (onMessage) {
          onMessage('create', message);
        }
      });

      subscription.on('update', (message) => {
        logger.debug(`[LiveQuery] Message updated for ${importerId}`);
        if (onMessage) {
          onMessage('update', message);
        }
      });

      subscription.on('enter', (message) => {
        logger.debug(`[LiveQuery] Message entered query for ${importerId}`);
        if (onMessage) {
          onMessage('enter', message);
        }
      });

      subscription.on('leave', (message) => {
        logger.debug(`[LiveQuery] Message left query for ${importerId}`);
        if (onMessage) {
          onMessage('leave', message);
        }
      });

      subscription.on('delete', (message) => {
        logger.debug(`[LiveQuery] Message deleted for ${importerId}`);
        if (onMessage) {
          onMessage('delete', message);
        }
      });

      subscription.on('error', (error) => {
        logger.error(`[LiveQuery] Subscription error for ${importerId}:`, error);
        if (onError) {
          onError(error);
        }
        // Clean up on error
        this.unsubscribe(subscriptionId);
      });

      // Store subscription
      activeSubscriptions.set(subscriptionId, {
        query,
        subscription,
        importerId,
        createdAt: Date.now(),
      });

      logger.info(`[LiveQuery] Subscribed to active chat for ${importerId} (${activeSubscriptions.size}/${MAX_SUBSCRIPTIONS} subscriptions)`);
      return subscriptionId;
    } catch (error) {
      logger.error(`[LiveQuery] Failed to subscribe to ${importerId}:`, error);
      throw error;
    }
  },

  /**
   * Unsubscribe from a LiveQuery subscription
   * @param {string} subscriptionId - Subscription ID
   */
  async unsubscribe(subscriptionId) {
    try {
      const sub = activeSubscriptions.get(subscriptionId);
      if (!sub) {
        logger.warn(`[LiveQuery] Subscription ${subscriptionId} not found`);
        return false;
      }

      // Unsubscribe from Parse LiveQuery
      if (sub.subscription && sub.subscription.unsubscribe) {
        await sub.subscription.unsubscribe();
      }

      activeSubscriptions.delete(subscriptionId);
      logger.info(`[LiveQuery] Unsubscribed ${subscriptionId} (${activeSubscriptions.size}/${MAX_SUBSCRIPTIONS} subscriptions)`);
      return true;
    } catch (error) {
      logger.error(`[LiveQuery] Failed to unsubscribe ${subscriptionId}:`, error);
      return false;
    }
  },

  /**
   * Unsubscribe from all subscriptions for an importer
   * @param {string} importerId - Importer ID
   */
  async unsubscribeFromImporter(importerId) {
    try {
      const toUnsubscribe = [];
      for (const [subId, sub] of activeSubscriptions.entries()) {
        if (sub.importerId === importerId) {
          toUnsubscribe.push(subId);
        }
      }

      for (const subId of toUnsubscribe) {
        await this.unsubscribe(subId);
      }

      logger.info(`[LiveQuery] Unsubscribed from all chats for ${importerId}`);
      return toUnsubscribe.length;
    } catch (error) {
      logger.error(`[LiveQuery] Failed to unsubscribe from importer ${importerId}:`, error);
      return 0;
    }
  },

  /**
   * Clean up stale subscriptions (older than timeout)
   */
  cleanupStaleSubscriptions() {
    try {
      const now = Date.now();
      const toRemove = [];

      for (const [subId, sub] of activeSubscriptions.entries()) {
        if (now - sub.createdAt > SUBSCRIPTION_TIMEOUT) {
          toRemove.push(subId);
        }
      }

      for (const subId of toRemove) {
        this.unsubscribe(subId).catch(err => {
          logger.error(`[LiveQuery] Failed to cleanup subscription ${subId}:`, err);
        });
      }

      if (toRemove.length > 0) {
        logger.info(`[LiveQuery] Cleaned up ${toRemove.length} stale subscriptions`);
      }
    } catch (error) {
      logger.error('[LiveQuery] Failed to cleanup stale subscriptions:', error);
    }
  },

  /**
   * Get subscription statistics
   */
  getStats() {
    return {
      activeSubscriptions: activeSubscriptions.size,
      maxSubscriptions: MAX_SUBSCRIPTIONS,
      subscriptions: Array.from(activeSubscriptions.entries()).map(([id, sub]) => ({
        id,
        importerId: sub.importerId,
        age: Date.now() - sub.createdAt,
      })),
    };
  },

  /**
   * Unsubscribe from all active subscriptions
   */
  async unsubscribeAll() {
    try {
      const subscriptionIds = Array.from(activeSubscriptions.keys());
      for (const subId of subscriptionIds) {
        await this.unsubscribe(subId);
      }
      logger.info('[LiveQuery] Unsubscribed from all active subscriptions');
      return subscriptionIds.length;
    } catch (error) {
      logger.error('[LiveQuery] Failed to unsubscribe all:', error);
      return 0;
    }
  },
};

// Cleanup stale subscriptions every 10 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    liveQueryService.cleanupStaleSubscriptions();
  }, 10 * 60 * 1000);
}

module.exports = { liveQueryService };

