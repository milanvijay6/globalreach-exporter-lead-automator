const express = require('express');
const path = require('path');
const http = require('http');

// Mock Parse
const ParseMock = {
  Object: {
    extend: (name) => {
      return class MockObject {
        constructor() { this.id = 'mock_id'; }
        set(k, v) {}
        get(k) { return null; }
        save() {
          // console.log('SAVE_CALLED');
          return Promise.resolve(this);
        }
        destroy() {
            return Promise.resolve();
        }
      };
    }
  },
  Query: class {
    constructor() {}
    get() { return Promise.resolve(new (ParseMock.Object.extend('Product'))()); }
    find() { return Promise.resolve([]); }
    equalTo() {}
    containsAll() {}
    matches() {}
    limit() {}
    skip() {}
    descending() {}
  },
  Error: { OBJECT_NOT_FOUND: 101 },
  initialize: () => {},
  applicationId: 'mock-app-id'
};

// Poison the require cache for parse/node
try {
    const parsePath = require.resolve('parse/node');
    require.cache[parsePath] = {
        id: parsePath,
        filename: parsePath,
        loaded: true,
        exports: ParseMock
    };
} catch (e) {
    console.error("Could not mock parse/node", e);
}

// Mock ../middleware/auth
const AuthMock = {
    authenticateUser: (req, res, next) => {
        // Mock behavior: checks header
        if (req.headers['x-user-id']) {
            req.user = { id: req.headers['x-user-id'] };
            req.userId = req.headers['x-user-id'];
        }
        next();
    }
};

const authPath = path.resolve(__dirname, '../server/middleware/auth.js');
require.cache[authPath] = {
    id: authPath,
    filename: authPath,
    loaded: true,
    exports: AuthMock
};

// Load the route
const productsRoutePath = path.resolve(__dirname, '../server/routes/products.js');
let productsRouter;
try {
    productsRouter = require(productsRoutePath);
} catch (e) {
    console.error("Failed to load products route:", e);
    process.exit(1);
}

// Setup Express app
const app = express();
app.use(express.json());
app.use('/api/products', productsRouter);

// Function to run the test
function runTest() {
    console.log('Running Security Regression Tests for Products API...');

    const server = app.listen(0, () => {
        const port = server.address().port;
        const postData = JSON.stringify({ name: 'Hacked Product', price: 0 });

        // Test 1: Unauthenticated POST (Should be 401)
        const req = http.request({
            hostname: 'localhost',
            port: port,
            path: '/api/products',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': postData.length
                // No X-User-Id header
            }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode !== 401) {
                    console.error(`❌ FAIL: Unauthenticated POST request returned ${res.statusCode}, expected 401`);
                    process.exit(1);
                } else {
                    console.log('✅ PASS: Unauthenticated POST request rejected (401)');
                }

                // Test 2: Authenticated POST (Should be 200)
                runAuthenticatedTest(server, port);
            });
        });
        req.on('error', (e) => { console.error(e); server.close(); process.exit(1); });
        req.write(postData);
        req.end();
    });
}

function runAuthenticatedTest(server, port) {
    const postData = JSON.stringify({ name: 'Legit Product', price: 100 });

    const req = http.request({
        hostname: 'localhost',
        port: port,
        path: '/api/products',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': postData.length,
            'X-User-Id': 'admin-user' // Auth header
        }
    }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            if (res.statusCode !== 200) {
                console.error(`❌ FAIL: Authenticated POST request returned ${res.statusCode}, expected 200`);
                process.exit(1);
            } else {
                console.log('✅ PASS: Authenticated POST request accepted (200)');
            }

            // Test 3: Unauthenticated GET (Should be 200 - Public)
            runPublicGetTest(server, port);
        });
    });
    req.on('error', (e) => { console.error(e); server.close(); process.exit(1); });
    req.write(postData);
    req.end();
}

function runPublicGetTest(server, port) {
    const req = http.request({
        hostname: 'localhost',
        port: port,
        path: '/api/products',
        method: 'GET',
        // No Auth headers
    }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            if (res.statusCode !== 200) {
                console.error(`❌ FAIL: Unauthenticated GET request returned ${res.statusCode}, expected 200`);
                process.exit(1);
            } else {
                console.log('✅ PASS: Unauthenticated GET request allowed (200)');
            }

            server.close();
            process.exit(0);
        });
    });
    req.on('error', (e) => { console.error(e); server.close(); process.exit(1); });
    req.end();
}

runTest();
