const { getDatabase } = require('../config/database');
const { ObjectId } = require('mongodb');

/**
 * Product Model - MongoDB implementation
 */
class Product {
  static getCollection() {
    const db = getDatabase();
    if (!db) {
      throw new Error('Database not connected');
    }
    return db.collection('Product');
  }

  static async find(query = {}, options = {}) {
    const collection = this.getCollection();
    const cursor = collection.find(query);
    
    if (options.sort) cursor.sort(options.sort);
    if (options.limit) cursor.limit(options.limit);
    if (options.skip) cursor.skip(options.skip);
    
    const results = await cursor.toArray();
    return results.map(doc => ({
      id: doc._id.toString(),
      ...doc,
      get: (field) => doc[field]
    }));
  }

  static async get(id, options = {}) {
    const collection = this.getCollection();
    const doc = await collection.findOne({ _id: new ObjectId(id) });
    
    if (!doc) {
      const error = new Error('Object not found');
      error.code = 101;
      throw error;
    }
    
    return {
      id: doc._id.toString(),
      ...doc,
      get: (field) => doc[field]
    };
  }

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

  static async update(id, data) {
    const collection = this.getCollection();
    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...data, updatedAt: new Date() } }
    );
    
    if (result.matchedCount === 0) {
      const error = new Error('Object not found');
      error.code = 101;
      throw error;
    }
    
    return result;
  }

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

module.exports = Product;
