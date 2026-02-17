// Process-level optimizations for Azure F1 Free Tier
process.title = 'globalreach-crm';
if (!process.env.UV_THREADPOOL_SIZE) {
  process.env.UV_THREADPOOL_SIZE = '2';
}

const express = require('express');
require("dotenv").config();
const path = require('path');
const fs = require('fs');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const freeTierConfig = require('./config/freeTier');

// Lightweight logger for startup (winston loaded lazily)
let logger = {
  info: (...args) => console.log('[Server]', ...args),
  warn: (...args) => console.warn('[Server]', ...args),
  error: (...args) => console.error('[Server]', ...args),
};

const app = express();
const PORT = process.env.PORT || 8080;

// ============================================
// PHASE 1: Minimal middleware for fast startup
// ============================================

// Health check FIRST - Azure load balancer needs this ASAP
app.get('/health', (req, res) => {
  const mem = process.memoryUsage();
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    phase: app.locals.initPhase || 'starting',
    freeTier: freeTierConfig.isFreeTier,
    memory: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    },
  });
});

// Security headers (lightweight, no extra deps)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting (skip health checks)
app.use(rateLimit({
  windowMs: freeTierConfig.rateLimitWindowMs,
  max: parseInt(process.env.RATE_LIMIT_MAX || String(freeTierConfig.rateLimitMax), 10),
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
}));

// Compression - gzip only (async, fast). Brotli sync is too slow for cold starts.
app.use(compression({
  threshold: freeTierConfig.compressionThreshold,
  level: 6,
}));

// Body parsing
app.use(express.json({
  limit: '2mb',
  verify: (req, res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// CORS - configurable via ALLOWED_ORIGINS env var (comma-separated), defaults to '*'
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || '*';
app.use((req, res, next) => {
  if (ALLOWED_ORIGINS === '*') {
    res.header('Access-Control-Allow-Origin', '*');
  } else {
    const origin = req.headers.origin;
    const allowed = ALLOWED_ORIGINS.split(',').map(s => s.trim());
    if (origin && allowed.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
    }
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Serve static files from build directory with aggressive caching
const buildPath = path.resolve(__dirname, '..', 'build');
const indexPath = path.resolve(buildPath, 'index.html');

app.use(express.static(buildPath, {
  maxAge: '7d',
  etag: true,
  lastModified: true,
  immutable: true,
  index: false, // We handle index.html via the SPA fallback
  setHeaders: (res, filePath) => {
    // Cache hashed assets forever, HTML files not cached
    if (filePath.includes('/assets/') && /\.[a-f0-9]{8}\./.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  },
}));

// ============================================
// PHASE 2: Start listening IMMEDIATELY
// ============================================

let server;
try {
  server = app.listen(PORT, "0.0.0.0", () => {
    logger.info(`Server listening on port ${PORT} (${Math.round(process.uptime() * 1000)}ms)`);
    app.locals.initPhase = 'listening';

    // PHASE 3: Load everything else in the background
    setImmediate(() => initializeBackground());
  });

  server.on('error', (error) => {
    if (error.code === 'EACCES') {
      logger.error(`Port ${PORT} requires elevated privileges`);
      process.exit(1);
    } else if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${PORT} is already in use`);
      process.exit(1);
    } else {
      throw error;
    }
  });

  // Keep-alive optimization for Azure
  server.keepAliveTimeout = 65000; // Slightly higher than Azure's 60s
  server.headersTimeout = 66000;
} catch (error) {
  logger.error('Failed to start server:', error);
  process.exit(1);
}

// ============================================
// PHASE 3: Background initialization (non-blocking)
// ============================================

async function initializeBackground() {
  const startTime = Date.now();

  // 3a. Upgrade logger to winston
  try {
    const winston = require('winston');
    logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.simple(),
          handleExceptions: true,
          handleRejections: true,
        }),
      ],
    });
  } catch (e) {
    // Keep console logger
  }

  // 3b. Application Insights (non-blocking)
  try {
    const { initializeApplicationInsights } = require('./config/applicationInsights');
    initializeApplicationInsights();
  } catch (e) {
    logger.warn('Application Insights not available:', e.message);
  }

  // 3c. Load and register routes (lazy)
  registerRoutes();

  // 3d. Database connection (non-blocking, deferred)
  connectDatabaseAsync();

  // 3e. Pagination middleware (lightweight, register after routes)
  try {
    const { paginationMiddleware } = require('./middleware/pagination');
    app.use('/api', paginationMiddleware);
  } catch (e) {
    logger.warn('Pagination middleware not available:', e.message);
  }

  // 3f. Scheduled jobs (deferred)
  if (process.env.ENABLE_SCHEDULED_JOBS !== 'false') {
    setTimeout(() => {
      try {
        const { startScheduler } = require('./jobs/scheduler');
        startScheduler();
        logger.info('Scheduled jobs started');
      } catch (e) {
        logger.warn('Scheduled jobs not available:', e.message);
      }
    }, 5000);
  }

  // 3g. AI workers (deferred, disabled on free tier)
  if (freeTierConfig.features.aiWorkers) {
    setTimeout(() => {
      try {
        require('./workers/aiProcessingWorker');
        logger.info('AI processing workers started');
      } catch (e) {
        logger.warn('AI processing workers not available:', e.message);
      }
    }, 8000);
  }

  // 3h. WebSocket server (deferred, disabled on free tier)
  if (freeTierConfig.features.websocket && server) {
    setTimeout(() => {
      try {
        const { initializeWebSocketServer } = require('./websocket/server');
        initializeWebSocketServer(server);
        logger.info('WebSocket server initialized');
      } catch (e) {
        logger.warn('WebSocket server not available:', e.message);
      }
    }, 3000);
  }

  app.locals.initPhase = 'ready';
  logger.info(`Full initialization completed in ${Date.now() - startTime}ms`);

  // Signal ready
  if (process.send) process.send('ready');
}

// ============================================
// Route registration (lazy-loaded)
// ============================================

function registerRoutes() {
  const emptyRouter = express.Router();

  function safeRequire(modulePath, name) {
    try {
      return require(modulePath);
    } catch (e) {
      logger.warn(`Route ${name} not available: ${e.message}`);
      return emptyRouter;
    }
  }

  // Free tier diagnostic routes (no auth, lightweight)
  app.use('/api/f1',                  safeRequire('./routes/freeTier', 'freeTier'));

  // Register all API routes
  app.use('/webhooks',                safeRequire('./routes/webhooks', 'webhooks'));
  app.use('/api/products',            safeRequire('./routes/products', 'products'));
  app.use('/api/integrations',        safeRequire('./routes/integrations', 'integrations'));
  app.use('/api/leads',               safeRequire('./routes/leads', 'leads'));
  app.use('/api/messages',            safeRequire('./routes/messages', 'messages'));
  app.use('/api/livequery',           safeRequire('./routes/livequery', 'livequery'));
  app.use('/api/oauth',               safeRequire('./routes/oauth', 'oauth'));
  app.use('/api/config',              safeRequire('./routes/config', 'config'));
  app.use('/api/cloudflare-worker',   safeRequire('./routes/cloudflare-worker', 'cloudflare-worker'));
  app.use('/api/cloudflare-pages',    safeRequire('./routes/cloudflare-pages', 'cloudflare-pages'));
  app.use('/api/ai/jobs',             safeRequire('./routes/aiJobs', 'aiJobs'));
  app.use('/api/ai',                  safeRequire('./routes/ai', 'ai'));
  app.use('/api/trpc',                safeRequire('./routes/trpc', 'trpc'));
  app.use('/api/bundle',              safeRequire('./routes/bundle', 'bundle'));
  app.use('/api/sync',                safeRequire('./routes/sync', 'sync'));
  app.use('/api/push-notifications',  safeRequire('./routes/pushNotifications', 'pushNotifications'));

  // Product photos
  app.get('/api/product-photos/:productId/:fileName', async (req, res) => {
    try {
      const { productId, fileName } = req.params;
      const Product = require('./models/Product');
      const product = await Product.get(productId);
      if (!product) return res.status(404).send('Product not found');
      const photos = product.get('photos') || [];
      const photo = photos.find(p => p.fileName === fileName);
      if (!photo || !photo.url) return res.status(404).send('Photo not found');
      res.redirect(photo.url);
    } catch (error) {
      logger.error('[ProductPhoto] Serve photo error:', error);
      res.status(500).send('Error serving photo');
    }
  });

  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/webhooks/')) {
      return res.sendStatus(404);
    }

    if (!fs.existsSync(indexPath)) {
      return res.status(503).json({
        success: false,
        error: 'Application is starting. Please refresh in a moment.',
      });
    }

    res.sendFile(indexPath, (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ success: false, error: 'Error serving application' });
      }
    });
  });

  // Error handling
  app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
  });

  logger.info('All routes registered');
}

// ============================================
// Database connection (non-blocking)
// ============================================

async function connectDatabaseAsync() {
  try {
    const { connectDatabase } = require('./config/database');
    await connectDatabase();
    logger.info('Database connection established');
  } catch (error) {
    logger.error('Failed to connect to database:', error.message);
    logger.warn('Server running without database - set MONGO_URI in Azure Configuration');
  }
}

// ============================================
// Global error handlers
// ============================================

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
    // Force close after 10s
    setTimeout(() => process.exit(1), 10000);
  }
});
