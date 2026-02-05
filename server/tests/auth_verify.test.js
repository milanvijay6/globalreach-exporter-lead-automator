const { test, describe, it } = require('node:test');
const assert = require('node:assert');
const { requireAuth } = require('../middleware/auth');
const Parse = require('parse/node');

describe('Auth Middleware', () => {
  it('should return 500 if Parse is not initialized', async () => {
    // Mock Parse.applicationId to be undefined
    const originalAppId = Parse.applicationId;
    Parse.applicationId = undefined;

    const req = {};
    const res = {
      status: (code) => {
        assert.strictEqual(code, 500);
        return res;
      },
      json: (data) => {
        assert.strictEqual(data.success, false);
        assert.strictEqual(data.error, 'Authentication configuration missing');
      }
    };
    const next = () => {
      assert.fail('Should not call next');
    };

    requireAuth(req, res, next);

    // Restore
    Parse.applicationId = originalAppId;
  });

  it('should return 401 if not authenticated', async () => {
    // Mock Parse.applicationId to be defined
    const originalAppId = Parse.applicationId;
    Parse.applicationId = 'test-app-id';

    const req = { user: null, userId: null };
    const res = {
      status: (code) => {
        assert.strictEqual(code, 401);
        return res;
      },
      json: (data) => {
        assert.strictEqual(data.success, false);
        assert.strictEqual(data.error, 'Unauthorized: Authentication required');
      }
    };
    const next = () => {
      assert.fail('Should not call next');
    };

    requireAuth(req, res, next);

    // Restore
    Parse.applicationId = originalAppId;
  });

  it('should call next if authenticated', async () => {
    // Mock Parse.applicationId to be defined
    const originalAppId = Parse.applicationId;
    Parse.applicationId = 'test-app-id';

    const req = { user: { id: 'user1' }, userId: 'user1' };
    const res = {
        status: (code) => {
            assert.fail('Should not call status');
        }
    };
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    requireAuth(req, res, next);
    assert.strictEqual(nextCalled, true);

    // Restore
    Parse.applicationId = originalAppId;
  });
});
