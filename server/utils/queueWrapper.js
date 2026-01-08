/**
 * Queue Wrapper for use in TypeScript services
 * Provides a simple interface to queue messages
 */

let messageQueue = null;

function getMessageQueue() {
  if (!messageQueue) {
    try {
      messageQueue = require('../queues/messageQueue');
    } catch (error) {
      console.warn('[QueueWrapper] Message queue not available:', error.message);
      return null;
    }
  }
  return messageQueue;
}

/**
 * Queue a message for sending
 * @param {string} channel - 'whatsapp' | 'email' | 'campaign'
 * @param {Object} data - Message data
 * @param {Object} options - Queue options (priority, delay)
 * @returns {Promise<{success: boolean, queued?: boolean, jobId?: string, error?: string}>}
 */
async function queueMessage(channel, data, options = {}) {
  const queue = getMessageQueue();
  if (!queue) {
    // Fallback: return error if queue not available
    return { success: false, error: 'Queue system not available' };
  }

  try {
    const result = await queue.queueMessage(channel, data, options);
    return result;
  } catch (error) {
    console.error('[QueueWrapper] Failed to queue message:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  queueMessage,
  getMessageQueue,
};






