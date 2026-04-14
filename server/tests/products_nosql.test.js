const test = require('node:test');
const assert = require('node:assert');

let queryInstances = [];
class MockQuery {
  constructor() { queryInstances.push(this); }
  equalTo(field, val) { this[field + '_eq'] = val; }
  matches(field, val, flags) { this[field + '_matches'] = val; }
  containsAll(field, val) { this[field + '_contains'] = val; }
  limit() {}
  find() { return Promise.resolve([]); }
}

const mockExpress = {
  Router: () => {
    const router = {
      routes: {},
      get: (path, ...handlers) => { router.routes[`GET ${path}`] = handlers; },
      post: () => {},
      put: () => {},
      delete: () => {},
      use: () => {}
    };
    return router;
  }
};

const proxyquire = require('proxyquire').noCallThru();
const productsRouter = proxyquire('../routes/products', {
  'express': mockExpress,
  'parse/node': { Query: MockQuery },
  '../models/Product': {},
  '../middleware/auth': { authenticateUser: (req, res, next) => next(), requireAuth: (req, res, next) => next() },
  '../middleware/cache': { cacheMiddleware: () => (req, res, next) => next(), invalidateCache: () => {}, invalidateByTag: () => {} },
  '../utils/pagination': { applyCursor: () => {}, getNextCursor: () => null, formatPaginatedResponse: () => ({}) },
  '../utils/parseQueryCache': { findWithCache: () => Promise.resolve([]) },
  '../services/productCatalogCache': { productCatalogCache: { get: () => null, set: () => {}, invalidate: () => {} } },
  '../utils/fieldProjection': { projectFields: (base) => base }
});

test('products NoSQL injection in /', async () => {
  const handlers = productsRouter.routes['GET /'];
  const handler = handlers[handlers.length - 1];

  const req = {
    query: {
      category: { $ne: 'something' },
      search: { $regex: '.*' },
      status: { $gt: '' },
      tags: [{ $ne: 'a' }]
    }
  };

  let responseData;
  const res = {
    json: (data) => { responseData = data; },
    status: (code) => ({ json: (data) => { responseData = data; } })
  };

  await handler(req, res);

  const query = queryInstances[0];
  console.log("GET / query parameters passed to Parse:", query);

  assert.ok(query.category_eq === undefined, 'NoSQL injection MITIGATED on category');
});

test('products NoSQL injection in /search', async () => {
  queryInstances = [];
  const handlers = productsRouter.routes['GET /search'];
  const handler = handlers[handlers.length - 1];

  const req = {
    query: {
      category: { $ne: 'something' },
      q: { $regex: '.*' },
      tags: [{ $ne: 'a' }]
    }
  };

  let responseData;
  const res = {
    json: (data) => { responseData = data; },
    status: (code) => ({ json: (data) => { responseData = data; } })
  };

  await handler(req, res);

  const query = queryInstances[0];
  console.log("GET /search query parameters passed to Parse:", query);
  assert.ok(query.category_eq === undefined, 'NoSQL injection MITIGATED on category in /search');
});
