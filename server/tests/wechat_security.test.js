const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');
const crypto = require('crypto');

// Mock Config
const Config = require('../models/Config');
Config.get = async (key, defaultValue) => {
  if (key === 'webhookVerifyToken') return 'globalreach_secret_token';
  return defaultValue;
};

// Mock WebhookLog
const WebhookLog = require('../models/WebhookLog');
class MockWebhookLog {
  set(key, value) {
    this[key] = value;
  }
  async save(obj, options) {
    // mock save
  }
}
// Replace the WebhookLog model with our mock
require.cache[require.resolve('../models/WebhookLog')].exports = MockWebhookLog;

// Mock queueWebhook
const webhookQueue = require('../queues/webhookQueue');
webhookQueue.queueWebhook = async () => ({ success: true });

// Now require the router
const webhooksRouter = require('../routes/webhooks');

const app = express();
app.use(express.json());
app.use(express.text({ type: 'application/xml' }));
app.use('/webhooks', webhooksRouter);

test('GET /webhooks/wechat valid signature', async (t) => {
  const token = 'globalreach_secret_token';
  const timestamp = '123456789';
  const nonce = 'nonce123';
  const echostr = 'echostr123';

  const tmpStr = [token, timestamp, nonce].sort().join('');
  const sha1 = crypto.createHash('sha1').update(tmpStr).digest('hex');

  const response = await request(app)
    .get('/webhooks/wechat')
    .query({
      signature: sha1,
      timestamp,
      nonce,
      echostr
    });

  assert.strictEqual(response.status, 200, 'Expected 200 OK for valid signature');
  assert.strictEqual(response.text, echostr, 'Expected echostr to be returned');
});

test('GET /webhooks/wechat invalid signature', async (t) => {
  const timestamp = '123456789';
  const nonce = 'nonce123';
  const echostr = 'echostr123';

  const response = await request(app)
    .get('/webhooks/wechat')
    .query({
      signature: 'invalid_signature',
      timestamp,
      nonce,
      echostr
    });

  assert.strictEqual(response.status, 403, 'Expected 403 Forbidden for invalid signature');
});

test('GET /webhooks/wechat missing parameters', async (t) => {
  const response = await request(app)
    .get('/webhooks/wechat')
    .query({
      signature: 'foo'
    });

  assert.strictEqual(response.status, 400, 'Expected 400 Bad Request for missing parameters');
});

test('GET /webhooks/wechat type confusion (array injection)', async (t) => {
  const token = 'globalreach_secret_token';
  const timestamp = '123456789';
  const nonce = 'nonce123';
  const echostr = 'echostr123';

  const tmpStr = [token, timestamp, nonce].sort().join('');
  const sha1 = crypto.createHash('sha1').update(tmpStr).digest('hex');

  // Passing signature as an array
  // We use qs style array injection
  const response = await request(app)
    .get('/webhooks/wechat')
    .query('signature[]=abc&signature[]=def') // forcing signature to be an array
    .query({
      timestamp,
      nonce,
      echostr
    });

  // If no type checking, this might pass through or cause an error.
  // We want to ensure it is handled gracefully (400 Bad Request or 403).
  // Currently, the code just checks "signature". If it's an array, "sha1 === signature"
  // will compare a string to an array (which converts array to string "abc,def").
  // So it will likely be false (403), or if we use strict equality...

  // Wait, if it's an array, `sha1 === signature` will be false.
  // BUT if we pass `signature` such that array.toString() equals sha1... unlikely.

  // However, relying on implicit type coercion or failing silently is bad practice.
  // Also, if `signature` is used in a way that expects a string (e.g. `signature.length`),
  // an array has a length property too, which might confuse logic.

  // The goal is to enforce types.

  // If we fix it, we expect 400 because "signature" is not a string.

  // Expect 400 Bad Request for array injection
  assert.strictEqual(response.status, 400, 'Expected 400 Bad Request for array injection');
});
