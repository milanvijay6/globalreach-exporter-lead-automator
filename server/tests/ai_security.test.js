const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');

// Mock dependencies
const winston = require('winston');
// We need to mock createLogger to return an object with methods
winston.createLogger = () => ({
  info: () => {},
  error: () => {},
  warn: () => {},
});
// Mock formats used in ai.js
winston.format = {
  simple: () => {},
  combine: () => {},
  timestamp: () => {},
  json: () => {},
};
winston.transports = {
  Console: class {},
};

const aiRouter = require('../routes/ai');

const app = express();
app.use(express.json());
// Mount the router as it is in the application
app.use('/api/ai', aiRouter);

test('GET /api/ai/stream/generate-message security check', async (t) => {
  // Test unauthorized access
  const response = await request(app)
    .get('/api/ai/stream/generate-message')
    .set('Accept', 'application/json');

  assert.strictEqual(response.status, 401, 'Expected 401 Unauthorized for unauthenticated access');
  assert.strictEqual(response.body.success, false);
});

test('GET /api/ai/stream/generate-intro security check', async (t) => {
  // Test unauthorized access
  const response = await request(app)
    .get('/api/ai/stream/generate-intro')
    .set('Accept', 'application/json');

  assert.strictEqual(response.status, 401, 'Expected 401 Unauthorized for unauthenticated access');
  assert.strictEqual(response.body.success, false);
});
