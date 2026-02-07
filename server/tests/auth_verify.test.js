const { test, describe, it, mock } = require('node:test');
const assert = require('node:assert');
const Parse = require('parse/node');

// Set up Parse mock before requiring auth middleware
Parse.applicationId = 'test-app-id';
Parse.User = {
  become: mock.fn(async (token) => {
    if (token === 'valid-token') {
      return { id: 'user-123' };
    }
    throw new Error('Invalid session');
  })
};

// We need to delay require until after mocks are set up, but since `require` caches modules,
// and `server/middleware/auth.js` requires `parse/node`, we might have issues if `parse/node` is already loaded.
// However, `parse/node` is a singleton, so modifying `Parse` object should work.

const { authenticateUser, requireAuth } = require('../middleware/auth');

describe('Auth Middleware', () => {
  describe('authenticateUser', () => {
    it('should set req.user if session token is valid', async () => {
      const req = {
        get: (header) => header === 'X-Parse-Session-Token' ? 'valid-token' : null,
        query: {},
        body: {}
      };
      const res = {};
      const next = mock.fn();

      await authenticateUser(req, res, next);

      assert.strictEqual(req.userId, 'user-123');
      assert.strictEqual(next.mock.calls.length, 1);
    });

    it('should set req.user to null if session token is invalid', async () => {
      const req = {
        get: (header) => header === 'X-Parse-Session-Token' ? 'invalid-token' : null,
        query: {},
        body: {}
      };
      const res = {};
      const next = mock.fn();

      await authenticateUser(req, res, next);

      assert.strictEqual(req.user, null);
      assert.strictEqual(next.mock.calls.length, 1);
    });
  });

  describe('requireAuth', () => {
    it('should exist', () => {
       assert.ok(requireAuth, 'requireAuth should be exported');
    });

    it('should return 401 if req.user and req.userId are missing', () => {
      const req = { user: null, userId: null };
      const res = {
        status: mock.fn((code) => {
          assert.strictEqual(code, 401);
          return res;
        }),
        json: mock.fn((body) => {
          assert.strictEqual(body.success, false);
          assert.match(body.error, /Unauthorized/);
        })
      };
      const next = mock.fn();

      if (requireAuth) {
          requireAuth(req, res, next);

          assert.strictEqual(res.status.mock.calls.length, 1);
          assert.strictEqual(next.mock.calls.length, 0);
      }
    });

    it('should call next() if req.userId is present', () => {
      const req = { userId: 'user-123' };
      const res = {};
      const next = mock.fn();

      if (requireAuth) {
          requireAuth(req, res, next);

          assert.strictEqual(next.mock.calls.length, 1);
      }
    });
  });
});
