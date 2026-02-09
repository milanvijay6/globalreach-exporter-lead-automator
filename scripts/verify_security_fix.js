const { spawn } = require('child_process');
const http = require('http');

const PORT = 8081; // Use a different port to avoid conflict if 8080 is taken
process.env.PORT = PORT;
// Disable DB features for test
process.env.MONGO_URI = '';
process.env.PARSE_APPLICATION_ID = 'test-app-id'; // Must be set for auth middleware to work
// We need PARSE_APPLICATION_ID to trigger authentication logic in authenticateUser.
// If it is missing, authenticateUser sets user to null and continues (but requireAuth will fail).
// Wait, if PARSE_APPLICATION_ID is MISSING, authenticateUser calls next() without setting req.user.
// requireAuth checks !req.user -> 401.
// So it should work even without PARSE_APPLICATION_ID.
// BUT, in auth.js:
// if (!hasValidAppId) { ... return next(); }
// So req.user is null.
// requireAuth sees req.user is null -> 401.
// So yes, it works.

// However, to mimic real env, let's set it.

console.log('Starting server for verification...');
const serverProcess = spawn('node', ['server/index.js'], {
  env: { ...process.env, PORT: PORT, PARSE_APPLICATION_ID: 'test', NODE_ENV: 'test' },
  stdio: 'inherit'
});

const cleanup = () => {
  console.log('Stopping server...');
  serverProcess.kill();
};

process.on('SIGINT', cleanup);
process.on('exit', cleanup);

const waitForServer = async () => {
  let attempts = 0;
  while (attempts < 30) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${PORT}/health`, (res) => {
          if (res.statusCode === 200 || res.statusCode === 503) {
            resolve();
          } else {
            reject(new Error(`Status ${res.statusCode}`));
          }
        });
        req.on('error', reject);
        req.end();
      });
      console.log('Server is ready!');
      return;
    } catch (e) {
      await new Promise(r => setTimeout(r, 1000));
      attempts++;
    }
  }
  throw new Error('Server failed to start');
};

const runTest = async () => {
  try {
    await waitForServer();

    console.log('Testing POST /api/products without auth...');
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: '/api/products',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const statusCode = await new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        resolve(res.statusCode);
      });
      req.on('error', reject);
      req.write(JSON.stringify({ name: 'Hacked Product' }));
      req.end();
    });

    console.log(`Response Status Code: ${statusCode}`);

    if (statusCode === 401) {
      console.log('✅ PASS: Request was rejected with 401 Unauthorized.');
      process.exit(0);
    } else {
      console.error(`❌ FAIL: Expected 401, got ${statusCode}`);
      process.exit(1);
    }

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
};

runTest();
