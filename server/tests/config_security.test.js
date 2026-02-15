const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');

// Mock Config model BEFORE requiring router
const Config = require('../models/Config');
Config.get = async () => 'secret_value';
Config.getAll = async () => ({ key: 'value' });
Config.set = async () => true;

// Mock Auth Middleware to simulate unauthenticated user
// We need to mock this because the real middleware checks Parse initialization
const authMiddleware = require('../middleware/auth');
authMiddleware.authenticateUser = (req, res, next) => {
  req.user = null;
  req.userId = null;
  next();
};

const configRouter = require('../routes/config');

const app = express();
app.use(express.json());
app.use('/api/config', configRouter);

test('GET /api/config/:key security check', async (t) => {
  console.log('Testing GET /api/config/secret for unauthorized access...');
  const response = await request(app)
    .get('/api/config/secret')
    .set('Accept', 'application/json');

  console.log(`Response status: ${response.status}`);

  if (response.status === 200) {
    console.log('⚠️  VULNERABILITY CONFIRMED: /api/config/secret is accessible without auth');
  } else if (response.status === 401) {
    console.log('✅ SECURE: /api/config/secret returned 401 Unauthorized');
  } else {
    console.log(`ℹ️  Unexpected status: ${response.status}`);
  }

  // Store status for assertions later
  t.diagnostic(`GET Status: ${response.status}`);
});

test('POST /api/config/:key security check', async (t) => {
  console.log('Testing POST /api/config/secret for unauthorized access...');
  const response = await request(app)
    .post('/api/config/secret')
    .send({ value: 'hacked' })
    .set('Accept', 'application/json');

  console.log(`Response status: ${response.status}`);

  if (response.status === 200) {
    console.log('⚠️  VULNERABILITY CONFIRMED: POST /api/config/secret is accessible without auth');
  } else if (response.status === 401) {
    console.log('✅ SECURE: POST /api/config/secret returned 401 Unauthorized');
  } else {
    console.log(`ℹ️  Unexpected status: ${response.status}`);
  }

  t.diagnostic(`POST Status: ${response.status}`);
});
