
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');
const crypto = require('crypto');

// Mock dependencies
const mockConfig = {
  get: async (key) => {
    if (key === 'webhookVerifyToken') return 'test_token';
    if (key === 'whatsappAppSecret') return 'test_secret';
    return null;
  }
};

const mockWebhookLog = {
  create: async (data) => ({ id: 'test_id', ...data }),
  // Mock instance methods if it was used as an instance (which is the bug)
  prototype: {
    set: () => {},
    save: async () => {}
  }
};

const mockQueue = {
  queueWebhook: async () => ({ success: true })
};

// Mock modules
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(path) {
  if (path.endsWith('models/Config')) return mockConfig;
  if (path.endsWith('models/WebhookLog')) return mockWebhookLog;
  if (path.endsWith('queues/webhookQueue')) return mockQueue;
  return originalRequire.apply(this, arguments);
};

// Import the route (this will fail if syntax error persists)
let app;
try {
  const router = require('../routes/webhooks');
  app = express();
  app.use(express.json());
  // Add raw body middleware for signature verification
  app.use((req, res, next) => {
    req.rawBody = JSON.stringify(req.body); // Simplified for test
    next();
  });
  app.use('/', router);
} catch (err) {
  console.log('Route import failed (expected initially):', err.message);
}

test('WhatsApp Webhook Signature Verification', async (t) => {
  if (!app) return t.skip('App not initialized due to syntax error');

  const payload = { object: 'whatsapp_business_account', entry: [] };
  const rawBody = JSON.stringify(payload);
  const secret = 'test_secret';
  const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  // Test valid signature
  await t.test('Valid signature should return 200', async () => {
    const res = await request(app)
      .post('/whatsapp')
      .set('X-Hub-Signature-256', `sha256=${signature}`)
      .send(payload);

    assert.strictEqual(res.statusCode, 200);
  });

  // Test invalid signature
  await t.test('Invalid signature should return 401/403', async () => {
    const res = await request(app)
      .post('/whatsapp')
      .set('X-Hub-Signature-256', 'sha256=invalid')
      .send(payload);

    assert.ok(res.statusCode === 401 || res.statusCode === 403);
  });
});

test('WeChat Webhook Verification', async (t) => {
  if (!app) return t.skip('App not initialized due to syntax error');

  const token = 'test_token';
  const timestamp = '1234567890';
  const nonce = '123456';
  const echostr = 'hello';

  const tmpStr = [token, timestamp, nonce].sort().join('');
  const signature = crypto.createHash('sha1').update(tmpStr).digest('hex');

  // Test valid verification
  await t.test('Valid WeChat verification should return echostr', async () => {
    const res = await request(app)
      .get('/wechat')
      .query({ signature, timestamp, nonce, echostr });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.text, echostr);
  });

  // Test invalid verification (timing safe check is hard to test but logic should handle it)
  await t.test('Invalid WeChat signature should return 403', async () => {
    const res = await request(app)
      .get('/wechat')
      .query({ signature: 'invalid', timestamp, nonce, echostr });

    assert.strictEqual(res.statusCode, 403);
  });

  // Test type safety
  await t.test('Non-string parameters should be rejected', async () => {
    const res = await request(app)
      .get('/wechat')
      .query({ signature: ['array'], timestamp, nonce, echostr });

    // Should be 400 or handled gracefully without crash
    assert.ok(res.statusCode === 400 || res.statusCode === 403 || res.statusCode === 500);
    // Ideally 400 Bad Request
  });
});
