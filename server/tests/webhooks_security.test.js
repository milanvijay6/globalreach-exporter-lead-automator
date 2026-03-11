const express = require('express');
const request = require('supertest');
const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

// Set environment variables for the test
process.env.WHATSAPP_APP_SECRET = 'test-whatsapp-secret';
process.env.WEBHOOK_VERIFY_TOKEN = 'globalreach_secret_token';

// Attempt to require the router.
// This is expected to fail initially due to SyntaxError in the source file.
let webhookRouter;
let routerLoadError;

try {
  webhookRouter = require('../routes/webhooks');
} catch (e) {
  routerLoadError = e;
  // console.log('Router failed to load (expected):', e.message);
}

describe('Webhook Security', () => {
  let app;

  before(() => {
    app = express();

    // Mimic server/index.js body parsing middleware
    app.use(express.json({
      limit: '10mb',
      verify: (req, res, buf) => {
        req.rawBody = buf;
      }
    }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Mount router if it loaded
    if (webhookRouter) {
      app.use('/webhooks', webhookRouter);
    } else {
        // Fallback endpoint to signal failure
        app.use('/webhooks', (req, res) => {
            res.status(500).json({ error: 'Router failed to load', message: routerLoadError?.message });
        });
    }
  });

  describe('WhatsApp Webhook', () => {
    it('should load the router successfully', () => {
        if (routerLoadError) {
            assert.fail(`Router failed to load: ${routerLoadError.message}`);
        }
        assert.ok(webhookRouter, 'Webhook router should be loaded');
    });

    it('should reject missing signature', async () => {
        if (!webhookRouter) return;
      await request(app)
        .post('/webhooks/whatsapp')
        .send({ object: 'whatsapp_business_account', entry: [] })
        .expect(401);
    });

    it('should reject invalid signature', async () => {
        if (!webhookRouter) return;
      const invalidSignature = 'sha256=' + crypto.createHmac('sha256', 'wrong-secret').update(JSON.stringify({})).digest('hex');

      await request(app)
        .post('/webhooks/whatsapp')
        .set('X-Hub-Signature-256', invalidSignature)
        .send({})
        .expect(403);
    });

    it('should accept valid signature', async () => {
        if (!webhookRouter) return;
      const payload = { object: 'whatsapp_business_account', entry: [] };
      const payloadString = JSON.stringify(payload);
      const signature = 'sha256=' + crypto.createHmac('sha256', process.env.WHATSAPP_APP_SECRET).update(payloadString).digest('hex');

      await request(app)
        .post('/webhooks/whatsapp')
        .set('X-Hub-Signature-256', signature)
        .set('Content-Type', 'application/json')
        .send(payload)
        .expect(200);
    });
  });

  describe('WeChat Webhook', () => {
    it('should reject invalid signature', async () => {
        if (!webhookRouter) return;
        const timestamp = Date.now().toString();
        const nonce = 'random-nonce';
        const signature = 'invalid-signature';

        await request(app)
            .post('/webhooks/wechat')
            .query({ signature, timestamp, nonce })
            .set('Content-Type', 'application/xml')
            .send('<xml>...</xml>')
            .expect(403);
    });

    it('should accept valid signature', async () => {
        if (!webhookRouter) return;
        const token = 'globalreach_secret_token';
        const timestamp = Date.now().toString();
        const nonce = 'random-nonce';

        const tmpStr = [token, timestamp, nonce].sort().join('');
        const signature = crypto.createHash('sha1').update(tmpStr).digest('hex');

        await request(app)
            .post('/webhooks/wechat')
            .query({ signature, timestamp, nonce })
            .set('Content-Type', 'application/xml')
            .send('<xml>...</xml>')
            .expect(200)
            .expect('Content-Type', /xml/);
    });
  });
});
