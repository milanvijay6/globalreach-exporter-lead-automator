const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');

// Mock Lead model BEFORE requiring router
const Lead = require('../models/Lead');
Lead.find = async () => [];

const leadsRouter = require('../routes/leads');

const app = express();
app.use(express.json());
// Intentionally NOT adding authenticateUser globally to mimic server/index.js behavior for this route
app.use('/api/leads', leadsRouter);

test('GET /api/leads security check', async (t) => {
  console.log('Testing GET /api/leads for unauthorized access...');
  const response = await request(app)
    .get('/api/leads')
    .set('Accept', 'application/json');

  console.log(`Response status: ${response.status}`);

  if (response.status === 200) {
    console.log('⚠️  VULNERABILITY CONFIRMED: /api/leads is accessible without auth');
    assert.fail('Expected 401 Unauthorized, but got 200 OK');
  } else if (response.status === 401) {
    console.log('✅ SECURE: /api/leads returned 401 Unauthorized');
    assert.strictEqual(response.status, 401, 'Expected 401 Unauthorized');
  } else {
    console.log(`ℹ️  Unexpected status: ${response.status}`);
    if (response.status === 500) {
       console.log('Error:', response.body);
    }
  }
});
