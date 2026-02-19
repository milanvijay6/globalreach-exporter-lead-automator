const { test, describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');
const Parse = require('parse/node');

// Set dummy appId to enable auth middleware logic
Parse.applicationId = 'test-app-id';

// Mock Config model
const Config = require('../models/Config');

// Store original implementation
const originalGet = Config.get;
const originalSet = Config.set;

describe('Config IDOR Vulnerability', () => {
  let app;

  beforeEach(() => {
    // Mock Config methods
    Config.get = async (key, def, userId) => {
      // If userId is passed, it means we are authenticated or vulnerable.
      // If userId is victimId, return secret.
      if (userId === 'victimId') {
        return 'victim-secret-value';
      }
      return def;
    };

    Config.set = async (key, val, userId) => {
        return true;
    };

    app = express();
    app.use(express.json());

    // Mount the router
    const configRouter = require('../routes/config');
    app.use('/api/config', configRouter);
  });

  afterEach(() => {
    // Restore original implementation
    Config.get = originalGet;
    Config.set = originalSet;
  });

  it('should NOT allow accessing another user config by setting X-User-Id header without auth', async () => {
    // Attempt to access victim's config
    const response = await request(app)
      .get('/api/config/secretKey')
      .set('X-User-Id', 'victimId'); // Spoofing user ID

    // Should return 200 (OK) but with default/global config (null in this case), NOT victim's secret
    assert.strictEqual(response.status, 200, 'Expected 200 OK (global config access)');
    assert.notStrictEqual(response.body.value, 'victim-secret-value', 'Should NOT return victim secret');
    assert.strictEqual(response.body.userId, null, 'userId should be null (global context)');
  });

  it('should NOT allow setting another user config by setting X-User-Id header without auth', async () => {
    // Attempt to set victim's config
    const response = await request(app)
      .post('/api/config/secretKey')
      .send({ value: 'hacked-value' })
      .set('X-User-Id', 'victimId'); // Spoofing user ID

    // Should return 401 Unauthorized
    assert.strictEqual(response.status, 401, 'Expected 401 Unauthorized');
  });
});
