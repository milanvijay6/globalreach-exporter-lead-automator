const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');

const app = express();
app.use(express.json());

const aiRouter = require('../routes/ai');
app.use('/api/ai', aiRouter);

test('GET /api/ai/stream/generate-message security check', async (t) => {
  const response = await request(app)
    .get('/api/ai/stream/generate-message?importer=%7B%7D&systemInstructionTemplate=t&targetChannel=c')
    .set('Accept', 'text/event-stream');

  if (response.status === 200 || response.status === 500) {
    console.log('VULNERABLE: Did not return 401 Unauthorized', response.status);
    assert.fail('Expected 401 Unauthorized');
  } else if (response.status === 401) {
    console.log('SECURE');
    assert.strictEqual(response.status, 401);
  } else {
    console.log('Unexpected status', response.status);
    assert.fail(`Unexpected status: ${response.status}`);
  }
});
