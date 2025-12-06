const express = require('express');
const path = require('path');
const fs = require('fs');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const winston = require('winston');
const Parse = require('parse/node');

// Logger setup (must be before Parse initialization to log errors)
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
      handleExceptions: true,
      handleRejections: true
    })
  ]
});

// Initialize Parse with error handling
let parseInitialized = false;
try {
  const parseConfig = require('./config/parse');
  parseInitialized = parseConfig.isInitialized || false;
  
  // Verify Parse is initialized (check for valid non-empty applicationId)
  if (parseInitialized && Parse.applicationId && Parse.applicationId.trim() !== '') {
    logger.info('[Server] ✅ Parse initialized successfully');
    logger.info(`[Server] Parse Application ID: ${Parse.applicationId.substring(0, 8)}...`);
    logger.info(`[Server] Parse Server URL: ${Parse.serverURL}`);
    logger.info(`[Server] Parse Master Key: ${Parse.masterKey ? 'Set' : 'Not set (optional)'}`);
  } else {
    logger.warn('[Server] ⚠️  Parse not initialized');
    logger.warn('[Server] Parse-dependent features (Config API, etc.) will return default values');
    logger.warn('[Server]');
    logger.warn('[Server] To enable Parse features:');
    logger.warn('[Server]   1. Go to Back4App Dashboard → Your App → App Settings → Environment Variables');
    logger.warn('[Server]   2. Add the following environment variables:');
    logger.warn('[Server]      - PARSE_APPLICATION_ID (required)');
    logger.warn('[Server]      - PARSE_MASTER_KEY (recommended for server-side operations)');
    logger.warn('[Server]      - PARSE_JAVASCRIPT_KEY (optional)');
    logger.warn('[Server]      - PARSE_SERVER_URL (optional, defaults to https://parseapi.back4app.com/)');
    logger.warn('[Server]   3. Restart your Back4App server');
    logger.warn('[Server]');
  }
} catch (error) {
  logger.error('[Server] ❌ Failed to initialize Parse:', error);
  logger.error('[Server] Stack:', error.stack);
  logger.warn('[Server] Server will continue to start, but Parse-dependent features will not work');
  // Continue anyway - some features may not work, but server should still start
}

const app = express();
const PORT = process.env.PORT || 4000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for React
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Compression
app.use(compression());

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
let webhookRoutes, productRoutes, integrationRoutes, leadRoutes, oauthRoutes, configRoutes, cloudflareWorkerRoutes, cloudflarePagesRoutes;

try {
  webhookRoutes = require('./routes/webhooks');
  productRoutes = require('./routes/products');
  integrationRoutes = require('./routes/integrations');
  leadRoutes = require('./routes/leads');
  oauthRoutes = require('./routes/oauth');
  configRoutes = require('./routes/config');
  cloudflareWorkerRoutes = require('./routes/cloudflare-worker');
  cloudflarePagesRoutes = require('./routes/cloudflare-pages');
  logger.info('[Server] All routes loaded successfully');
} catch (error) {
  logger.error('[Server] Failed to load routes:', error);
  // Create empty router as fallback
  const express = require('express');
  const emptyRouter = express.Router();
  webhookRoutes = webhookRoutes || emptyRouter;
  productRoutes = productRoutes || emptyRouter;
  integrationRoutes = integrationRoutes || emptyRouter;
  leadRoutes = leadRoutes || emptyRouter;
  oauthRoutes = oauthRoutes || emptyRouter;
  configRoutes = configRoutes || emptyRouter;
  cloudflareWorkerRoutes = cloudflareWorkerRoutes || emptyRouter;
  cloudflarePagesRoutes = cloudflarePagesRoutes || emptyRouter;
}

// Health check endpoint (for Back4App and load balancers)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/webhooks', webhookRoutes);
app.use('/api/products', productRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/oauth', oauthRoutes);
app.use('/api/config', configRoutes);
app.use('/api/cloudflare-worker', cloudflareWorkerRoutes);
app.use('/api/cloudflare-pages', cloudflarePagesRoutes);

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
    const Product = Parse.Object.extend('Product');
    const query = new Parse.Query(Product);
    query.equalTo('objectId', productId);
    const product = await query.first({ useMasterKey: true });
    
    if (!product) {
      return res.status(404).send('Product not found');
    }
    
    const photos = product.get('photos') || [];
    const photo = photos.find(p => p.fileName === fileName);
    
    if (!photo || !photo.url) {
      return res.status(404).send('Photo not found');
    }
    
    // Redirect to Parse file URL
    res.redirect(photo.url);
  } catch (error) {
    logger.error('[ProductPhoto] Serve photo error:', error);
    res.status(500).send('Error serving photo');
  }
});

// React Router fallback - serve index.html for all non-API routes
app.get('*', (req, res, next) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api/') || req.path.startsWith('/webhooks/')) {
    return res.sendStatus(404);
  }
  
  // Check if file exists before serving
  if (!fs.existsSync(indexPath)) {
    logger.error(`[Server] Cannot serve index.html: File not found at ${indexPath}`);
    return res.status(500).json({ 
      success: false, 
      error: 'Frontend build not found. Please ensure the application is built correctly.' 
    });
  }
  
  // Use absolute path with error handling
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
  // Don't exit - let the server continue running
  // In production, you might want to exit and let a process manager restart it
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - let the server continue running
});

// Start server
let server;
try {
  // Log startup attempt
  logger.info(`[Server] Starting server on port ${PORT}...`);
  logger.info(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
  
  server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`[Server] ✓ Server successfully started on port ${PORT}`);
    logger.info(`[Server] ✓ Health check available at: http://0.0.0.0:${PORT}/health`);
    logger.info(`[Server] ✓ Root endpoint available at: http://0.0.0.0:${PORT}/`);
    
    // Signal that server is ready
    if (process.send) {
      process.send('ready');
    }
    
    // Note: Cloudflare Worker auto-deployment is disabled on startup to prevent deployment failures
    // Use the API endpoint POST /api/cloudflare-worker/deploy to deploy manually
    // Auto-deployment can be enabled by setting ENABLE_AUTO_WORKER_DEPLOY=true
    if (process.env.NODE_ENV === 'production' && 
        process.env.CLOUDFLARE_API_TOKEN && 
        process.env.ENABLE_AUTO_WORKER_DEPLOY === 'true') {
      // Use setImmediate to ensure server is fully started before attempting deployment
      setImmediate(async () => {
        try {
          // Add a small delay to ensure Parse is fully initialized
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
          // Log error but don't crash the server
          logger.error('[Server] Cloudflare Worker auto-deployment error:', error.message);
          if (error.stack) {
            logger.error('[Server] Stack:', error.stack);
          }
          // Continue server operation even if worker deployment fails
        }
      });
    }
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
} catch (error) {
  logger.error('Failed to start server:', error);
  process.exit(1);
}




