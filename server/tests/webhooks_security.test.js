const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');
const crypto = require('crypto');
const proxyquire = require('proxyquire').noCallThru();

// Mock Config model
const mockConfig = {
  get: async (key) => {
    if (key === 'webhookVerifyToken') return 'globalreach_secret_token';
    if (key === 'whatsappAppSecret') return 'test_secret';
    return null;
  }
};

// Mock WebhookLog
const mockWebhookLog = class {
  set() {}
  async save() {}
};

// Mock queueWebhook
const mockQueueWebhook = async () => {};

// Mock winston
const mockWinston = {
  createLogger: () => ({
    info: () => {},
    warn: () => {},
    error: () => {},
    format: {
      combine: () => {},
      timestamp: () => {},
      json: () => {}
    },
    transports: {
      Console: class {}
    }
  }),
  format: {
    combine: () => {},
    timestamp: () => {},
    json: () => {},
    simple: () => {} // Added simple format mock
  },
  transports: {
    Console: class {}
  }
};

// Use proxyquire to load the module with mocks
const webhooksRouter = proxyquire('../routes/webhooks', {
  '../models/Config': mockConfig,
  '../models/WebhookLog': mockWebhookLog,
  '../queues/webhookQueue': { queueWebhook: mockQueueWebhook },
  'winston': mockWinston
});

const app = express();
// Mimic rawBody capture
app.use(express.json({
  verify: (req, res, buf) => { req.rawBody = buf; }
}));
app.use('/webhooks', webhooksRouter);

test('WhatsApp Webhook Verification - Success', async () => {
  const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
  const secret = 'test_secret';
  const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');

  const response = await request(app)
    .post('/webhooks/whatsapp')
    .set('X-Hub-Signature-256', signature)
    .set('Content-Type', 'application/json')
    .send(payload);

  assert.strictEqual(response.status, 200);
});

test('WhatsApp Webhook Verification - Invalid Signature', async () => {
  const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
  const signature = 'sha256=' + 'invalid_hash';

  const response = await request(app)
    .post('/webhooks/whatsapp')
    .set('X-Hub-Signature-256', signature)
    .set('Content-Type', 'application/json')
    .send(payload);

  assert.strictEqual(response.status, 403);
});

test('WeChat Webhook Verification - Timing Attack Safe', async () => {
  // This test mainly verifies that the code runs without error and returns 403 for invalid signature
  // proving that we are using a comparison that doesn't crash
  const token = 'globalreach_secret_token';
  const timestamp = '123456789';
  const nonce = 'nonce123';
  const signature = 'invalid_signature';

  const response = await request(app)
    .get('/webhooks/wechat')
    .query({ signature, timestamp, nonce, echostr: 'echo' });

  assert.strictEqual(response.status, 403);
});
