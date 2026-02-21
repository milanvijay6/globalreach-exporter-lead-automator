const { test, describe, it, mock } = require('node:test');
const assert = require('node:assert');
const { requireAuth } = require('../middleware/auth');

describe('Auth Middleware', () => {
  it('should exist', () => {
    assert.strictEqual(typeof requireAuth, 'function');
  });

  it('should call next if user is authenticated', (t) => {
    const req = { user: { id: 'user1' } };
    const res = {};
    const next = t.mock.fn();

    requireAuth(req, res, next);

    assert.strictEqual(next.mock.callCount(), 1);
  });

  it('should return 401 if user is not authenticated', (t) => {
    const req = {};
    const res = {
      status: t.mock.fn((code) => {
        assert.strictEqual(code, 401);
        return res;
      }),
      json: t.mock.fn((data) => {
        assert.strictEqual(data.success, false);
        assert.strictEqual(data.error, 'Unauthorized: Authentication required');
        return res;
      })
    };
    const next = t.mock.fn();

    requireAuth(req, res, next);

    assert.strictEqual(next.mock.callCount(), 0);
    assert.strictEqual(res.status.mock.callCount(), 1);
    assert.strictEqual(res.json.mock.callCount(), 1);
  });
});
