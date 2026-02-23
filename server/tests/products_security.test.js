const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');
const path = require('path');

// Helper to clear require cache for clean slate
function clearCache() {
  Object.keys(require.cache).forEach(key => {
    if (key.includes('/server/routes/') || key.includes('/server/models/')) {
      delete require.cache[key];
    }
  });
}

// Mock Parse SDK globally
const Parse = {
  Query: class {
    constructor(className) {
      this.className = className;
    }
    equalTo(key, value) {
      this.equalToCalledWith = { key, value };
      return this;
    }
    matches(key, regex, modifiers) {
      this.matchesCalledWith = { key, regex, modifiers };
      return this;
    }
    containsAll(key, values) {
      this.containsAllCalledWith = { key, values };
      return this;
    }
    limit(n) {
      this.limitCalledWith = n;
      return this;
    }
    skip(n) {
      return this;
    }
    find() {
      global.lastQuery = this;
      return Promise.resolve([]);
    }
    get() {
      return Promise.resolve({});
    }
  },
  Object: {
    extend: (name) => name
  },
  User: {
      current: () => null
  },
  Error: {
      OBJECT_NOT_FOUND: 101
  }
};

// Determine paths for mocking
const parseNodePath = require.resolve('parse/node');
const authPath = path.resolve(__dirname, '../middleware/auth.js');
const cachePath = path.resolve(__dirname, '../middleware/cache.js');
const catalogCachePath = path.resolve(__dirname, '../services/productCatalogCache.js');
const queryCachePath = path.resolve(__dirname, '../utils/parseQueryCache.js');
const productModelPath = path.resolve(__dirname, '../models/Product.js');
const paginationPath = path.resolve(__dirname, '../utils/pagination.js');
const projectionPath = path.resolve(__dirname, '../utils/fieldProjection.js');

// Mock require cache
require.cache[parseNodePath] = { exports: Parse };

require.cache[authPath] = {
  exports: {
    authenticateUser: (req, res, next) => next(),
    requireAuth: (req, res, next) => next()
  }
};

require.cache[cachePath] = {
  exports: {
    cacheMiddleware: () => (req, res, next) => next(),
    invalidateCache: () => {},
    invalidateByTag: () => {}
  }
};

require.cache[catalogCachePath] = {
  exports: {
    productCatalogCache: {
      get: () => null,
      set: () => {},
      invalidate: () => {}
    }
  }
};

require.cache[queryCachePath] = {
  exports: {
    findWithCache: async (query) => {
      global.lastQuery = query;
      return [];
    }
  }
};

require.cache[productModelPath] = { exports: class {} };

require.cache[paginationPath] = {
  exports: {
    applyCursor: () => {},
    getNextCursor: () => null,
    formatPaginatedResponse: (results) => ({ results })
  }
};

require.cache[projectionPath] = {
    exports: {
        projectFields: (obj) => obj
    }
};

// Require the router under test
const productsRouter = require('../routes/products');

const app = express();
app.use(express.urlencoded({ extended: true })); // Enable nested objects
app.use(express.json());
app.use('/api/products', productsRouter);

test('GET /api/products NoSQL Injection Check (category)', async (t) => {
  global.lastQuery = null;

  // Expect 400 Bad Request because we sanitize inputs now
  await request(app)
    .get('/api/products?category[$ne]=safe_value')
    .expect(400);

  const query = global.lastQuery;

  if (query) {
     // If query was executed, check if it was sanitized
     if (query.equalToCalledWith && typeof query.equalToCalledWith.value === 'object') {
        assert.fail('Vulnerability detected: category parameter accepts objects');
     }
  }
  console.log('✅ SECURE: category parameter was rejected/sanitized');
});

test('GET /api/products/search NoSQL Injection Check (q)', async (t) => {
    global.lastQuery = null;

    // Expect 400 Bad Request
    await request(app)
        .get('/api/products/search?q[$ne]=something')
        .expect(400);

    const query = global.lastQuery;

    if (query) {
        if (query.matchesCalledWith && typeof query.matchesCalledWith.regex === 'object') {
            assert.fail('Vulnerability detected: q parameter accepts objects');
        }
    }
    console.log('✅ SECURE: q parameter was rejected/sanitized');
});
