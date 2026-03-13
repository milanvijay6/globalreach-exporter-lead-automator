const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const express = require('express');

// Mock Parse SDK before requiring routes
const mockParse = {
  Object: {
    extend: () => class MockParseObject {
      constructor() { this.data = {}; }
      set(key, val) { this.data[key] = val; }
      get(key) { return this.data[key]; }
      save() { return Promise.resolve(this); }
      destroy() { return Promise.resolve(); }
    }
  },
  Query: class MockParseQuery {
    constructor() {}
    equalTo() { return this; }
    first() { return Promise.resolve(null); }
    find() { return Promise.resolve([]); }
  },
  User: {
    become: () => Promise.resolve({ id: 'mock_user_123' })
  },
  applicationId: 'mock_app_id',
};

// Set up mock globally for `require('parse/node')`
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(request) {
  if (request === 'parse/node') return mockParse;
  if (request === '../models/Config') {
    return {
      get: () => Promise.resolve({ get: () => 'mock' })
    };
  }
  return originalRequire.apply(this, arguments);
};

const pushNotificationsRouter = require('../routes/pushNotifications');

describe('Push Notifications Security Tests', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    // Attach router - middleware should block unauthenticated
    app.use('/api/push-notifications', pushNotificationsRouter);
  });

  afterEach(() => {
    mockParse.applicationId = 'mock_app_id'; // Reset mock state
  });

  describe('Unauthenticated Access (Missing Auth)', () => {
    it('should reject unauthenticated POST /register with 401', async () => {
      const response = await request(app)
        .post('/api/push-notifications/register')
        .send({ token: 'test_token', platform: 'ios' });

      assert.strictEqual(response.status, 401);
      assert.strictEqual(response.body.success, false);
      assert.match(response.body.error, /Unauthorized: Authentication required/);
    });

    it('should reject unauthenticated POST /send with 401', async () => {
      const response = await request(app)
        .post('/api/push-notifications/send')
        .send({ title: 'test', body: 'test body' });

      assert.strictEqual(response.status, 401);
    });

    it('should reject unauthenticated DELETE /unregister with 401', async () => {
      const response = await request(app)
        .delete('/api/push-notifications/unregister')
        .send({ token: 'test_token' });

      assert.strictEqual(response.status, 401);
    });
  });

  describe('IDOR Prevention (Header Spoofing)', () => {
    it('should reject requests with spoofed X-User-Id header if not authenticated', async () => {
      const response = await request(app)
        .post('/api/push-notifications/register')
        .set('X-User-Id', 'admin_user') // Attempt to spoof
        .send({ token: 'test_token', platform: 'ios' });

      // Should still be rejected because requireAuth checks for req.user, not just req.userId
      assert.strictEqual(response.status, 401);
    });
  });
});
