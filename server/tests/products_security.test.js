const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');
const path = require('path');

// --- MOCKING SETUP ---

// Mock Parse SDK
const mockQuery = {
  equalTo: test.mock.fn(),
  containsAll: test.mock.fn(),
  matches: test.mock.fn(),
  limit: test.mock.fn(),
  skip: test.mock.fn(),
  find: test.mock.fn(async () => []),
  get: test.mock.fn(async (id) => {
    if (id === 'search') {
      const error = new Error('Object not found'); // Simulate Parse error for invalid ID
      error.code = 101;
      throw error;
    }
    return {
      id: 'mock-id',
      get: (field) => `mock-${field}`
    };
  })
};

const mockParse = {
  Query: class {
    constructor() {
      return mockQuery;
    }
  },
  Object: class {
    constructor() {}
    set() {}
    save() {}
  },
  Error: {
    OBJECT_NOT_FOUND: 101
  }
};

// Mock other dependencies
const mockAuth = {
  authenticateUser: (req, res, next) => { req.userId = 'test-user'; next(); },
  requireAuth: (req, res, next) => next()
};

const mockCache = {
  cacheMiddleware: () => (req, res, next) => next(),
  invalidateCache: async () => {},
  invalidateByTag: async () => {}
};

const mockProductCatalogCache = {
  productCatalogCache: {
    get: () => null,
    set: () => {},
    invalidate: () => {}
  }
};

const mockPagination = {
  applyCursor: () => {},
  getNextCursor: () => null,
  formatPaginatedResponse: (data) => ({ data })
};

const mockParseQueryCache = {
  findWithCache: async (query) => {
    // We delegate to query.find() to capture the calls on mockQuery
    return query.find();
  }
};

const mockFieldProjection = {
  projectFields: (obj) => obj
};

const mockProductModel = class Product {};

// Inject mocks into require cache
require.cache[require.resolve('parse/node')] = { exports: mockParse };
// We need to resolve paths relative to the ROUTE file, which is inside server/routes/
// But require.resolve resolves relative to THIS file (server/tests/)
// The route file imports:
// '../models/Product' -> server/models/Product.js
// '../middleware/auth' -> server/middleware/auth.js
// etc.

const serverRoot = path.join(__dirname, '..');

require.cache[path.join(serverRoot, 'models/Product.js')] = { exports: mockProductModel };
require.cache[path.join(serverRoot, 'middleware/auth.js')] = { exports: mockAuth };
require.cache[path.join(serverRoot, 'middleware/cache.js')] = { exports: mockCache };
require.cache[path.join(serverRoot, 'services/productCatalogCache.js')] = { exports: mockProductCatalogCache };
require.cache[path.join(serverRoot, 'utils/pagination.js')] = { exports: mockPagination };
require.cache[path.join(serverRoot, 'utils/parseQueryCache.js')] = { exports: mockParseQueryCache };
require.cache[path.join(serverRoot, 'utils/fieldProjection.js')] = { exports: mockFieldProjection };


// Load router
const productsRouter = require('../routes/products');

const app = express();
// Enable extended query parsing to allow objects in query strings
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/api/products', productsRouter);

// --- TESTS ---

test('GET /api/products security - NoSQL Injection prevention', async (t) => {
  // Reset mocks
  mockQuery.equalTo.mock.resetCalls();

  // Attack: try to inject an object into category
  // Sending nested object via query string: category[ne]=electronics
  // express.urlencoded({ extended: true }) parses this as { category: { ne: 'electronics' } }

  await request(app)
    .get('/api/products?category[ne]=electronics')
    .expect(200);

  // Check what equalTo was called with
  const calls = mockQuery.equalTo.mock.calls;

  // If the vulnerability exists, equalTo is called with an object
  const vulnCall = calls.find(call => call.arguments[0] === 'category' && typeof call.arguments[1] === 'object');

  if (vulnCall) {
    console.log('⚠️  VULNERABILITY CONFIRMED: Parse.Query.equalTo called with object:', vulnCall.arguments[1]);
    // We expect this to FAIL if we want to confirm the vulnerability exists.
    // Wait, the plan is to verify the vulnerability exists, so this test SHOULD PASS (confirming vuln) now?
    // Usually "reproduction test" means it fails if vuln exists (red) and passes if fixed (green).
    // Or it confirms existence by asserting the vuln condition.
    // I'll make it fail if vuln exists, so I can see it failing, then fix it.
    assert.fail('Vulnerability exists: Input not sanitized');
  } else {
    // If no vuln call, it might be because code threw error or sanitized it (if fixed)
    // For now we assume unpatched code passes the object.
  }
});

test('GET /api/products/search - Route Shadowing', async (t) => {
  mockQuery.get.mock.resetCalls();
  mockQuery.find.mock.resetCalls();

  // If shadowed, it hits /:id
  // The /:id handler calls Product.get(id).
  // Our mock get throws error for id='search' (simulating "Product not found" or "Invalid ID")

  const res = await request(app).get('/api/products/search?q=test');

  if (res.status === 404 && res.body.error === 'Product not found') {
      console.log('⚠️  ROUTE SHADOWING CONFIRMED: /search hit /:id handler');
      assert.fail('Route /search is shadowed by /:id');
  }

  // If it hit /search, it would call query.find() and return 200
  if (res.status === 200) {
      // Check if find was called
      if (mockQuery.find.mock.callCount() > 0) {
          console.log('✅ Route /search is accessible');
      } else {
          // Maybe it hit /:id and found a product with id "search"?
          // Our mock get throws, so 200 means it must be /search route (unless get didn't throw)
      }
  }
});
