const { test, describe, it, mock, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const supertest = require('supertest');

// Create an express app for testing the router
function setupApp() {
  const app = express();
  app.use(express.json());

  // Require the router
  const integrationsRouter = require('../routes/integrations');
  app.use('/api/integrations', integrationsRouter);

  return app;
}

describe('Integrations API Security Tests', () => {
  let app;

  beforeEach(() => {
    app = setupApp();
  });

  describe('Unauthenticated Access', () => {
    it('should return 401 Unauthorized for GET /api/integrations/status', async () => {
      const response = await supertest(app)
        .get('/api/integrations/status')
        .expect('Content-Type', /json/)
        .expect(401);

      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.error, 'Unauthorized: Authentication required');
    });

    it('should return 401 Unauthorized for POST /api/integrations/outlook/authorize', async () => {
      const response = await supertest(app)
        .post('/api/integrations/outlook/authorize')
        .expect('Content-Type', /json/)
        .expect(401);

      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.error, 'Unauthorized: Authentication required');
    });

    it('should return 401 Unauthorized for GET /api/integrations/outlook/callback', async () => {
      const response = await supertest(app)
        .get('/api/integrations/outlook/callback')
        .expect('Content-Type', /json/)
        .expect(401);

      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.error, 'Unauthorized: Authentication required');
    });

    it('should return 401 Unauthorized for POST /api/integrations/outlook/refresh', async () => {
      const response = await supertest(app)
        .post('/api/integrations/outlook/refresh')
        .expect('Content-Type', /json/)
        .expect(401);

      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.error, 'Unauthorized: Authentication required');
    });

    it('should return 401 Unauthorized for POST /api/integrations/outlook/disconnect', async () => {
      const response = await supertest(app)
        .post('/api/integrations/outlook/disconnect')
        .expect('Content-Type', /json/)
        .expect(401);

      assert.strictEqual(response.body.success, false);
      assert.strictEqual(response.body.error, 'Unauthorized: Authentication required');
    });
  });
});
