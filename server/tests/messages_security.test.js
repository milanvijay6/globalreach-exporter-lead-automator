const test = require('node:test');
const assert = require('node:assert');

// Simple mock for express router to test NoSQL injection protection logic
const getRouteHandlers = () => {
    let handlers = [];
    const routerMock = {
        use: () => {},
        get: (path, ...args) => {
            if (path === '/') {
                handlers = args;
            }
        },
        post: () => {},
    };

    // Need to require module and return its handlers
    const proxyquire = require('proxyquire');

    // Create mock for Parse
    const ParseMock = {
        Query: class {
            equalTo(key, val) {
                this[key] = val;
            }
            notEqualTo() {}
            descending() {}
            limit() {}
        }
    };

    // Mock the router module dependencies
    const messagesRouter = proxyquire('../routes/messages', {
        'parse/node': ParseMock,
        'express': { Router: () => routerMock },
        '../models/Message': {},
        '../utils/parseFileService': { parseFileService: {} },
        '../middleware/cache': { cacheMiddleware: () => ((req, res, next) => next()), invalidateByTag: () => {} },
        '../utils/parseQueryCache': { findWithCache: async () => [] },
        '../middleware/auth': { authenticateUser: () => {}, requireAuth: () => {} },
        '../utils/fieldProjection': { projectFields: () => {} }
    });

    return { router: messagesRouter, handlers, ParseMock };
};

test('messages route protects against NoSQL injection in req.query', async () => {
    const { handlers, ParseMock } = getRouteHandlers();
    const routeHandler = handlers[handlers.length - 1]; // The actual async (req, res) handler

    // Test 1: string inputs work
    let req1 = {
        query: { importerId: 'lead_123', channel: 'whatsapp', status: 'delivered' }
    };
    let res1 = {
        status: (code) => res1,
        json: (data) => { res1.data = data; return res1; }
    };

    await routeHandler(req1, res1);
    // It should proceed normally without returning 400
    assert.strictEqual(res1.data.success, true);

    // Test 2: object inputs are rejected/ignored
    let req2 = {
        query: { importerId: { $ne: null }, channel: { $ne: null }, status: { $ne: null } }
    };
    let res2 = {
        status: (code) => { res2.statusCode = code; return res2; },
        json: (data) => { res2.data = data; return res2; }
    };

    await routeHandler(req2, res2);
    // Since importerId is not a string, it becomes undefined and is required
    assert.strictEqual(res2.statusCode, 400);
    assert.strictEqual(res2.data.error, 'importerId is required and must be a string');
});
