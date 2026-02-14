const { test, describe, it, before, after, mock } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');
const crypto = require('crypto');

// --- Mocking Dependencies ---

// Mock Config
const Config = {
  get: mock.fn((key, defaultVal) => {
    if (key === 'webhookVerifyToken') return Promise.resolve('test-verify-token');
    if (key === 'whatsappAppSecret') return Promise.resolve('test-app-secret');
    return Promise.resolve(defaultVal);
  })
};

// Mock WebhookLog
class WebhookLog {
  constructor() {
    this.data = {};
  }
  set(key, val) {
    this.data[key] = val;
  }
  save() {
    return Promise.resolve();
  }
}

// Mock webhookQueue
const webhookQueue = {
  queueWebhook: mock.fn(() => Promise.resolve())
};

// --- Mocking require via node:test (requires Node 20+ specific mocking capabilities which might be tricky in older Node versions) ---
// Since we can't easily hijack require in CommonJS without a library like proxyquire,
// we will use a workaround: modify the cache or inject dependencies if possible.
// Given the constraints and likely environment, we'll try to use proxyquire or similar if available,
// BUT checking package.json, proxyquire isn't there.
//
// Plan B: We will rely on the fact that `require` caches modules.
// If we populate the cache with our mocks BEFORE requiring the route file, it should use them.

const path = require('path');

// Mock Config
require.cache[require.resolve('../models/Config')] = {
  id: require.resolve('../models/Config'),
  filename: require.resolve('../models/Config'),
  loaded: true,
  exports: Config
};

// Mock WebhookLog
require.cache[require.resolve('../models/WebhookLog')] = {
  id: require.resolve('../models/WebhookLog'),
  filename: require.resolve('../models/WebhookLog'),
  loaded: true,
  exports: WebhookLog
};

// Mock webhookQueue
require.cache[require.resolve('../queues/webhookQueue')] = {
  id: require.resolve('../queues/webhookQueue'),
  filename: require.resolve('../queues/webhookQueue'),
  loaded: true,
  exports: webhookQueue
};

// --- Load the Router ---
const webhooksRouter = require('../routes/webhooks');

// --- Setup App ---
const app = express();

// Middleware to populate req.rawBody (crucial for WhatsApp signature verification)
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// Mount the router
app.use('/webhooks', webhooksRouter);

// --- Tests ---

describe('Webhooks Security Tests', () => {

  describe('GET /webhooks/wechat (Verification)', () => {
    it('should verify valid signature', async () => {
      const token = 'test-verify-token';
      const timestamp = '1234567890';
      const nonce = 'nonce123';
      const echostr = 'echostr123';

      const tmpStr = [token, timestamp, nonce].sort().join('');
      const signature = crypto.createHash('sha1').update(tmpStr).digest('hex');

      await request(app)
        .get('/webhooks/wechat')
        .query({ signature, timestamp, nonce, echostr })
        .expect(200)
        .expect(echostr);
    });

    it('should reject invalid signature with 403', async () => {
      const timestamp = '1234567890';
      const nonce = 'nonce123';
      const echostr = 'echostr123';
      const signature = 'invalid_signature';

      await request(app)
        .get('/webhooks/wechat')
        .query({ signature, timestamp, nonce, echostr })
        .expect(403);
    });

    it('should return 400 if parameters are missing', async () => {
      await request(app)
        .get('/webhooks/wechat')
        .expect(400);
    });
  });

  describe('POST /webhooks/wechat (Signature Verification)', () => {
    it('should verify valid signature', async () => {
      const token = 'test-verify-token';
      const timestamp = '1234567890';
      const nonce = 'nonce123';

      const tmpStr = [token, timestamp, nonce].sort().join('');
      const signature = crypto.createHash('sha1').update(tmpStr).digest('hex');

      await request(app)
        .post('/webhooks/wechat')
        .query({ signature, timestamp, nonce })
        .set('Content-Type', 'application/xml')
        .send('<xml><test>data</test></xml>')
        .expect(200);
    });

    it('should reject invalid signature with 403', async () => {
      const timestamp = '1234567890';
      const nonce = 'nonce123';
      const signature = 'invalid_signature';

      await request(app)
        .post('/webhooks/wechat')
        .query({ signature, timestamp, nonce })
        .set('Content-Type', 'application/xml')
        .send('<xml><test>data</test></xml>')
        .expect(403);
    });
  });

  describe('POST /webhooks/whatsapp (Signature Verification)', () => {
    it('should verify valid HMAC signature', async () => {
      const payload = { object: 'whatsapp_business_account' };
      const secret = 'test-app-secret';
      const body = JSON.stringify(payload);

      const signature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');

      await request(app)
        .post('/webhooks/whatsapp')
        .set('X-Hub-Signature-256', `sha256=${signature}`)
        .send(payload)
        .expect(200);
    });

    it('should reject invalid HMAC signature with 401 or 403', async () => {
      const payload = { object: 'whatsapp_business_account' };
      const invalidSignature = 'invalid_signature_hash';

      await request(app)
        .post('/webhooks/whatsapp')
        .set('X-Hub-Signature-256', `sha256=${invalidSignature}`)
        .send(payload)
        // Accept either 401 or 403 as valid rejection codes
        .expect((res) => {
            if (res.status !== 401 && res.status !== 403) {
                throw new Error(`Expected 401 or 403, got ${res.status}`);
            }
        });
    });

    it('should reject request without signature header', async () => {
      const payload = { object: 'whatsapp_business_account' };

      await request(app)
        .post('/webhooks/whatsapp')
        .send(payload)
        .expect(401);
    });
  });
});
