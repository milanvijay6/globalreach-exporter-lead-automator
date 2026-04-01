const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');

// Create mock dependencies before requiring the router
const Module = require('module');
const originalRequire = Module.prototype.require;

let queryStub = {
  equalTo: () => {},
  first: async () => null,
  find: async () => []
};
let objectStub = {
  set: () => {},
  save: async () => {},
  destroy: async () => {},
  get: () => null
};

Module.prototype.require = function(path) {
  if (path === 'parse/node') {
    return {
      Object: {
        extend: () => function() { return objectStub; }
      },
      Query: function() { return queryStub; }
    };
  }
  if (path === '../middleware/auth') {
    return {
      authenticateUser: (req, res, next) => {
        if (req.headers['x-user-id']) {
          req.user = { id: req.headers['x-user-id'] };
          req.userId = req.headers['x-user-id'];
        } else {
          req.user = null;
          req.userId = null;
        }
        next();
      },
      requireAuth: (req, res, next) => {
        if (!req.user && !req.userId) {
          return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        next();
      }
    };
  }
  return originalRequire.apply(this, arguments);
};

const pushRouter = require('../routes/pushNotifications');

const app = express();
app.use(express.json());
app.use('/api/push-notifications', pushRouter);

test('Push Notifications API Security', async (t) => {
  await t.test('POST /send is protected and prevents sending to others', async () => {
    // 1. Unauthenticated should fail (401)
    let res = await request(app)
      .post('/api/push-notifications/send')
      .send({ title: 'Spam', body: 'This is spam' });
    assert.strictEqual(res.status, 401);

    // 2. Authenticated but trying to send to another user should fail (403)
    res = await request(app)
      .post('/api/push-notifications/send')
      .set('x-user-id', 'user-1')
      .send({ title: 'Spam', body: 'This is spam', userId: 'user-2' });
    assert.strictEqual(res.status, 403);

    // 3. Authenticated and sending to self should pass (200)
    res = await request(app)
      .post('/api/push-notifications/send')
      .set('x-user-id', 'user-1')
      .send({ title: 'Alert', body: 'This is an alert', userId: 'user-1' });
    assert.strictEqual(res.status, 200);
  });

  await t.test('DELETE /unregister prevents unregistering another users token', async () => {
    // 1. Unauthenticated should fail (401)
    let res = await request(app)
      .delete('/api/push-notifications/unregister')
      .send({ token: 'test-token' });
    assert.strictEqual(res.status, 401);

    // Mock query.first to return a token owned by user-2
    queryStub.first = async () => ({
      get: (field) => field === 'userId' ? 'user-2' : null,
      destroy: async () => {}
    });

    // 2. Authenticated as user-1 trying to unregister user-2's token (403)
    res = await request(app)
      .delete('/api/push-notifications/unregister')
      .set('x-user-id', 'user-1')
      .send({ token: 'test-token' });
    assert.strictEqual(res.status, 403);

    // 3. Authenticated as user-2 trying to unregister own token (200)
    res = await request(app)
      .delete('/api/push-notifications/unregister')
      .set('x-user-id', 'user-2')
      .send({ token: 'test-token' });
    assert.strictEqual(res.status, 200);
  });
});
