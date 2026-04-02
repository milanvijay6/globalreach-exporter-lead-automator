const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');

// MOCK the liveQueryService to prevent external requests hanging
const mockLiveQueryService = {
  subscribeToActiveChat: async () => 'mock-sub-id',
  unsubscribe: async () => {},
  getStats: () => ({ activeSubscriptions: 0 })
};

// Use Module._load intercept to mock the service
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function() {
  if (arguments[0].includes('liveQueryService')) {
    return { liveQueryService: mockLiveQueryService };
  }
  return originalRequire.apply(this, arguments);
};

const livequeryRouter = require('../routes/livequery');

const app = express();
app.use(express.json());
app.use('/api/livequery', livequeryRouter);

test('GET /api/livequery/stats security check', async (t) => {
  const response = await request(app)
    .get('/api/livequery/stats')
    .set('Accept', 'application/json');

  if (response.status === 200) {
    console.log('⚠️  VULNERABILITY CONFIRMED: /api/livequery/stats is accessible without auth');
    assert.fail('Expected 401 Unauthorized, but got 200 OK');
  } else if (response.status === 401) {
    console.log('✅ SECURE: /api/livequery/stats returned 401 Unauthorized');
    assert.strictEqual(response.status, 401, 'Expected 401 Unauthorized');
  } else {
    console.log(`ℹ️  Unexpected status: ${response.status}`);
  }
});