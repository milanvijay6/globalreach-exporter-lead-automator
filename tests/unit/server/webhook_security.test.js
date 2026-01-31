const request = require('supertest');
const express = require('express');
const crypto = require('crypto');

// Mock dependencies
jest.mock('../../../server/models/Config', () => ({
  get: jest.fn().mockImplementation((key) => {
    if (key === 'webhookVerifyToken') return Promise.resolve('test_verify_token');
    if (key === 'whatsappAppSecret') return Promise.resolve('test_secret');
    return Promise.resolve(null);
  }),
}));
jest.mock('../../../server/models/WebhookLog', () => {
  return jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    save: jest.fn(),
  }));
});
jest.mock('../../../server/queues/webhookQueue', () => ({
  queueWebhook: jest.fn(),
}));
jest.mock('winston', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    json: jest.fn(),
    simple: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
  },
}));

// Import the router under test
const webhookRouter = require('../../../server/routes/webhooks');

const app = express();
// Mimic server/index.js configuration
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use('/webhooks', webhookRouter);

describe('WhatsApp Webhook Security', () => {
  const payload = { object: 'whatsapp_business_account', entry: [] };
  const payloadString = JSON.stringify(payload);
  const secret = 'test_secret';

  it('should reject POST request without signature (401)', async () => {
    const response = await request(app)
      .post('/webhooks/whatsapp')
      .send(payload);

    expect(response.status).toBe(401);
  });

  it('should reject POST request with invalid signature (403)', async () => {
    const response = await request(app)
      .post('/webhooks/whatsapp')
      .set('X-Hub-Signature-256', 'sha256=invalid_signature')
      .send(payload);

    expect(response.status).toBe(403);
  });

  it('should accept POST request with valid signature (200)', async () => {
    const signature = crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');

    const response = await request(app)
      .post('/webhooks/whatsapp')
      .set('X-Hub-Signature-256', `sha256=${signature}`)
      .send(payload);

    expect(response.status).toBe(200);
  });
});
