const Parse = require('../config/parse');

/**
 * WebhookLog Model - Stores webhook events for debugging and auditing
 */
class WebhookLog extends Parse.Object {
  constructor() {
    super('WebhookLog');
  }

  static async create(data) {
    const log = new WebhookLog();
    log.set('channel', data.channel || 'unknown');
    log.set('payload', data.payload || {});
    log.set('headers', data.headers || {});
    log.set('ip', data.ip || 'unknown');
    log.set('processed', data.processed || false);
    log.set('error', data.error || null);
    return await log.save(null, { useMasterKey: true });
  }

  static async findByChannel(channel, limit = 100) {
    const query = new Parse.Query(WebhookLog);
    query.equalTo('channel', channel);
    query.descending('createdAt');
    query.limit(limit);
    return await query.find({ useMasterKey: true });
  }

  static async findRecent(limit = 100) {
    const query = new Parse.Query(WebhookLog);
    query.descending('createdAt');
    query.limit(limit);
    return await query.find({ useMasterKey: true });
  }

  static async findErrors(limit = 50) {
    const query = new Parse.Query(WebhookLog);
    query.exists('error');
    query.descending('createdAt');
    query.limit(limit);
    return await query.find({ useMasterKey: true });
  }
}

Parse.Object.registerSubclass('WebhookLog', WebhookLog);

module.exports = WebhookLog;

