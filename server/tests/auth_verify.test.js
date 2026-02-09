const { test } = require('node:test');
const assert = require('node:assert');
const { requireAuth } = require('../middleware/auth');

test('requireAuth blocks request without user', () => {
  let statusCalledWith = null;
  let jsonCalledWith = null;
  let nextCalled = false;

  const req = {};
  const res = {
    status: (code) => {
      statusCalledWith = code;
      return {
        json: (body) => {
          jsonCalledWith = body;
        }
      };
    }
  };
  const next = () => {
    nextCalled = true;
  };

  requireAuth(req, res, next);

  assert.strictEqual(statusCalledWith, 401);
  assert.strictEqual(jsonCalledWith.success, false);
  assert.strictEqual(jsonCalledWith.error, 'Unauthorized');
  assert.strictEqual(nextCalled, false);
});

test('requireAuth allows request with user', () => {
  let statusCalledWith = null;
  let nextCalled = false;

  const req = { user: { id: 'user123' } };
  const res = {
    status: (code) => {
      statusCalledWith = code;
      return { json: () => {} };
    }
  };
  const next = () => {
    nextCalled = true;
  };

  requireAuth(req, res, next);

  assert.strictEqual(statusCalledWith, null);
  assert.strictEqual(nextCalled, true);
});
