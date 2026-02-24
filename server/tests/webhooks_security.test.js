const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');
const crypto = require('crypto');

// Mock Config
const Config = require('../models/Config');
// Backup original method
const originalConfigGet = Config.get;

// Mock Config.get
Config.get = async (key) => {
  if (key === 'whatsappAppSecret') return 'test_secret';
  if (key === 'webhookVerifyToken') return 'test_token';
  return null;
};

// Mock queueWebhook to avoid side effects
const webhookQueueModule = require('../queues/webhookQueue');
webhookQueueModule.queueWebhook = async () => {
  return { success: true };
};

const webhooksRouter = require('../routes/webhooks');

const app = express();
// Mimic server/index.js middleware for rawBody
app.use(express.json({
  verify: (req, res, buf) => { req.rawBody = buf; }
}));
app.use(express.urlencoded({ extended: true }));

app.use('/webhooks', webhooksRouter);

test('WhatsApp Webhook Security', async (t) => {
  await t.test('POST /webhooks/whatsapp - Valid Signature', async () => {
    const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const signature = crypto
      .createHmac('sha256', 'test_secret')
      .update(payload)
      .digest('hex');

    const response = await request(app)
      .post('/webhooks/whatsapp')
      .set('X-Hub-Signature-256', `sha256=${signature}`)
      .set('Content-Type', 'application/json')
      .send(payload);

    assert.strictEqual(response.status, 200, 'Should return 200 OK for valid signature');
  });

  await t.test('POST /webhooks/whatsapp - Invalid Signature', async () => {
    const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const response = await request(app)
      .post('/webhooks/whatsapp')
      .set('X-Hub-Signature-256', 'sha256=invalid_signature')
      .set('Content-Type', 'application/json')
      .send(payload);

    assert.ok([401, 403].includes(response.status), `Expected 401 or 403, got ${response.status}`);
  });

  await t.test('POST /webhooks/whatsapp - Missing Signature', async () => {
    const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const response = await request(app)
      .post('/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .send(payload);

    assert.strictEqual(response.status, 401, 'Should return 401 for missing signature');
  });
});

test('WeChat Webhook Security', async (t) => {
  await t.test('GET /webhooks/wechat - Valid Signature', async () => {
    const token = 'test_token';
    const timestamp = '1234567890';
    const nonce = '12345';
    const echostr = 'hello';

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

  await t.test('GET /webhooks/wechat - Invalid Signature', async () => {
    const response = await request(app)
      .get('/webhooks/wechat')
      .query({
        signature: 'invalid',
        timestamp: '1234567890',
        nonce: '12345',
        echostr: 'hello'
      });

    assert.strictEqual(response.status, 403);
  });

  await t.test('GET /webhooks/wechat - Invalid Signature Type (DoS Prevention)', async () => {
    const response = await request(app)
      .get('/webhooks/wechat')
      .query({
        // Passing array via query params
        signature: ['invalid1', 'invalid2'],
        timestamp: '1234567890',
        nonce: '12345',
        echostr: 'hello'
      });

    assert.strictEqual(response.status, 400);
  });
});
