const Lead = require('../models/Lead');
const Message = require('../models/Message');
const MessagingService = require('./messagingService');

/**
 * Lead Service - Handles lead management and messaging
 */
class LeadService {
  static async getAll(filters = {}) {
    try {
      const leads = await Lead.findAll(filters);
      return leads.map(l => l.toJSON());
    } catch (error) {
      console.error('[LeadService] Error getting leads:', error);
      throw error;
    }
  }

  static async getById(id) {
    try {
      const lead = await Lead.findById(id);
      return lead ? lead.toJSON() : null;
    } catch (error) {
      console.error('[LeadService] Error getting lead:', error);
      throw error;
    }
  }

  static async create(data) {
    try {
      const lead = await Lead.create(data);
      return lead.toJSON();
    } catch (error) {
      console.error('[LeadService] Error creating lead:', error);
      throw error;
    }
  }

  static async update(id, data) {
    try {
      const lead = await Lead.update(id, data);
      return lead.toJSON();
    } catch (error) {
      console.error('[LeadService] Error updating lead:', error);
      throw error;
    }
  }

  static async delete(id) {
    try {
      await Lead.delete(id);
      return true;
    } catch (error) {
      console.error('[LeadService] Error deleting lead:', error);
      throw error;
    }
  }

  static async sendMessage(leadId, message) {
    try {
      const lead = await Lead.findById(leadId);
      if (!lead) {
        throw new Error('Lead not found');
      }
      
      const leadData = lead.toJSON();
      
      // Determine channel from lead data
      const channel = leadData.preferredChannel || 'email';
      const contactDetail = leadData.email || leadData.phone || leadData.contactDetail;
      
      if (!contactDetail) {
        throw new Error('Lead does not have contact information');
      }
      
      // Send message via messaging service
      const result = await MessagingService.sendMessage(
        leadId,
        contactDetail,
        message,
        channel,
        leadData
      );
      
      // Save message to database
      await Message.create({
        leadId: leadId,
        channel: channel,
        content: message,
        direction: 'outbound',
        status: result.success ? 'sent' : 'failed',
        timestamp: Date.now(),
      });
      
      return result;
    } catch (error) {
      console.error('[LeadService] Error sending message:', error);
      throw error;
    }
  }
}

module.exports = LeadService;

