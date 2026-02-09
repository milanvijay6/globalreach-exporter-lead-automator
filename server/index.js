const express = require('express');
require("dotenv").config();
const path = require('path');
const fs = require('fs');
const compression = require('compression');
const brotliCompression = require('./middleware/brotli');
const etagMiddleware = require('./middleware/etag');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { paginationMiddleware } = require('./middleware/pagination');
const crypto = require('crypto');
const winston = require('winston');

// Logger setup - optimized for production
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? (process.env.LOG_LEVEL || 'warn') : (process.env.LOG_LEVEL || 'info'),
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' 
        ? winston.format.simple() 
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
      handleExceptions: true,
      handleRejections: true
    })
  ]
});

// Initialize Azure Application Insights (for monitoring in production)
const { initializeApplicationInsights } = require('./config/applicationInsights');
initializeApplicationInsights();

// Initialize MongoDB Database Connection
const { connectDatabase, healthCheck } = require('./config/database');
let databaseInitialized = false;

// Connect to database on startup (non-blocking)
(async () => {
  try {
    await connectDatabase();
    databaseInitialized = true;
    if (process.env.NODE_ENV !== 'production' || process.env.LOG_LEVEL === 'debug') {
      logger.info('[Server] ✅ Database connection established');
    }
  } catch (error) {
    logger.error('[Server] ❌ Failed to connect to database:', error.message);
    if (process.env.NODE_ENV !== 'production') {
      logger.warn('[Server] Server will start but database features will not work');
      logger.warn('[Server] Set MONGO_URI in Azure Web App Configuration');
    }
  }
})();

const app = express();
let server;  // Declare server variable globally
const PORT = process.env.PORT || 8080;  // PORT defined BEFORE server startup

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for React
  crossOriginEmbedderPolicy: false
}));

// Rate limiting (skip health checks used by Azure load balancer)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
});

app.use(limiter);

// Compression - Brotli with gzip fallback
app.use(brotliCompression);
app.use(compression({
  filter: (req, res) => {
    const accepts = req.headers['accept-encoding'] || '';
    if (accepts.includes('br')) {
      return false; // Let Brotli handle it
    }
    return compression.filter(req, res);
  },
  threshold: 1024,
}));

// ETag middleware for conditional requests (before routes)
app.use(etagMiddleware);

// Pagination validation middleware (before routes)
app.use(paginationMiddleware);

// MessagePack compression middleware (before routes, after body parsing)
const { msgpackMiddleware } = require('./middleware/msgpack');
app.use(msgpackMiddleware);

// HTTP/2 Server Push middleware (before static file serving)
const { http2PushMiddleware } = require('./middleware/http2Push');
app.use(http2PushMiddleware);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS for web app
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Import routes with error handling
let webhookRoutes, productRoutes, integrationRoutes, leadRoutes, messageRoutes, livequeryRoutes, oauthRoutes, configRoutes, cloudflareWorkerRoutes, cloudflarePagesRoutes, aiJobsRoutes, aiRoutes, trpcRoutes, bundleRoutes, syncRoutes, pushNotificationRoutes;

try {
  webhookRoutes = require('./routes/webhooks');
  productRoutes = require('./routes/products');
  integrationRoutes = require('./routes/integrations');
  leadRoutes = require('./routes/leads');
  messageRoutes = require('./routes/messages');
  livequeryRoutes = require('./routes/livequery');
  oauthRoutes = require('./routes/oauth');
  configRoutes = require('./routes/config');
  cloudflareWorkerRoutes = require('./routes/cloudflare-worker');
  cloudflarePagesRoutes = require('./routes/cloudflare-pages');
  aiJobsRoutes = require('./routes/aiJobs');
  aiRoutes = require('./routes/ai');
  trpcRoutes = require('./routes/trpc');
  bundleRoutes = require('./routes/bundle');
  syncRoutes = require('./routes/sync');
  pushNotificationRoutes = require('./routes/pushNotifications');
  logger.info('[Server] All routes loaded successfully');
} catch (error) {
  logger.error('[Server] Failed to load routes:', error);
  const express = require('express');
  const emptyRouter = express.Router();
  webhookRoutes = webhookRoutes || emptyRouter;
  productRoutes = productRoutes || emptyRouter;
  integrationRoutes = integrationRoutes || emptyRouter;
  leadRoutes = leadRoutes || emptyRouter;
  messageRoutes = messageRoutes || emptyRouter;
  livequeryRoutes = livequeryRoutes || emptyRouter;
  oauthRoutes = oauthRoutes || emptyRouter;
  configRoutes = configRoutes || emptyRouter;
  cloudflareWorkerRoutes = cloudflareWorkerRoutes || emptyRouter;
  cloudflarePagesRoutes = cloudflarePagesRoutes || emptyRouter;
  aiJobsRoutes = aiJobsRoutes || emptyRouter;
  aiRoutes = aiRoutes || emptyRouter;
  trpcRoutes = trpcRoutes || emptyRouter;
  bundleRoutes = bundleRoutes || emptyRouter;
  syncRoutes = syncRoutes || emptyRouter;
  pushNotificationRoutes = pushNotificationRoutes || emptyRouter;
}

// Health check endpoint (for Azure Load Balancer and monitoring)
app.get('/health', async (req, res) => {
  const dbHealth = await healthCheck();
  res.status(dbHealth.status === 'ok' ? 200 : 503).json({ 
    status: dbHealth.status === 'ok' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: dbHealth,
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API Routes
app.use('/webhooks', webhookRoutes);
app.use('/api/products', productRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/livequery', livequeryRoutes);
app.use('/api/oauth', oauthRoutes);
app.use('/api/config', configRoutes);
app.use('/api/cloudflare-worker', cloudflareWorkerRoutes);
app.use('/api/cloudflare-pages', cloudflarePagesRoutes);
app.use('/api/ai/jobs', aiJobsRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/trpc', trpcRoutes);
app.use('/api/bundle', bundleRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/push-notifications', pushNotificationRoutes);

// Serve static files from build directory
const buildPath = path.resolve(__dirname, '..', 'build');
const indexPath = path.resolve(buildPath, 'index.html');

// Verify build directory exists on startup
if (!fs.existsSync(indexPath)) {
  logger.warn(`[Server] Warning: Build directory not found at ${buildPath}`);
  logger.warn(`[Server] Index.html not found at ${indexPath}`);
  logger.warn(`[Server] Static file serving may fail. Ensure the application is built correctly.`);
} else {
  logger.info(`[Server] Build directory found at ${buildPath}`);
  logger.info(`[Server] Index.html found at ${indexPath}`);
}

app.use(express.static(buildPath));

// Serve product photos
app.get('/api/product-photos/:productId/:fileName', async (req, res) => {
  try {
    const { productId, fileName } = req.params;
    const Product = require('./models/Product');
    
    const product = await Product.get(productId);
    
    if (!product) {
      return res.status(404).send('Product not found');
    }
    
    const photos = product.get('photos') || [];
    const photo = photos.find(p => p.fileName === fileName);
    
    if (!photo || !photo.url) {
      return res.status(404).send('Photo not found');
    }
    
    res.redirect(photo.url);
  } catch (error) {
    logger.error('[ProductPhoto] Serve photo error:', error);
    res.status(500).send('Error serving photo');
  }
});

// React Router fallback - serve index.html for all non-API routes
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/webhooks/')) {
    return res.sendStatus(404);
  }
  
  if (!fs.existsSync(indexPath)) {
    logger.error(`[Server] Cannot serve index.html: File not found at ${indexPath}`);
    return res.status(500).json({ 
      success: false, 
      error: 'Frontend build not found. Please ensure the application is built correctly.' 
    });
  }
  
  res.sendFile(indexPath, (err) => {
    if (err) {
      logger.error(`[Server] Error serving index.html:`, err);
      if (!res.headersSent) {
        res.status(500).json({ 
          success: false, 
          error: 'Error serving frontend application' 
        });
      }
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  if (!res.headersSent) {
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
});

// Global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server first for faster cold starts
if (process.env.NODE_ENV !== 'production' || process.env.LOG_LEVEL === 'debug') {
  logger.info(`[Server] Starting server on port ${PORT}...`);
}

server = app.listen(PORT, '0.0.0.0', () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Server running on port ${PORT}`);
  }
  logger.info(`[Server] ✓ Server started on port ${PORT}`);
  if (process.env.NODE_ENV !== 'production' || process.env.LOG_LEVEL === 'debug') {
    logger.info(`[Server] ✓ Health check: http://0.0.0.0:${PORT}/health`);
    logger.info(`[Server] ✓ Root endpoint: http://0.0.0.0:${PORT}/`);
  }
  
  // Signal that server is ready
  if (process.send) {
    process.send('ready');
  }
  
  // Lazy load workers and jobs after server starts (non-blocking)
  setImmediate(() => {
    // Initialize scheduled jobs (lazy loaded)
    if (process.env.ENABLE_SCHEDULED_JOBS !== 'false') {
      try {
        const { startScheduler } = require('./jobs/scheduler');
        startScheduler();
        if (process.env.NODE_ENV !== 'production' || process.env.LOG_LEVEL === 'debug') {
          logger.info('[Server] ✅ Scheduled jobs started');
        }
      } catch (error) {
        logger.warn('[Server] ⚠️  Scheduled jobs not available:', error.message);
        logger.warn('[Server] Set ENABLE_SCHEDULED_JOBS=false to disable scheduled jobs');
      }
    } else {
      if (process.env.NODE_ENV !== 'production' || process.env.LOG_LEVEL === 'debug') {
        logger.info('[Server] Scheduled jobs disabled (ENABLE_SCHEDULED_JOBS=false)');
      }
    }

    // Initialize AI processing workers (lazy loaded)
    if (process.env.ENABLE_AI_WORKERS !== 'false') {
      try {
        require('./workers/aiProcessingWorker');
        if (process.env.NODE_ENV !== 'production' || process.env.LOG_LEVEL === 'debug') {
          logger.info('[Server] ✅ AI processing workers started');
        }
      } catch (error) {
        logger.warn('[Server] ⚠️  AI processing workers not available:', error.message);
        logger.warn('[Server] Set ENABLE_AI_WORKERS=false to disable AI workers');
      }
    } else {
      if (process.env.NODE_ENV !== 'production' || process.env.LOG_LEVEL === 'debug') {
        logger.info('[Server] AI processing workers disabled (ENABLE_AI_WORKERS=false)');
      }
    }

    // Initialize WebSocket server (lazy loaded)
    if (process.env.ENABLE_WEBSOCKET !== 'false') {
      try {
        const { initializeWebSocketServer } = require('./websocket/server');
        initializeWebSocketServer(server);
        if (process.env.NODE_ENV !== 'production' || process.env.LOG_LEVEL === 'debug') {
          logger.info('[Server] ✅ WebSocket server initialized');
        }
      } catch (error) {
        logger.warn('[Server] ⚠️  WebSocket server not available:', error.message);
      }
    } else {
      if (process.env.NODE_ENV !== 'production' || process.env.LOG_LEVEL === 'debug') {
        logger.info('[Server] WebSocket server disabled (ENABLE_WEBSOCKET=false)');
      }
    }
  });
});

// Handle server errors
server.on('error', (error) => {
  if (error.syscall !== 'listen') {
    throw error;
  }
  
  switch (error.code) {
    case 'EACCES':
      logger.error(`Port ${PORT} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      logger.error(`Port ${PORT} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
});

// Cloudflare Worker auto-deployment (only in production with proper credentials)
if (process.env.NODE_ENV === 'production' && 
    process.env.CLOUDFLARE_API_TOKEN && 
    process.env.ENABLE_AUTO_WORKER_DEPLOY === 'true') {
  
  setImmediate(async () => {
    try {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const Config = require('./models/Config');
      const existingWorkerUrl = await Config.get('cloudflareWorkerUrl', null);

      if (!existingWorkerUrl) {
        logger.info('[Server] Cloudflare Worker URL not found. Attempting auto-deployment...');
        const { deployWorker } = require('../scripts/deploy-cloudflare-worker');
        const workerUrl = await deployWorker();
        if (workerUrl) {
          logger.info(`[Server] Cloudflare Worker auto-deployed: ${workerUrl}`);
        } else {
          logger.warn('[Server] Cloudflare Worker auto-deployment skipped (no credentials or deployment failed)');
        }
      } else {
        logger.info(`[Server] Cloudflare Worker URL found: ${existingWorkerUrl}`);
      }
    } catch (error) {
      logger.error('[Server] Cloudflare Worker auto-deployment error:', error.message);
      if (error.stack) {
        logger.error('[Server] Stack:', error.stack);
      }
    }
  });
}

