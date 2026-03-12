const { test, describe } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');
const path = require('path');

// Mock Parse SDK before requiring routes
const mockParse = {
  applicationId: 'mock-app-id',
  initialize: () => {},
  User: {
    become: async (token) => {
      if (token === 'valid-token') {
        return { id: 'mock-user-123', get: (key) => key === 'username' ? 'testuser' : null };
      }
      throw new Error('Invalid session token');
    }
  }
};

// Global mocks
global.Parse = mockParse;
require('module').prototype.require = new Proxy(require('module').prototype.require, {
  apply(target, thisArg, argumentsList) {
    const name = argumentsList[0];
    if (name === 'parse/node') return mockParse;
    return Reflect.apply(target, thisArg, argumentsList);
  }
});

// Import the router and config model
const Config = require('../models/Config');
const configRouter = require('../routes/config');

// Setup mock config implementation
Config.get = async (key, defaultValue, userId, useMasterKey) => {
  if (key === 'public_key') return 'public_value';
  if (key === 'secret_key' && userId === 'mock-user-123') return 'secret_value';
  return defaultValue;
};
Config.set = async (key, value, userId, useMasterKey) => {
  return true;
};
Config.getAll = async (userId, useMasterKey) => {
  if (userId === 'mock-user-123') return { public_key: 'public_value', secret_key: 'secret_value' };
  return { public_key: 'public_value' };
};

// Setup express app
const app = express();
app.use(express.json());
app.use('/config', configRouter);

describe('Config API Security', () => {
  test('POST /config/:key should reject unauthenticated requests', async () => {
    const response = await request(app)
      .post('/config/test_key')
      .send({ value: 'test_value' });

    assert.strictEqual(response.status, 401);
    assert.strictEqual(response.body.success, false);
    assert.strictEqual(response.body.error, 'Unauthorized: Authentication required');
  });

  test('POST /config/:key should allow authenticated requests', async () => {
    const response = await request(app)
      .post('/config/test_key')
      .set('X-Parse-Session-Token', 'valid-token')
      .send({ value: 'test_value' });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, true);
    assert.strictEqual(response.body.userId, 'mock-user-123');
  });

  test('GET /config/:key should prevent IDOR by spoofing X-User-Id header', async () => {
    // Attempt to access user-specific config by spoofing X-User-Id
    const response = await request(app)
      .get('/config/secret_key')
      .set('X-User-Id', 'mock-user-123'); // Unauthenticated, but spoofing ID

    // Should succeed but process as unauthenticated (userId should be null)
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, true);
    assert.strictEqual(response.body.userId, null);
    assert.strictEqual(response.body.value, null);
  });

  test('GET /config/all should prevent IDOR by spoofing X-User-Id header', async () => {
    // Attempt to access user-specific config by spoofing X-User-Id
    const response = await request(app)
      .get('/config/all')
      .set('X-User-Id', 'mock-user-123'); // Unauthenticated, but spoofing ID

    // Should succeed but process as unauthenticated (userId should be null)
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, true);
    assert.strictEqual(response.body.userId, null);
    // Should only return public config
    assert.deepStrictEqual(response.body.config, { public_key: 'public_value' });
  });

  test('GET /config/:key should allow valid session token', async () => {
    const response = await request(app)
      .get('/config/secret_key')
      .set('X-Parse-Session-Token', 'valid-token');

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, true);
    assert.strictEqual(response.body.userId, 'mock-user-123');
    assert.strictEqual(response.body.value, 'secret_value');
  });

  test('GET /config/all should allow valid session token', async () => {
    const response = await request(app)
      .get('/config/all')
      .set('X-Parse-Session-Token', 'valid-token');

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, true);
    assert.strictEqual(response.body.userId, 'mock-user-123');
    assert.deepStrictEqual(response.body.config, { public_key: 'public_value', secret_key: 'secret_value' });
  });
});
