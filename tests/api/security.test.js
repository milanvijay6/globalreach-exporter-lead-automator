const express = require('express');
const request = require('supertest');

// Mocks
const mockQuery = {
  equalTo: jest.fn(),
  notEqualTo: jest.fn(),
  descending: jest.fn(),
  limit: jest.fn(),
  find: jest.fn().mockResolvedValue([]),
  get: jest.fn().mockResolvedValue({ id: '1', get: () => 'val' }),
  containsAll: jest.fn(),
  matches: jest.fn(),
};

jest.mock('parse/node', () => ({
  Query: jest.fn().mockImplementation(() => mockQuery),
  User: {
    become: jest.fn(),
  },
  Error: {
    OBJECT_NOT_FOUND: 101,
  },
  Object: {
    extend: jest.fn(),
  },
  // Mock applicationId to allow auth middleware to proceed
  applicationId: 'test-app-id',
  initialize: jest.fn(),
}));

jest.mock('../../server/models/Lead', () => 'Lead');
jest.mock('../../server/models/Message', () => 'Message');

jest.mock('../../server/middleware/cache', () => ({
  cacheMiddleware: () => (req, res, next) => next(),
  invalidateCache: jest.fn(),
  invalidateByTag: jest.fn(),
}));

jest.mock('../../server/utils/pagination', () => ({
  applyCursor: jest.fn(),
  getNextCursor: jest.fn(),
  formatPaginatedResponse: jest.fn().mockImplementation((results) => ({ results })),
}));

jest.mock('../../server/utils/fieldProjection', () => ({
  projectFields: jest.fn().mockImplementation((obj) => obj),
}));

jest.mock('../../server/utils/parseFileService', () => ({
  parseFileService: {
    createMessage: jest.fn().mockResolvedValue({
      id: '1',
      get: (field) => field === 'emailBodyFile' ? false : 'val'
    }),
    getContent: jest.fn().mockResolvedValue('content'),
  }
}));

jest.mock('../../server/utils/parseQueryCache', () => ({
  findWithCache: jest.fn().mockResolvedValue([]),
}));

// We use the REAL middleware/auth.js, which relies on the mocked parse/node

// Load routes
const leadsRouter = require('../../server/routes/leads');
const messagesRouter = require('../../server/routes/messages');

const app = express();
app.use(express.json());
app.use('/api/leads', leadsRouter);
app.use('/api/messages', messagesRouter);

describe('Security: Auth Enforcement', () => {
  describe('Unauthenticated Access', () => {
    it('should deny access to GET /api/leads without auth', async () => {
      const res = await request(app).get('/api/leads');
      expect(res.status).toBe(401);
    });

    it('should deny access to POST /api/messages without auth', async () => {
        const res = await request(app).post('/api/messages').send({
            importerId: '1', channel: 'email', content: 'test'
        });
        expect(res.status).toBe(401);
    });
  });

  describe('Authenticated Access', () => {
    it('should allow access to GET /api/leads with X-User-Id header', async () => {
      const res = await request(app)
        .get('/api/leads')
        .set('X-User-Id', 'user123');
      expect(res.status).toBe(200);
    });

    it('should allow access to POST /api/messages with X-User-Id header', async () => {
        const res = await request(app)
          .post('/api/messages')
          .set('X-User-Id', 'user123')
          .send({
            importerId: '1', channel: 'email', content: 'test'
          });
        expect(res.status).toBe(200);
    });
  });
});
