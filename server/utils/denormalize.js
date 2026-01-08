/**
 * Denormalization Utilities
 * Syncs frequently-accessed data directly into objects to avoid joins
 */

const Parse = require('parse/node');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

/**
 * Denormalization Service
 * Embeds frequently-accessed fields directly in objects
 */
const denormalize = {
  /**
   * Update Lead object with embedded leadScore and other frequently-accessed fields
   * This avoids joins when querying leads
   * @param {Parse.Object} lead - Lead object to update
   * @param {Object} data - Data to embed (leadScore, lastContacted, status, country)
   * @param {Object} options - Options
   * @returns {Promise<Parse.Object>} Updated lead object
   */
  async embedLeadData(lead, data, options = {}) {
    try {
      const { useMasterKey = true, save = true } = options;

      // Embed leadScore if provided
      if (data.leadScore !== undefined) {
        lead.set('leadScore', data.leadScore);
        lead.set('scoreUpdatedAt', new Date());
      }

      // Embed lastContacted if provided
      if (data.lastContacted !== undefined) {
        lead.set('lastContacted', data.lastContacted);
      }

      // Embed status if provided
      if (data.status !== undefined) {
        lead.set('status', data.status);
      }

      // Embed country if provided
      if (data.country !== undefined) {
        lead.set('country', data.country);
      }

      // Save if requested
      if (save) {
        await lead.save(null, { useMasterKey });
        logger.debug(`[Denormalize] Embedded data in Lead ${lead.id}`);
      }

      return lead;
    } catch (error) {
      logger.error('[Denormalize] Failed to embed lead data:', error);
      throw error;
    }
  },

  /**
   * Sync leadScore from related data into Lead object
   * Calculates score based on lead activity and updates Lead directly
   * @param {Parse.Object} lead - Lead object
   * @param {Object} options - Options
   * @returns {Promise<number>} Calculated lead score
   */
  async syncLeadScore(lead, options = {}) {
    try {
      const { useMasterKey = true } = options;

      // Calculate lead score based on various factors
      let score = 0;

      // Base score from status
      const status = lead.get('status');
      const statusScores = {
        'ENGAGED': 60,
        'CONTACTED': 40,
        'PENDING': 20,
        'QUALIFIED': 80,
        'CLOSED': 100,
        'COLD': 10,
      };
      score += statusScores[status] || 20;

      // Boost from lastContacted (recent contact = higher score)
      const lastContacted = lead.get('lastContacted');
      if (lastContacted) {
        const daysSinceContact = (Date.now() - new Date(lastContacted).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceContact < 7) {
          score += 20; // Recent contact
        } else if (daysSinceContact < 30) {
          score += 10; // Recent-ish contact
        }
      }

      // Boost from country (if high-value market)
      const country = lead.get('country');
      const highValueCountries = ['USA', 'UK', 'Germany', 'France', 'Canada', 'Australia'];
      if (highValueCountries.includes(country)) {
        score += 10;
      }

      // Ensure score is between 0-100
      score = Math.min(100, Math.max(0, score));

      // Update lead with embedded score
      await this.embedLeadData(lead, { leadScore: score }, { useMasterKey, save: true });

      logger.debug(`[Denormalize] Synced leadScore ${score} for Lead ${lead.id}`);
      return score;
    } catch (error) {
      logger.error('[Denormalize] Failed to sync lead score:', error);
      throw error;
    }
  },

  /**
   * Batch update multiple leads with embedded data
   * @param {Array<Parse.Object>} leads - Array of Lead objects
   * @param {Function} dataFn - Function that returns data to embed for each lead
   * @param {Object} options - Options
   * @returns {Promise<Array<Parse.Object>>} Updated leads
   */
  async batchEmbedLeadData(leads, dataFn, options = {}) {
    try {
      const { useMasterKey = true, batchSize = 50 } = options;
      const updated = [];

      // Process in batches
      for (let i = 0; i < leads.length; i += batchSize) {
        const batch = leads.slice(i, i + batchSize);
        
        for (const lead of batch) {
          const data = await dataFn(lead);
          if (data) {
            await this.embedLeadData(lead, data, { useMasterKey, save: false });
            updated.push(lead);
          }
        }

        // Save batch
        if (updated.length > 0) {
          await Parse.Object.saveAll(updated, { useMasterKey });
          logger.info(`[Denormalize] Batch embedded data in ${updated.length} leads`);
        }
      }

      return updated;
    } catch (error) {
      logger.error('[Denormalize] Failed to batch embed lead data:', error);
      throw error;
    }
  },

  /**
   * Migrate existing leads to have embedded leadScore
   * @param {Object} options - Options
   * @returns {Promise<{ processed: number, updated: number }>} Migration results
   */
  async migrateLeadScores(options = {}) {
    try {
      const { useMasterKey = true, limit = 100 } = options;
      const Lead = require('../models/Lead');
      
      let processed = 0;
      let updated = 0;
      let skip = 0;

      while (true) {
        const query = new Parse.Query(Lead);
        query.skip(skip);
        query.limit(limit);
        
        const leads = await query.find({ useMasterKey });
        
        if (leads.length === 0) {
          break;
        }

        for (const lead of leads) {
          processed++;
          
          // Only update if leadScore is missing or outdated
          const currentScore = lead.get('leadScore');
          const scoreUpdatedAt = lead.get('scoreUpdatedAt');
          
          if (!currentScore || !scoreUpdatedAt) {
            await this.syncLeadScore(lead, { useMasterKey });
            updated++;
          }
        }

        skip += limit;
        
        if (leads.length < limit) {
          break;
        }
      }

      logger.info(`[Denormalize] Migration complete: ${updated}/${processed} leads updated`);
      return { processed, updated };
    } catch (error) {
      logger.error('[Denormalize] Migration failed:', error);
      throw error;
    }
  },
};

module.exports = { denormalize };

