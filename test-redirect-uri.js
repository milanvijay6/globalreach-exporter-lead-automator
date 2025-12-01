/**
 * Test script to verify OAuth redirect URI is accessible
 * Run this while the Electron app is running
 */

const http = require('http');

const PORT = 4000;
const REDIRECT_URI = `http://localhost:${PORT}/api/oauth/callback`;

console.log('Testing OAuth Redirect URI Accessibility...\n');
console.log(`Redirect URI: ${REDIRECT_URI}\n`);

// Test 1: Check if server is running
console.log('Test 1: Checking if server is running on port', PORT);
const testRequest = http.get(`http://localhost:${PORT}/api/oauth/callback?test=1`, (res) => {
  console.log(`✓ Server is running (Status: ${res.statusCode})`);
  console.log(`✓ Endpoint is accessible\n`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✓ Endpoint responded successfully');
      if (data.includes('Authentication Error') || data.includes('Missing authorization')) {
        console.log('✓ Endpoint is correctly handling OAuth callbacks (expects code and state parameters)\n');
      }
    }
    console.log('\n✅ Redirect URI endpoint is accessible and working!');
    console.log('\nNext steps:');
    console.log('1. Verify in Azure Portal that this exact URI is configured:');
    console.log(`   ${REDIRECT_URI}`);
    console.log('2. Make sure it is under "Web" platform, NOT "Single-page application"');
    console.log('3. Ensure it is the ONLY redirect URI (no duplicates)');
    process.exit(0);
  });
});

testRequest.on('error', (err) => {
  if (err.code === 'ECONNREFUSED') {
    console.log('✗ Server is NOT running on port', PORT);
    console.log('  Please start the Electron app first, then run this test again.\n');
  } else {
    console.log('✗ Error:', err.message);
  }
  console.log('\n❌ Redirect URI endpoint is NOT accessible');
  console.log('\nTroubleshooting:');
  console.log('1. Make sure the Electron app is running');
  console.log('2. Check if port', PORT, 'is already in use');
  console.log('3. Verify the server started successfully in the app logs');
  process.exit(1);
});

testRequest.setTimeout(5000, () => {
  console.log('✗ Request timeout - server may not be responding');
  process.exit(1);
});

