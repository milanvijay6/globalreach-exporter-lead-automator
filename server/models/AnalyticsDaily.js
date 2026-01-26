const { getDatabase } = require('../config/database');
const { ObjectId } = require('mongodb');

class AnalyticsDaily {
  static getCollection() {
    const db = getDatabase();
    if (!db) throw new Error('Database not connected');
    return db.collection('AnalyticsDaily');
  }

  static async find(query = {}, options = {}) {
    const collection = this.getCollection();
    const cursor = collection.find(query);
    if (options.sort) cursor.sort(options.sort);
    if (options.limit) cursor.limit(options.limit);
    const results = await cursor.toArray();
    return results.map(doc => ({ id: doc._id.toString(), ...doc, get: (field) => doc[field] }));
  }

  static async upsert(query, data) {
    const collection = this.getCollection();
    const result = await collection.updateOne(
      query,
      { $set: { ...data, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true }
    );
    return result;
  }
}

module.exports = AnalyticsDaily;
