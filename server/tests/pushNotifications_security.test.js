const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const supertest = require('supertest');

// Create mock Parse object
const mockParseObject = {
  extend: () => {
    return class {
      constructor() {
        this.attributes = {};
      }
      set(key, val) {
        this.attributes[key] = val;
      }
      get(key) {
        return this.attributes[key];
      }
      save() {
        return Promise.resolve(this);
      }
      destroy() {
        return Promise.resolve(this);
      }
    };
  },
  Query: class {
    constructor() {
      this.filters = {};
    }
    equalTo(key, val) {
      this.filters[key] = val;
    }
    first() {
      return Promise.resolve(null);
    }
    find() {
      return Promise.resolve([]);
    }
  }
};

// Mock dependencies
const mockParse = {
  Object: mockParseObject,
  Query: mockParseObject.Query,
  User: {
    become: async (token) => {
      if (token === 'valid-token') {
        return { id: 'user123', get: (key) => key === 'id' ? 'user123' : null };
      }
      throw new Error('Invalid token');
    }
  },
  Session: {
    current: () => Promise.resolve({ get: () => ({ id: 'user123' }) })
  }
};

global.Parse = mockParse;

test('Push Notifications Security - Authentication and IDOR prevention', async (t) => {
  // Override requires to inject our mock Parse
  const originalRequire = require('module').prototype.require;
  require('module').prototype.require = function(path) {
    if (path === 'parse/node') {
      return mockParse;
    }
    return originalRequire.apply(this, arguments);
  };

  // Setup Express app
  const app = express();
  app.use(express.json());

  // Create middleware overrides manually since require intercept doesn't work well for local paths
  const pushNotificationsRouter = originalRequire(require('path').resolve(__dirname, '../routes/pushNotifications'));
  app.use('/api/push-notifications', pushNotificationsRouter);

  await t.test('Unauthenticated user cannot register device token (401)', async () => {
    const res = await supertest(app)
      .post('/api/push-notifications/register')
      .send({ token: 'device-token-123', platform: 'ios', userId: 'spoofed-user-id' })
      .set('x-user-id', 'spoofed-user-id'); // Try to spoof via header

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(res.body.error, 'Unauthorized: Authentication required');
  });

  await t.test('Authenticated user can register device token', async () => {
    // We need to bypass the actual Parse.User.become since we mock it above,
    // but the actual auth middleware uses the real one if we didn't mock it correctly before it loaded.
    // Easiest is to create a mock auth app
    const authApp = express();
    authApp.use(express.json());

    // Mock the auth middleware directly
    authApp.use((req, res, next) => {
      req.user = { id: 'real-user-id' };
      next();
    });

    // Mock the auth middleware by simulating what it would do before calling the router
    // This is needed because `pushNotificationsRouter` already bound `authenticateUser`
    // and `requireAuth` that check for Parse sessions, which will fail here.

    // As a workaround, we can provide the Parse User object and an auth token to bypass the actual logic.
    // The auth middleware checks for X-Parse-Session-Token

    // We also need to simulate `Parse` being initialized for auth to work
    mockParse.applicationId = 'test-app-id';

    const res = await supertest(app)
      .post('/api/push-notifications/register')
      .set('X-Parse-Session-Token', 'valid-token')
      .send({ token: 'device-token-123', platform: 'ios' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
  });

  // Restore original require
  require('module').prototype.require = originalRequire;
});
