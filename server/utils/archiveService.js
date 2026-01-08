/**
 * Archive Service
 * Utilities for archiving old data to separate Parse classes
 */

const Parse = require('parse/node');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

const CampaignArchive = require('../models/CampaignArchive');
const MessageArchive = require('../models/MessageArchive');

// Archive thresholds
const CAMPAIGN_ARCHIVE_DAYS = 90;
const MESSAGE_ARCHIVE_DAYS = 180;

/**
 * Archive Service
 */
const archiveService = {
  /**
   * Archive old campaigns to CampaignArchive class
   * Archives campaigns that are completed and older than threshold
   * @param {Object} options - Options
   * @returns {Promise<{ archived: number, errors: number }>} Archive results
   */
  async archiveOldCampaigns(options = {}) {
    try {
      const { useMasterKey = true, limit = 100, dryRun = false } = options;
      
      // Note: Campaigns are currently stored in IndexedDB, not Parse
      // This function is prepared for when campaigns are migrated to Parse
      // For now, it's a placeholder that can be extended
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - CAMPAIGN_ARCHIVE_DAYS);

      logger.info(`[ArchiveService] Archiving campaigns older than ${cutoffDate.toISOString()}`);
      
      // TODO: When campaigns are in Parse, query and archive them
      // const Campaign = require('../models/Campaign');
      // const query = new Parse.Query(Campaign);
      // query.equalTo('status', 'completed');
      // query.lessThan('updatedAt', cutoffDate);
      // query.limit(limit);
      // const campaigns = await query.find({ useMasterKey });
      
      // For now, return empty result
      return { archived: 0, errors: 0 };
    } catch (error) {
      logger.error('[ArchiveService] Failed to archive campaigns:', error);
      return { archived: 0, errors: 1 };
    }
  },

  /**
   * Archive old messages to MessageArchive class
   * Archives messages older than threshold and not in active conversations
   * @param {Object} options - Options
   * @returns {Promise<{ archived: number, errors: number }>} Archive results
   */
  async archiveOldMessages(options = {}) {
    try {
      const { useMasterKey = true, limit = 500, dryRun = false } = options;
      const Message = require('../models/Message');

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - MESSAGE_ARCHIVE_DAYS);
      const cutoffTimestamp = cutoffDate.getTime();

      logger.info(`[ArchiveService] Archiving messages older than ${cutoffDate.toISOString()}`);

      // Query old messages that are not in active conversations
      const query = new Parse.Query(Message);
      query.lessThan('timestamp', cutoffTimestamp);
      query.notEqualTo('status', 'active'); // Don't archive active messages
      query.limit(limit);
      query.ascending('timestamp'); // Archive oldest first

      const messages = await query.find({ useMasterKey });

      if (messages.length === 0) {
        logger.info('[ArchiveService] No messages to archive');
        return { archived: 0, errors: 0 };
      }

      if (dryRun) {
        logger.info(`[ArchiveService] DRY RUN: Would archive ${messages.length} messages`);
        return { archived: messages.length, errors: 0 };
      }

      // Create archive objects
      const archiveObjects = messages.map(msg => {
        const archive = new MessageArchive();
        
        // Copy all fields from original message
        const fields = msg.attributes;
        Object.keys(fields).forEach(key => {
          if (key !== 'objectId' && key !== 'createdAt' && key !== 'updatedAt') {
            archive.set(key, fields[key]);
          }
        });
        
        // Add archive metadata
        archive.set('archivedAt', new Date());
        archive.set('originalObjectId', msg.id);
        
        return archive;
      });

      // Save archive objects
      await Parse.Object.saveAll(archiveObjects, { useMasterKey });

      // Delete original messages
      await Parse.Object.destroyAll(messages, { useMasterKey });

      logger.info(`[ArchiveService] Archived ${messages.length} messages`);
      return { archived: messages.length, errors: 0 };
    } catch (error) {
      logger.error('[ArchiveService] Failed to archive messages:', error);
      return { archived: 0, errors: 1 };
    }
  },

  /**
   * Restore archived message (if needed for historical queries)
   * @param {string} originalObjectId - Original message object ID
   * @param {Object} options - Options
   * @returns {Promise<Parse.Object|null>} Restored message or null
   */
  async restoreMessage(originalObjectId, options = {}) {
    try {
      const { useMasterKey = true } = options;
      const Message = require('../models/Message');

      // Find archived message
      const query = new Parse.Query(MessageArchive);
      query.equalTo('originalObjectId', originalObjectId);
      const archived = await query.first({ useMasterKey });

      if (!archived) {
        return null;
      }

      // Create new message from archive
      const message = new Message();
      const fields = archived.attributes;
      Object.keys(fields).forEach(key => {
        if (!['objectId', 'createdAt', 'updatedAt', 'archivedAt', 'originalObjectId'].includes(key)) {
          message.set(key, fields[key]);
        }
      });

      await message.save(null, { useMasterKey });
      logger.info(`[ArchiveService] Restored message ${originalObjectId}`);
      return message;
    } catch (error) {
      logger.error('[ArchiveService] Failed to restore message:', error);
      return null;
    }
  },

  /**
   * Query archived messages
   * @param {Object} filters - Query filters
   * @param {Object} options - Options
   * @returns {Promise<Array<Parse.Object>>} Archived messages
   */
  async queryArchivedMessages(filters = {}, options = {}) {
    try {
      const { useMasterKey = true, limit = 100 } = options;

      const query = new Parse.Query(MessageArchive);

      if (filters.importerId) {
        query.equalTo('importerId', filters.importerId);
      }

      if (filters.channel) {
        query.equalTo('channel', filters.channel);
      }

      if (filters.startDate) {
        query.greaterThanOrEqualTo('timestamp', filters.startDate.getTime());
      }

      if (filters.endDate) {
        query.lessThanOrEqualTo('timestamp', filters.endDate.getTime());
      }

      query.descending('timestamp');
      query.limit(limit);

      const messages = await query.find({ useMasterKey });
      return messages;
    } catch (error) {
      logger.error('[ArchiveService] Failed to query archived messages:', error);
      return [];
    }
  },
};

module.exports = { archiveService };

