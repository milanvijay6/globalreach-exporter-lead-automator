const express = require('express');
const router = express.Router();
const Parse = require('parse/node');
const winston = require('winston');
const { authenticateUser, requireAuth } = require('../middleware/auth');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Store device tokens in Parse (or use a dedicated DeviceToken class)
const DeviceToken = Parse.Object.extend('DeviceToken');

// Apply authentication middleware globally to extract user info securely
router.use(authenticateUser);

/**
 * POST /api/push-notifications/register
 * Register device token for push notifications
 * (Allows anonymous registration, but uses authenticated user ID if available)
 */
router.post('/register', async (req, res) => {
  try {
    const { token, platform } = req.body;
    
    if (!token || !platform) {
      return res.status(400).json({ success: false, error: 'Token and platform are required' });
    }

    // Safely extract user ID from authenticated context to prevent IDOR spoofing via body/headers
    const currentUserId = (req.user && req.user.id) || req.userId || null;

    // Check if token already exists
    const query = new Parse.Query(DeviceToken);
    query.equalTo('token', token);
    const existing = await query.first({ useMasterKey: true });

    if (existing) {
      // Update existing token
      existing.set('platform', platform);
      existing.set('userId', currentUserId);
      existing.set('updatedAt', new Date());
      await existing.save(null, { useMasterKey: true });
      logger.info(`[PushNotifications] Updated device token for user ${currentUserId}`);
    } else {
      // Create new token
      const deviceToken = new DeviceToken();
      deviceToken.set('token', token);
      deviceToken.set('platform', platform);
      deviceToken.set('userId', currentUserId);
      deviceToken.set('createdAt', new Date());
      deviceToken.set('updatedAt', new Date());
      await deviceToken.save(null, { useMasterKey: true });
      logger.info(`[PushNotifications] Registered new device token for user ${currentUserId}`);
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('[PushNotifications] Error registering device token:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/push-notifications/send
 * Send push notification to user(s)
 */
router.post('/send', requireAuth, async (req, res) => {
  try {
    const { userId, topic, title, body, data } = req.body;
    
    if (!title || !body) {
      return res.status(400).json({ success: false, error: 'Title and body are required' });
    }

    const currentUserId = (req.user && req.user.id) || req.userId;

    // Prevent unauthorized sending
    if (userId && userId !== currentUserId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Cannot send notifications to other users' });
    }

    // Get device tokens for user(s)
    const query = new Parse.Query(DeviceToken);
    if (userId) {
      query.equalTo('userId', userId);
    } else if (!topic) {
      // Default to sending to self if no target specified
      query.equalTo('userId', currentUserId);
    }

    if (topic) {
      // NOTE: In a real system, we'd also verify if the user is authorized to send to this topic
      query.equalTo('topic', topic);
    }
    
    const tokens = await query.find({ useMasterKey: true });
    
    if (tokens.length === 0) {
      return res.json({ success: true, sent: 0, message: 'No device tokens found' });
    }

    // Send notifications via FCM/APNs
    // This would integrate with Firebase Admin SDK or APNs
    // For now, we'll just log and return success
    logger.info(`[PushNotifications] Sending notification to ${tokens.length} devices`);
    
    // TODO: Integrate with actual push notification service
    // const fcm = require('firebase-admin');
    // await fcm.messaging().sendMulticast({
    //   tokens: tokens.map(t => t.get('token')),
    //   notification: { title, body },
    //   data: data || {},
    // });

    res.json({
      success: true,
      sent: tokens.length,
      tokens: tokens.map(t => ({
        id: t.id,
        platform: t.get('platform'),
      })),
    });
  } catch (error) {
    logger.error('[PushNotifications] Error sending notification:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/push-notifications/unregister
 * Unregister device token
 */
router.delete('/unregister', requireAuth, async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ success: false, error: 'Token is required' });
    }

    const currentUserId = (req.user && req.user.id) || req.userId;

    const query = new Parse.Query(DeviceToken);
    query.equalTo('token', token);
    const deviceToken = await query.first({ useMasterKey: true });

    if (deviceToken) {
      if (deviceToken.get('userId') && deviceToken.get('userId') !== currentUserId) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }
      await deviceToken.destroy({ useMasterKey: true });
      logger.info('[PushNotifications] Unregistered device token');
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('[PushNotifications] Error unregistering device token:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

