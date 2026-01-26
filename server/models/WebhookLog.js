const { getDatabase } = require('../config/database');
const { ObjectId } = require('mongodb');

class WebhookLog {
  static getCollection() {
    const db = getDatabase();
    if (!db) throw new Error('Database not connected');
    return db.collection('WebhookLog');
  }

  static async create(data) {
    const collection = this.getCollection();
    const doc = { ...data, createdAt: new Date() };
    const result = await collection.insertOne(doc);
    return { id: result.insertedId.toString(), ...doc };
  }

  static async find(query = {}, options = {}) {
    const collection = this.getCollection();
    const cursor = collection.find(query);
    if (options.sort) cursor.sort(options.sort);
    if (options.limit) cursor.limit(options.limit);
    const results = await cursor.toArray();
    return results.map(doc => ({ id: doc._id.toString(), ...doc }));
  }
}

module.exports = WebhookLog;
