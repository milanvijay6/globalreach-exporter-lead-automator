const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const winston = require('winston');
const Parse = require('parse/node');

// Initialize Parse
require('./config/parse');

const app = express();
const PORT = process.env.PORT || 4000;

// Logger setup
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

// Import routes
const webhookRoutes = require('./routes/webhooks');
const productRoutes = require('./routes/products');
const integrationRoutes = require('./routes/integrations');
const leadRoutes = require('./routes/leads');
const oauthRoutes = require('./routes/oauth');
const configRoutes = require('./routes/config');
const cloudflareWorkerRoutes = require('./routes/cloudflare-worker');

// API Routes
app.use('/webhooks', webhookRoutes);
app.use('/api/products', productRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/oauth', oauthRoutes);
app.use('/api/config', configRoutes);
app.use('/api/cloudflare-worker', cloudflareWorkerRoutes);

// Serve static files from build directory
const buildPath = path.join(__dirname, '..', 'build');
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
app.get('*', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api/') || req.path.startsWith('/webhooks/')) {
    return res.sendStatus(404);
  }
  
  const indexPath = path.join(buildPath, 'index.html');
  res.sendFile(indexPath);
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
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




