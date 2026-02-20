const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');

// Mocks
const mockParseQuery = {
  equalTo: (field, value) => {
    // This is where we capture the injection attempt
    if ((field === 'importerId' || field === 'channel' || field === 'status') && typeof value === 'object' && value !== null) {
      console.log(`⚠️  VULNERABILITY CONFIRMED: ${field} received an object:`, value);
      throw new Error(`INJECTION_DETECTED_${field}`);
    }
  },
  descending: () => {},
  limit: () => {},
  notEqualTo: () => {},
  find: async () => [],
};

const mockParse = {
  Query: class {
    constructor() {
      return mockParseQuery;
    }
  },
  Object: {
    extend: () => class {},
  }
};

// Mock Dependencies
const mockMessage = {};
const mockParseFileService = {
  getContent: async () => 'content',
};
const mockParseQueryCache = {
  findWithCache: async (query) => [],
};

// Override require to serve mocks
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(path) {
  if (path === 'parse/node') return mockParse;
  if (path.endsWith('models/Message')) return mockMessage;
  if (path.endsWith('utils/parseFileService')) return { parseFileService: mockParseFileService };
  if (path.endsWith('utils/parseQueryCache')) return { findWithCache: mockParseQueryCache.findWithCache };
  if (path.endsWith('middleware/auth')) return {
    authenticateUser: (req, res, next) => { req.user = { id: 'test' }; next(); },
    requireAuth: (req, res, next) => next(),
  };
  if (path.endsWith('middleware/cache')) return {
    cacheMiddleware: () => (req, res, next) => next(),
    invalidateByTag: async () => {},
  };

  return originalRequire.apply(this, arguments);
};

// Load router AFTER mocking
const messagesRouter = require('../routes/messages');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/messages', messagesRouter);

test('GET /api/messages Security Tests', async (t) => {

  await t.test('Should reject object injection in importerId', async () => {
    const response = await request(app)
      .get('/api/messages?importerId[$ne]=null')
      .set('Accept', 'application/json');

    assert.strictEqual(response.status, 400, 'Should return 400 for invalid importerId');
    assert.strictEqual(response.body.error, 'importerId is required');
  });

  await t.test('Should ignore object injection in channel', async () => {
    // importerId is valid, channel is injected
    const response = await request(app)
      .get('/api/messages?importerId=valid&channel[$ne]=null')
      .set('Accept', 'application/json');

    // If channel is sanitized to undefined, the query proceeds but without channel filter.
    // So it should return 200 OK (with mock results)
    // And NOT throw INJECTION_DETECTED_channel

    assert.strictEqual(response.status, 200, 'Should return 200 OK');
  });

  await t.test('Should ignore object injection in status', async () => {
    const response = await request(app)
      .get('/api/messages?importerId=valid&status[$ne]=null')
      .set('Accept', 'application/json');

    assert.strictEqual(response.status, 200, 'Should return 200 OK');
  });

  await t.test('Should work with valid inputs', async () => {
    const response = await request(app)
      .get('/api/messages?importerId=valid&channel=whatsapp&status=sent')
      .set('Accept', 'application/json');

    assert.strictEqual(response.status, 200, 'Should return 200 OK');
  });
});
