const express = require('express');
const router = express.Router();
const Parse = require('parse/node');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Store device tokens in Parse (or use a dedicated DeviceToken class)
const DeviceToken = Parse.Object.extend('DeviceToken');

/**
 * POST /api/push-notifications/register
 * Register device token for push notifications
 */
router.post('/register', async (req, res) => {
  try {
    const { token, platform, userId } = req.body;
    
    if (!token || !platform) {
      return res.status(400).json({ success: false, error: 'Token and platform are required' });
    }

    const currentUserId = userId || req.userId || req.headers['x-user-id'] || null;

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
router.post('/send', async (req, res) => {
  try {
    const { userId, topic, title, body, data } = req.body;
    
    if (!title || !body) {
      return res.status(400).json({ success: false, error: 'Title and body are required' });
    }

    // Get device tokens for user(s)
    const query = new Parse.Query(DeviceToken);
    if (userId) {
      query.equalTo('userId', userId);
    }
    if (topic) {
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
router.delete('/unregister', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ success: false, error: 'Token is required' });
    }

    const query = new Parse.Query(DeviceToken);
    query.equalTo('token', token);
    const deviceToken = await query.first({ useMasterKey: true });

    if (deviceToken) {
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

