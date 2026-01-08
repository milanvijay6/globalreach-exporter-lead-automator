/**
 * Parse File Service
 * Manages large text fields stored as Parse Files
 * Splits email bodies and other large content into Parse Files
 */

const Parse = require('parse/node');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Threshold for splitting into Parse Files (1KB)
const FILE_THRESHOLD = 1024;

/**
 * Parse File Service
 */
const parseFileService = {
  /**
   * Store large text content as Parse File
   * Automatically decides whether to use Parse File or inline content
   * @param {string} content - Text content to store
   * @param {string} filename - Filename for Parse File
   * @param {Object} options - Options
   * @returns {Promise<{ file: Parse.File | null, content: string }>} File and content
   */
  async storeContent(content, filename = 'content.txt', options = {}) {
    try {
      const { useMasterKey = true } = options;

      // If content is small, return null file (store inline)
      if (!content || content.length < FILE_THRESHOLD) {
        return { file: null, content };
      }

      // Create Parse File for large content
      const parseFile = new Parse.File(filename, {
        base64: Buffer.from(content, 'utf8').toString('base64'),
      }, 'text/plain');

      await parseFile.save({ useMasterKey });

      logger.debug(`[ParseFileService] Stored ${content.length} bytes as Parse File: ${filename}`);
      return { file: parseFile, content: null };
    } catch (error) {
      logger.error('[ParseFileService] Failed to store content as Parse File:', error);
      // Fallback to inline storage
      return { file: null, content };
    }
  },

  /**
   * Retrieve content from Parse File or inline field
   * @param {Parse.Object} message - Message object
   * @param {Object} options - Options
   * @returns {Promise<string>} Content string
   */
  async getContent(message, options = {}) {
    try {
      const { useMasterKey = true } = options;

      // Check if content is inline
      const inlineContent = message.get('content');
      if (inlineContent) {
        return inlineContent;
      }

      // Check if content is in Parse File
      const emailBodyFile = message.get('emailBodyFile');
      if (emailBodyFile) {
        // Parse File URL - fetch content
        const fileUrl = emailBodyFile.url();
        const response = await fetch(fileUrl);
        const content = await response.text();
        return content;
      }

      return '';
    } catch (error) {
      logger.error('[ParseFileService] Failed to get content:', error);
      return '';
    }
  },

  /**
   * Create message with automatic file splitting
   * @param {Object} messageData - Message data
   * @param {Object} options - Options
   * @returns {Promise<Parse.Object>} Created message
   */
  async createMessage(messageData, options = {}) {
    try {
      const { useMasterKey = true } = options;
      const Message = require('../models/Message');

      const message = new Message();
      
      // Set non-content fields
      Object.keys(messageData).forEach(key => {
        if (key !== 'content' && key !== 'body') {
          message.set(key, messageData[key]);
        }
      });

      // Handle content/body field
      const content = messageData.content || messageData.body || '';
      
      if (content.length >= FILE_THRESHOLD) {
        // Store as Parse File
        const filename = `message_${Date.now()}_${messageData.importerId || 'unknown'}.txt`;
        const { file } = await this.storeContent(content, filename, { useMasterKey });
        
        if (file) {
          message.set('emailBodyFile', file);
          message.set('content', null); // Clear inline content
        } else {
          // Fallback to inline
          message.set('content', content);
        }
      } else {
        // Store inline
        message.set('content', content);
      }

      await message.save(null, { useMasterKey });
      logger.debug(`[ParseFileService] Created message with ${content.length >= FILE_THRESHOLD ? 'file' : 'inline'} content`);
      return message;
    } catch (error) {
      logger.error('[ParseFileService] Failed to create message:', error);
      throw error;
    }
  },

  /**
   * Migrate existing large messages to Parse Files
   * @param {Object} options - Options
   * @returns {Promise<{ processed: number, migrated: number }>} Migration results
   */
  async migrateLargeMessages(options = {}) {
    try {
      const { useMasterKey = true, limit = 100 } = options;
      const Message = require('../models/Message');

      let processed = 0;
      let migrated = 0;
      let skip = 0;

      while (true) {
        const query = new Parse.Query(Message);
        query.exists('content'); // Only messages with inline content
        query.doesNotExist('emailBodyFile'); // Not already migrated
        query.skip(skip);
        query.limit(limit);

        const messages = await query.find({ useMasterKey });

        if (messages.length === 0) {
          break;
        }

        for (const message of messages) {
          processed++;
          const content = message.get('content');

          if (content && content.length >= FILE_THRESHOLD) {
            const filename = `message_${message.id}_migrated.txt`;
            const { file } = await this.storeContent(content, filename, { useMasterKey });

            if (file) {
              message.set('emailBodyFile', file);
              message.set('content', null);
              await message.save(null, { useMasterKey });
              migrated++;
            }
          }
        }

        skip += limit;

        if (messages.length < limit) {
          break;
        }
      }

      logger.info(`[ParseFileService] Migration complete: ${migrated}/${processed} messages migrated`);
      return { processed, migrated };
    } catch (error) {
      logger.error('[ParseFileService] Migration failed:', error);
      throw error;
    }
  },
};

module.exports = { parseFileService };

