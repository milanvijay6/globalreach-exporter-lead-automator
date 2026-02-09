const crypto = require('crypto');

// Mock dependencies
jest.mock('../../../server/models/Config', () => ({
  get: jest.fn()
}));

jest.mock('../../../server/queues/webhookQueue', () => ({
  queueWebhook: jest.fn()
}));

// Mock logger
jest.mock('winston', () => {
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
  return {
    createLogger: () => logger,
    format: {
      combine: jest.fn(),
      timestamp: jest.fn(),
      json: jest.fn(),
      simple: jest.fn()
    },
    transports: {
      Console: jest.fn()
    }
  };
});

const Config = require('../../../server/models/Config');
const webhookRouter = require('../../../server/routes/webhooks');

// Helper to find the handler for POST /whatsapp
const findHandler = (router, method, path) => {
  const layer = router.stack.find(l => {
    if (l.route) {
      return l.route.path === path && l.route.methods[method.toLowerCase()];
    }
    return false;
  });
  return layer ? layer.route.stack[0].handle : null;
};

describe('WhatsApp Webhook Security', () => {
  let handler;
  const SECRET = 'test_secret_123';
  const PAYLOAD = { object: 'whatsapp_business_account', entry: [] };
  const PAYLOAD_BUFFER = Buffer.from(JSON.stringify(PAYLOAD));

  beforeAll(() => {
    handler = findHandler(webhookRouter, 'POST', '/whatsapp');
    if (!handler) {
      throw new Error('Handler not found');
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should accept request with valid signature', async () => {
    Config.get.mockImplementation((key) => {
      if (key === 'whatsappAppSecret') return Promise.resolve(SECRET);
      return Promise.resolve(null);
    });

    const signature = crypto
      .createHmac('sha256', SECRET)
      .update(PAYLOAD_BUFFER)
      .digest('hex');

    const req = {
      method: 'POST',
      body: PAYLOAD,
      rawBody: PAYLOAD_BUFFER,
      headers: {
        'x-hub-signature-256': `sha256=${signature}`
      }
    };

    const res = {
      sendStatus: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn()
    };

    await handler(req, res);

    expect(res.sendStatus).toHaveBeenCalledWith(200);
    expect(Config.get).toHaveBeenCalledWith('whatsappAppSecret');
  });

  test('should reject request with invalid signature', async () => {
    Config.get.mockImplementation((key) => {
      if (key === 'whatsappAppSecret') return Promise.resolve(SECRET);
      return Promise.resolve(null);
    });

    const req = {
      method: 'POST',
      body: PAYLOAD,
      rawBody: PAYLOAD_BUFFER,
      headers: {
        'x-hub-signature-256': 'sha256=invalid_signature'
      }
    };

    const res = {
      sendStatus: jest.fn()
    };

    await handler(req, res);

    expect(res.sendStatus).toHaveBeenCalledWith(401);
  });

  test('should reject request without signature when secret is configured', async () => {
    Config.get.mockImplementation((key) => {
      if (key === 'whatsappAppSecret') return Promise.resolve(SECRET);
      return Promise.resolve(null);
    });

    const req = {
      method: 'POST',
      body: PAYLOAD,
      rawBody: PAYLOAD_BUFFER,
      headers: {}
    };

    const res = {
      sendStatus: jest.fn()
    };

    await handler(req, res);

    expect(res.sendStatus).toHaveBeenCalledWith(401);
  });

  test('should accept request without signature when secret is NOT configured', async () => {
    Config.get.mockImplementation((key) => {
      if (key === 'whatsappAppSecret') return Promise.resolve(null);
      return Promise.resolve(null);
    });

    const req = {
      method: 'POST',
      body: PAYLOAD,
      rawBody: PAYLOAD_BUFFER,
      headers: {}
    };

    const res = {
      sendStatus: jest.fn()
    };

    await handler(req, res);

    expect(res.sendStatus).toHaveBeenCalledWith(200);
  });
});
