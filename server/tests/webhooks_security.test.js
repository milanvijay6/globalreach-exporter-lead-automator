const { test, describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const supertest = require('supertest');
const crypto = require('crypto');
const path = require('path');

// Mock dependencies
const mockConfig = {
  get: (key, defaultValue) => {
    if (key === 'webhookVerifyToken') return Promise.resolve('test_verify_token');
    if (key === 'whatsappAppSecret') return Promise.resolve('test_app_secret');
    return Promise.resolve(defaultValue);
  }
};

const mockWebhookLog = class {
  set() {}
  save() { return Promise.resolve(); }
};

const mockQueueWebhook = {
  queueWebhook: () => Promise.resolve()
};

// Override require using module aliasing or mocking
// Since we are in node:test, mocking require is hard without a library like proxyquire.
// Instead, we can attach mocks to the global object if the module supports injection,
// or just modify the cache.
// But server/routes/webhooks.js requires '../models/Config' directly.

// We will use a simple hack: prime the require cache with mocks.
const configPath = path.resolve(__dirname, '../models/Config.js');
const webhookLogPath = path.resolve(__dirname, '../models/WebhookLog.js');
const queuePath = path.resolve(__dirname, '../queues/webhookQueue.js');

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
  exports: mockWebhookLog
};

require.cache[queuePath] = {
  id: queuePath,
  filename: queuePath,
  loaded: true,
  exports: mockQueueWebhook
};

// Now import the router
const webhookRouter = require('../routes/webhooks');

describe('Webhooks Security', () => {
  let app;
  let request;

  before(() => {
    app = express();
    app.use(express.json({
        verify: (req, res, buf) => { req.rawBody = buf; }
    }));
    app.use(express.urlencoded({ extended: true }));
    app.use('/webhooks', webhookRouter);
    request = supertest(app);
  });

  describe('WeChat Verification (GET)', () => {
    it('should return 400 if parameters are missing', async () => {
      await request.get('/webhooks/wechat')
        .expect(400);
    });

    it('should verify signature successfully', async () => {
      const token = 'test_verify_token';
      const timestamp = '1234567890';
      const nonce = '12345';
      const echostr = 'success_echo';

      const tmpStr = [token, timestamp, nonce].sort().join('');
      const signature = crypto.createHash('sha1').update(tmpStr).digest('hex');

      const res = await request.get('/webhooks/wechat')
        .query({
          signature,
          timestamp,
          nonce,
          echostr
        })
        .expect(200);

      assert.strictEqual(res.text, echostr);
    });

    it('should reject invalid signature', async () => {
      const token = 'test_verify_token';
      const timestamp = '1234567890';
      const nonce = '12345';
      const echostr = 'success_echo';

      const signature = 'invalid_signature_hex_string_of_correct_length_00000'; // Make it look like sha1 length (40 chars)

      // Ensure length matches SHA1 hex (40 chars) to test timingSafeEqual path
      const invalidSignature = 'a'.repeat(40);

      await request.get('/webhooks/wechat')
        .query({
          signature: invalidSignature,
          timestamp,
          nonce,
          echostr
        })
        .expect(403);
    });

    it('should reject malformed signature (wrong length)', async () => {
        const token = 'test_verify_token';
        const timestamp = '1234567890';
        const nonce = '12345';
        const echostr = 'success_echo';

        await request.get('/webhooks/wechat')
          .query({
            signature: 'short',
            timestamp,
            nonce,
            echostr
          })
          .expect(403); // Or 500 depending on implementation details, but 403 is expected behavior for verification fail
      });
  });

  describe('WeChat POST Handler', () => {
    it('should verify signature successfully', async () => {
        const token = 'test_verify_token';
        const timestamp = '1234567890';
        const nonce = '12345';

        const tmpStr = [token, timestamp, nonce].sort().join('');
        const signature = crypto.createHash('sha1').update(tmpStr).digest('hex');

        await request.post('/webhooks/wechat')
          .query({
            signature,
            timestamp,
            nonce
          })
          .set('Content-Type', 'text/xml')
          .send('<xml><test>data</test></xml>')
          .expect(200)
          .expect('Content-Type', /xml/);
      });

      it('should reject invalid signature', async () => {
        const timestamp = '1234567890';
        const nonce = '12345';
        const invalidSignature = 'a'.repeat(40);

        await request.post('/webhooks/wechat')
          .query({
            signature: invalidSignature,
            timestamp,
            nonce
          })
          .set('Content-Type', 'text/xml')
          .send('<xml><test>data</test></xml>')
          .expect(403);
      });
  });

  describe('WhatsApp Verification', () => {
      // Just verifying the route loads and works without syntax error
      it('should respond to verification request', async () => {
          await request.get('/webhooks/whatsapp')
            .query({
                'hub.mode': 'subscribe',
                'hub.verify_token': 'test_verify_token',
                'hub.challenge': 'challenge_code'
            })
            .expect(200)
            .expect('challenge_code');
      });

      it('should verify POST signature successfully', async () => {
        const appSecret = 'test_app_secret';
        const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
        const signatureHash = crypto.createHmac('sha256', appSecret).update(body).digest('hex');
        const signature = `sha256=${signatureHash}`;

        await request.post('/webhooks/whatsapp')
            .set('X-Hub-Signature-256', signature)
            .set('Content-Type', 'application/json')
            .send(body)
            .expect(200);
      });

      it('should reject POST with invalid signature', async () => {
        const appSecret = 'test_app_secret';
        const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
        // Create an invalid signature that has the correct length but wrong content
        const invalidHash = 'a'.repeat(64);
        const invalidSignature = `sha256=${invalidHash}`;

        await request.post('/webhooks/whatsapp')
            .set('X-Hub-Signature-256', invalidSignature)
            .set('Content-Type', 'application/json')
            .send(body)
            .expect(403);
      });
  });
});
