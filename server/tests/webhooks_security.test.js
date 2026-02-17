const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');
const crypto = require('crypto');

// Mock dependencies
const mockConfig = {
  get: async (key) => {
    if (key === 'whatsappAppSecret') return 'test_secret';
    return null;
  }
};
const mockWebhookLog = class {
  set() {}
  async save() {}
};
const mockQueueWebhook = {
  queueWebhook: async () => {}
};

// Mock modules
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(path) {
  if (path.includes('models/Config')) return mockConfig;
  if (path.includes('models/WebhookLog')) return mockWebhookLog;
  if (path.includes('queues/webhookQueue')) return mockQueueWebhook;
  return originalRequire.apply(this, arguments);
};

// Setup Express App with Webhook Routes
const setupApp = () => {
  const webhookRouter = require('../routes/webhooks');
  const app = express();

  // Middleware to simulate rawBody (critical for verification)
  app.use(express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    }
  }));

  app.use('/webhooks', webhookRouter);
  return app;
};

test('WhatsApp Webhook Security', async (t) => {
  const app = setupApp();
  const secret = 'test_secret';
  const body = { object: 'whatsapp_business_account', entry: [] };
  const jsonBody = JSON.stringify(body);

  await t.test('should accept valid signature', async () => {
    const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(jsonBody).digest('hex');

    const res = await request(app)
      .post('/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', signature)
      .send(jsonBody);

    assert.strictEqual(res.status, 200);
  });

  await t.test('should reject invalid signature', async () => {
    const signature = 'sha256=' + 'invalid_hash_value';

    const res = await request(app)
      .post('/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', signature)
      .send(jsonBody);

    assert.strictEqual(res.status, 403);
  });

  await t.test('should reject missing signature header', async () => {
    const res = await request(app)
      .post('/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .send(jsonBody);

    assert.strictEqual(res.status, 401);
  });

  await t.test('should reject malformed signature header', async () => {
    const res = await request(app)
      .post('/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', 'malformed_signature') // Missing 'sha256=' or '='
      .send(jsonBody);

    assert.strictEqual(res.status, 401);
  });

  // Test case for missing rawBody (internal server configuration issue)
  await t.test('should fail safely if rawBody is missing', async () => {
    // Create an app instance WITHOUT the rawBody middleware
    const brokenApp = express();
    brokenApp.use(express.json()); // Standard json parser without verify callback
    const webhookRouter = require('../routes/webhooks');
    brokenApp.use('/webhooks', webhookRouter);

    const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(jsonBody).digest('hex');

    const res = await request(brokenApp)
      .post('/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', signature)
      .send(jsonBody);

    assert.strictEqual(res.status, 500); // Should fail closed
  });
});
