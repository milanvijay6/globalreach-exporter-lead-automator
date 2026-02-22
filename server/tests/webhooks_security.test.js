const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');
const crypto = require('crypto');
const Config = require('../models/Config');
const WebhookLog = require('../models/WebhookLog');

// Override Config.get to return test secrets
Config.get = async (key) => {
  if (key === 'whatsappAppSecret') return 'test_secret';
  if (key === 'webhookVerifyToken') return 'test_token';
  return null;
};

// Mock WebhookLog
WebhookLog.prototype.save = async () => { };
WebhookLog.prototype.set = () => {};

test('Webhook Security Tests', async (t) => {
  let webhooksRouter;

  await t.test('Module loads without SyntaxError', () => {
    webhooksRouter = require('../routes/webhooks');
    assert.ok(webhooksRouter, 'Router should be loaded');
  });

  // Setup app for functional tests
  const app = express();
  app.use(express.json({
      verify: (req, res, buf) => { req.rawBody = buf; }
  }));
  app.use('/webhooks', webhooksRouter);

  await t.test('WhatsApp Valid Signature', async () => {
    const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const signature = crypto.createHmac('sha256', 'test_secret').update(payload).digest('hex');

    const res = await request(app)
      .post('/webhooks/whatsapp')
      .set('X-Hub-Signature-256', `sha256=${signature}`)
      .set('Content-Type', 'application/json')
      .send(payload);

    assert.strictEqual(res.status, 200);
  });

  await t.test('WhatsApp Invalid Signature', async () => {
    const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });

    const res = await request(app)
      .post('/webhooks/whatsapp')
      .set('X-Hub-Signature-256', `sha256=invalid_signature`)
      .set('Content-Type', 'application/json')
      .send(payload);

    assert.strictEqual(res.status, 403);
  });

  await t.test('WhatsApp Missing Signature', async () => {
    const payload = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });

    const res = await request(app)
      .post('/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .send(payload);

    assert.strictEqual(res.status, 401);
  });

  await t.test('WeChat Valid Signature (GET)', async () => {
    const timestamp = '123456789';
    const nonce = 'randomNonce';
    const echostr = 'echoMe';
    const token = 'test_token';
    const tmpStr = [token, timestamp, nonce].sort().join('');
    const signature = crypto.createHash('sha1').update(tmpStr).digest('hex');

    const res = await request(app)
      .get('/webhooks/wechat')
      .query({ signature, timestamp, nonce, echostr });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.text, echostr);
  });

  await t.test('WeChat Invalid Signature (GET)', async () => {
      const timestamp = '123456789';
      const nonce = 'randomNonce';
      const echostr = 'echoMe';

      const res = await request(app)
        .get('/webhooks/wechat')
        .query({ signature: 'invalid', timestamp, nonce, echostr });

      assert.strictEqual(res.status, 403);
  });
});
