const Parse = require('../config/parse');

/**
 * Lead Model - Stores customer/lead information
 */
class Lead extends Parse.Object {
  constructor() {
    super('Lead');
  }

  static async create(data) {
    const lead = new Lead();
    Object.keys(data).forEach(key => {
      lead.set(key, data[key]);
    });
    return await lead.save(null, { useMasterKey: true });
  }

  static async findById(id) {
    const query = new Parse.Query(Lead);
    return await query.get(id, { useMasterKey: true });
  }

  static async findAll(filters = {}) {
    const query = new Parse.Query(Lead);
    
    if (filters.status) {
      query.equalTo('status', filters.status);
    }
    if (filters.source) {
      query.equalTo('source', filters.source);
    }
    if (filters.search) {
      query.contains('name', filters.search);
      query.contains('email', filters.search);
      query.contains('phone', filters.search);
    }
    
    if (filters.limit) {
      query.limit(filters.limit);
    }
    if (filters.offset) {
      query.skip(filters.offset);
    }
    
    query.descending('createdAt');
    return await query.find({ useMasterKey: true });
  }

  static async update(id, data) {
    const lead = await Lead.findById(id);
    if (!lead) {
      throw new Error('Lead not found');
    }
    Object.keys(data).forEach(key => {
      lead.set(key, data[key]);
    });
    return await lead.save(null, { useMasterKey: true });
  }

  static async delete(id) {
    const lead = await Lead.findById(id);
    if (!lead) {
      throw new Error('Lead not found');
    }
    return await lead.destroy({ useMasterKey: true });
  }
}

Parse.Object.registerSubclass('Lead', Lead);

module.exports = Lead;

