const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');
const crypto = require('crypto');

// Mock process.env for Config fallback
process.env.WHATSAPP_APP_SECRET = 'test_secret';

// Mock Config model to avoid DB connection attempts
const mockConfig = {
  get: async (key) => {
    if (key === 'whatsappAppSecret') return 'test_secret';
    return null;
  }
};

// We need to mock the require of ../models/Config because the router uses it directly
// Since we can't easily mock require in CommonJS without external libs or loader hooks,
// and we know Config.get gracefully fails if no DB, we might rely on that.
// HOWEVER, to be safe and avoid noise, let's just rely on the fallback.

// Setup Express app
const app = express();

// Middleware to simulate rawBody capture (critical for signature verification)
app.use(express.json({
  verify: (req, res, buf) => { req.rawBody = buf; }
}));

let webhooksRouter;

test('Setup Webhooks Router', async (t) => {
  try {
    webhooksRouter = require('../routes/webhooks');
    app.use('/webhooks', webhooksRouter);
    assert.ok(webhooksRouter, 'Router loaded successfully');
  } catch (error) {
    console.error('CRITICAL: Failed to load webhooks router:', error.message);
    // If this fails, it confirms the syntax error or other load issue
    assert.fail(`Router failed to load: ${error.message}`);
  }
});

test('WhatsApp Webhook Signature Verification', async (t) => {
  // Skip if router didn't load
  if (!webhooksRouter) return;

  const payload = { object: 'whatsapp_business_account', entry: [] };
  // We must ensure the payload sent matches exactly what we sign
  // supertest .send(obj) serializes to JSON.
  // But we need the exact string for HMAC.
  // Let's pre-serialize.
  const payloadString = JSON.stringify(payload);
  const secret = 'test_secret';

  // Calculate valid signature
  const signatureHash = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
  const validSignature = `sha256=${signatureHash}`;

  await t.test('should return 200 for valid signature', async () => {
    const res = await request(app)
      .post('/webhooks/whatsapp')
      .set('X-Hub-Signature-256', validSignature)
      .set('Content-Type', 'application/json')
      .send(payloadString); // Send raw string to ensure consistency

    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
  });

  await t.test('should return 403 for invalid signature', async () => {
    const res = await request(app)
      .post('/webhooks/whatsapp')
      .set('X-Hub-Signature-256', 'sha256=invalid_hash_value')
      .set('Content-Type', 'application/json')
      .send(payloadString);

    assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
  });

  await t.test('should return 401 for missing signature', async () => {
    const res = await request(app)
      .post('/webhooks/whatsapp')
      .set('Content-Type', 'application/json')
      .send(payloadString);

    assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
  });

  await t.test('should return 401 for malformed signature header', async () => {
    const res = await request(app)
      .post('/webhooks/whatsapp')
      .set('X-Hub-Signature-256', 'malformed_header') // Missing sha256=
      .set('Content-Type', 'application/json')
      .send(payloadString);

    assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
  });
});
