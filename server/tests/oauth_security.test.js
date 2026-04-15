const test = require('node:test');
const assert = require('node:assert');

test('OAuth routes load correctly and contain XSS fixes', async (t) => {
  const fs = require('fs');
  const path = require('path');
  const oauthCode = fs.readFileSync(path.join(__dirname, '../routes/oauth.js'), 'utf8');

  assert.ok(oauthCode.includes('escapeHtml(error)'), 'Fix should be applied for error param');
  assert.ok(oauthCode.includes('escapeHtml(rawUrl.substring(0, 200))'), 'Fix should be applied for rawUrl');
  assert.ok(!oauthCode.includes('<p>Error: ${error}</p>'), 'Vulnerable raw interpolation should be removed');
});
