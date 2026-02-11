const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

describe('Auth Middleware Security Tests', () => {
  let req, res, next;
  let authMiddleware;

  beforeEach(() => {
    req = {
      user: null,
      userId: null
    };
    res = {
      statusCode: 200,
      jsonData: null,
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        this.jsonData = data;
        return this;
      }
    };
    next = () => {
      req.nextCalled = true;
    };
    req.nextCalled = false;

    // Re-require to get fresh module
    delete require.cache[require.resolve('../middleware/auth')];
    authMiddleware = require('../middleware/auth');
  });

  it('should export requireAuth function', () => {
    assert.strictEqual(typeof authMiddleware.requireAuth, 'function', 'requireAuth should be exported');
  });

  it('requireAuth should return 401 if request is unauthenticated', () => {
    // Ensure requireAuth exists before calling
    assert.strictEqual(typeof authMiddleware.requireAuth, 'function');

    authMiddleware.requireAuth(req, res, next);

    assert.strictEqual(res.statusCode, 401, 'Should return 401 status');
    assert.deepStrictEqual(res.jsonData, { success: false, error: 'Unauthorized: Authentication required' }, 'Should return unauthorized error');
    assert.strictEqual(req.nextCalled, false, 'Should not call next()');
  });

  it('requireAuth should allow access if req.user is present', () => {
    req.user = { id: 'user123' };

    authMiddleware.requireAuth(req, res, next);

    assert.strictEqual(req.nextCalled, true, 'Should call next()');
    assert.strictEqual(res.statusCode, 200, 'Should not change status code');
  });

  it('requireAuth should deny access if only req.userId is present (user object missing)', () => {
    req.userId = 'user123';
    req.user = null;

    authMiddleware.requireAuth(req, res, next);

    assert.strictEqual(res.statusCode, 401, 'Should return 401 status');
    assert.strictEqual(req.nextCalled, false, 'Should not call next()');
  });
});
