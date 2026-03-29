const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');
const crypto = require('crypto');
const path = require('path');

// Mock Config Model
const mockConfig = {
  get: async (key) => {
    if (key === 'webhookVerifyToken') return 'globalreach_secret_token';
    if (key === 'whatsappAppSecret') return 'test_app_secret';
    return null;
  }
};

// Mock WebhookLog Model
class MockWebhookLog {
  constructor() {
    this.data = {};
  }
  set(key, value) {
    this.data[key] = value;
  }
  async save() {
    return Promise.resolve(this);
  }
}

// Mock Queue
const mockQueueWebhook = async (channel, payload) => {
  return Promise.resolve();
};

// Mock dependencies
// We use a helper function to safely resolve paths relative to the test file location
const resolvePath = (relativePath) => require.resolve(path.join(__dirname, relativePath));

const configPath = resolvePath('../models/Config');
const webhookLogPath = resolvePath('../models/WebhookLog');
const queuePath = resolvePath('../queues/webhookQueue');

// Override require cache
require.cache[configPath] = {
  id: configPath,
  filename: configPath,
  loaded: true,
  exports: mockConfig
};

require.cache[webhookLogPath] = {
  id: webhookLogPath,
  filename: webhookLogPath,
  loaded: true,
  exports: MockWebhookLog
};

require.cache[queuePath] = {
  id: queuePath,
  filename: queuePath,
  loaded: true,
  exports: { queueWebhook: mockQueueWebhook }
};

// Load router AFTER mocking dependencies
// Use try-catch to handle potential syntax errors in the route file
let webhookRouter;
try {
  webhookRouter = require('../routes/webhooks');
} catch (error) {
  console.error('Failed to load webhook router:', error);
}

const app = express();

// Middleware to capture raw body for signature verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

if (webhookRouter) {
  app.use('/webhooks', webhookRouter);
}

describe('Webhook Security Tests', () => {

  // Skip tests if router failed to load (likely due to syntax error we expect)
  if (!webhookRouter) {
    it('should fail to load router due to syntax error', () => {
      assert.fail('Router failed to load, likely due to duplicate variable declaration');
    });
    return;
  }

  describe('WhatsApp Webhook Verification (GET)', () => {
    it('should return challenge if token matches', async () => {
      const response = await request(app)
        .get('/webhooks/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'globalreach_secret_token',
          'hub.challenge': '123456'
        });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.text, '123456');
    });

    it('should return 403 if token does not match', async () => {
      const response = await request(app)
        .get('/webhooks/whatsapp')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong_token',
          'hub.challenge': '123456'
        });

      assert.strictEqual(response.status, 403);
    });
  });

  describe('WhatsApp Webhook Signature (POST)', () => {
    const payload = JSON.stringify({ object: 'whatsapp_business_account' });
    const secret = 'test_app_secret';

    it('should accept valid signature', async () => {
      const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

      const response = await request(app)
        .post('/webhooks/whatsapp')
        .set('X-Hub-Signature-256', `sha256=${signature}`)
        .set('Content-Type', 'application/json')
        .send(payload);

      assert.strictEqual(response.status, 200);
    });

    it('should reject invalid signature', async () => {
      const response = await request(app)
        .post('/webhooks/whatsapp')
        .set('X-Hub-Signature-256', 'sha256=invalid_signature')
        .set('Content-Type', 'application/json')
        .send(payload);

      assert.strictEqual(response.status, 403);
    });

    it('should reject missing signature', async () => {
      const response = await request(app)
        .post('/webhooks/whatsapp')
        .set('Content-Type', 'application/json')
        .send(payload);

      assert.strictEqual(response.status, 401);
    });
  });

  describe('WeChat Webhook Verification (GET)', () => {
    const token = 'globalreach_secret_token';
    const timestamp = '1234567890';
    const nonce = '123456';
    const echostr = 'echostr_value';

    it('should verify valid signature', async () => {
      const tmpStr = [token, timestamp, nonce].sort().join('');
      const signature = crypto.createHash('sha1').update(tmpStr).digest('hex');

      const response = await request(app)
        .get('/webhooks/wechat')
        .query({
          signature,
          timestamp,
          nonce,
          echostr
        });

      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.text, echostr);
    });

    it('should reject invalid signature', async () => {
      const response = await request(app)
        .get('/webhooks/wechat')
        .query({
          signature: 'invalid',
          timestamp,
          nonce,
          echostr
        });

      assert.strictEqual(response.status, 403);
    });

    it('should handle non-string inputs gracefully (DoS prevention)', async () => {
      // Simulate array input for signature which might crash sort() or join() if not handled
      // Actually, Express query parser might return arrays for duplicate keys
      // e.g. ?signature=a&signature=b -> signature=['a', 'b']

      const response = await request(app)
        .get('/webhooks/wechat')
        .query({
          signature: ['a', 'b'], // Invalid type
          timestamp,
          nonce,
          echostr
        });

      // It should probably be 403 or 400, but definitely NOT 500
      assert.notStrictEqual(response.status, 500);
    });
  });
});
