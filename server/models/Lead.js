const { getDatabase } = require('../config/database');
const { ObjectId } = require('mongodb');

/**
 * Lead Model - MongoDB implementation
 */
class Lead {
  /**
   * Get collection
   */
  static getCollection() {
    const db = getDatabase();
    if (!db) {
      throw new Error('Database not connected');
    }
    return db.collection('Lead');
  }

  /**
   * Find leads with query (Parse-compatible API)
   */
  static async find(query = {}, options = {}) {
    const collection = this.getCollection();
    const cursor = collection.find(query);
    
    if (options.sort) {
      cursor.sort(options.sort);
    }
    
    if (options.limit) {
      cursor.limit(options.limit);
    }
    
    if (options.skip) {
      cursor.skip(options.skip);
    }
    
    const results = await cursor.toArray();
    
    // Convert to Parse-like format (id instead of _id)
    return results.map(doc => ({
      id: doc._id.toString(),
      ...doc,
      get: (field) => doc[field],
      toJSON: () => ({ id: doc._id.toString(), ...doc })
    }));
  }

  /**
   * Find one lead by ID
   */
  static async get(id, options = {}) {
    const collection = this.getCollection();
    const doc = await collection.findOne({ _id: new ObjectId(id) });
    
    if (!doc) {
      const error = new Error('Object not found');
      error.code = 101; // Parse.Error.OBJECT_NOT_FOUND
      throw error;
    }
    
    return {
      id: doc._id.toString(),
      ...doc,
      get: (field) => doc[field],
      toJSON: () => ({ id: doc._id.toString(), ...doc })
    };
  }

  /**
   * Create new lead
   */
  static async create(data) {
    const collection = this.getCollection();
    const doc = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await collection.insertOne(doc);
    return {
      id: result.insertedId.toString(),
      ...doc,
      get: (field) => doc[field]
    };
  }

  /**
   * Update lead
   */
  static async update(id, data) {
    const collection = this.getCollection();
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          ...data,
          updatedAt: new Date()
        }
      }
    );
    
    if (result.matchedCount === 0) {
      const error = new Error('Object not found');
      error.code = 101;
      throw error;
    }
    
    return result;
  }

  /**
   * Delete lead
   */
  static async delete(id) {
    const collection = this.getCollection();
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    
    if (result.deletedCount === 0) {
      const error = new Error('Object not found');
      error.code = 101;
      throw error;
    }
    
    return result;
  }
}

module.exports = Lead;
