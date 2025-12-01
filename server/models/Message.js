const Parse = require('../config/parse');

/**
 * Message Model - Stores messages/conversations
 */
class Message extends Parse.Object {
  constructor() {
    super('Message');
  }

  static async create(data) {
    const message = new Message();
    Object.keys(data).forEach(key => {
      message.set(key, data[key]);
    });
    return await message.save(null, { useMasterKey: true });
  }

  static async findById(id) {
    const query = new Parse.Query(Message);
    return await query.get(id, { useMasterKey: true });
  }

  static async findByLead(leadId) {
    const query = new Parse.Query(Message);
    query.equalTo('leadId', leadId);
    query.descending('createdAt');
    return await query.find({ useMasterKey: true });
  }

  static async findByChannel(channel, filters = {}) {
    const query = new Parse.Query(Message);
    query.equalTo('channel', channel);
    
    if (filters.status) {
      query.equalTo('status', filters.status);
    }
    if (filters.from) {
      query.greaterThanOrEqualTo('createdAt', filters.from);
    }
    if (filters.to) {
      query.lessThanOrEqualTo('createdAt', filters.to);
    }
    
    query.descending('createdAt');
    if (filters.limit) {
      query.limit(filters.limit);
    }
    
    return await query.find({ useMasterKey: true });
  }

  static async update(id, data) {
    const message = await Message.findById(id);
    if (!message) {
      throw new Error('Message not found');
    }
    Object.keys(data).forEach(key => {
      message.set(key, data[key]);
    });
    return await message.save(null, { useMasterKey: true });
  }
}

Parse.Object.registerSubclass('Message', Message);

module.exports = Message;

