const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');

const app = express();
app.use(express.json());

const syncRouter = require('../routes/sync');
app.use('/api/sync', syncRouter);

test('GET /api/sync/leads security check', async (t) => {
  const response = await request(app)
    .get('/api/sync/leads')
    .set('Accept', 'application/json');

  if (response.status === 200) {
    console.log('VULNERABLE: Did not return 401 Unauthorized', response.status);
    assert.fail('Expected 401 Unauthorized, but got 200 OK');
  } else if (response.status === 401) {
    console.log('SECURE');
    assert.strictEqual(response.status, 401);
  } else {
    console.log('Unexpected status', response.status);
    assert.fail(`Unexpected status: ${response.status}`);
  }
});
