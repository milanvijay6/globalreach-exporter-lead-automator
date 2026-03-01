const { describe, it } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');

// Mocks
global.jest = { mock: () => {} }; // Dummy mock object for any code using jest
const integrationsRouter = require('../routes/integrations');

const app = express();
app.use(express.json());
app.use('/api/integrations', integrationsRouter);

describe('Integrations Route Security Checks', () => {
  it('GET /api/integrations/status should return 401 when unauthenticated', async () => {
    const response = await request(app).get('/api/integrations/status');
    assert.strictEqual(response.status, 401);
    assert.strictEqual(response.body.success, false);
    assert.ok(response.body.error.includes('Unauthorized'));
  });

  it('POST /api/integrations/outlook/authorize should return 401 when unauthenticated', async () => {
    const response = await request(app).post('/api/integrations/outlook/authorize');
    assert.strictEqual(response.status, 401);
    assert.strictEqual(response.body.success, false);
    assert.ok(response.body.error.includes('Unauthorized'));
  });

  it('POST /api/integrations/whatsapp/disconnect should return 401 when unauthenticated', async () => {
    const response = await request(app).post('/api/integrations/whatsapp/disconnect');
    assert.strictEqual(response.status, 401);
    assert.strictEqual(response.body.success, false);
    assert.ok(response.body.error.includes('Unauthorized'));
  });
});
