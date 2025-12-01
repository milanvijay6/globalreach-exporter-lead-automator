const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const auth = require('basic-auth');

// Initialize Parse
require('./config/parse');

// Import routes
const webhookRoutes = require('./routes/webhooks');
const productRoutes = require('./routes/products');
const integrationRoutes = require('./routes/integrations');
const leadRoutes = require('./routes/leads');
const oauthRoutes = require('./routes/oauth');
const configRoutes = require('./routes/config');

const app = express();
const PORT = process.env.PORT || 4000;

// Security: Basic Auth (Protect the CRM if hosted publicly)
const USER = process.env.BASIC_AUTH_USER;
const PASS = process.env.BASIC_AUTH_PASS;

if (USER && PASS) {
  app.use((req, res, next) => {
    // Allow webhooks to bypass auth so Meta/WeChat can reach them
    if (req.path.startsWith('/webhooks/')) return next();
    // Allow OAuth callbacks
    if (req.path.startsWith('/api/oauth/')) return next();
    // Allow health check
    if (req.path === '/api/health') return next();

    const user = auth(req);
    if (!user || user.name !== USER || user.pass !== PASS) {
      res.set('WWW-Authenticate', 'Basic realm="GlobalReach CRM"');
      return res.status(401).send('Access denied.');
    }
    next();
  });
}

// Security: Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Security: Enhanced Helmet configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true,
}));

// Middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security: Input validation middleware
app.use((req, res, next) => {
  // Basic XSS protection
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      return obj.replace(/<script[^>]*>.*?<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '');
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const key in obj) {
        sanitized[key] = sanitize(obj[key]);
      }
      return sanitized;
    }
    return obj;
  };
  
  if (req.body) {
    req.body = sanitize(req.body);
  }
  if (req.query) {
    req.query = sanitize(req.query);
  }
  
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.2'
  });
});

// API Routes
app.use('/webhooks', webhookRoutes);
app.use('/api/products', productRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/oauth', oauthRoutes);
app.use('/api/config', configRoutes);

// Serve Static Assets (in production)
// Check both root build and electron/build for compatibility
const fs = require('fs');
const rootBuildPath = path.join(__dirname, '..', 'build');
const electronBuildPath = path.join(__dirname, '..', 'electron', 'build');
const buildPath = fs.existsSync(rootBuildPath) ? rootBuildPath : electronBuildPath;
const indexPath = path.join(buildPath, 'index.html');
const isDev = !fs.existsSync(buildPath) || !fs.existsSync(indexPath) || process.env.NODE_ENV === 'development';

if (!isDev && fs.existsSync(buildPath) && fs.existsSync(indexPath)) {
  console.log(`Production mode: Serving static files from: ${buildPath}`);
  app.use(express.static(buildPath, {
    maxAge: '1y',
    etag: true,
  }));
}

// SPA Fallback - serve index.html for all non-API routes
app.get('*', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  
  if (req.path.startsWith('/webhooks/')) {
    return res.sendStatus(404);
  }
  
  // Only serve index.html in production mode when build exists
  if (!isDev && fs.existsSync(buildPath) && fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // Development mode: Don't serve fallback, Vite dev server handles routing
    res.sendStatus(404);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
// Back4App requires binding to 0.0.0.0
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`🚀 GlobalReach Server running on ${HOST}:${PORT}`);
  console.log(`📁 Serving files from: ${buildPath}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Health check: http://${HOST}:${PORT}/api/health`);
  console.log(`🔗 Parse Server: ${process.env.PARSE_SERVER_URL || 'Not configured'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

