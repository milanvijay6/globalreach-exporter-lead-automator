const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const auth = require('basic-auth');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 4000;

// Security: Basic Auth (Protect the CRM if hosted publicly)
const USER = process.env.BASIC_AUTH_USER;
const PASS = process.env.BASIC_AUTH_PASS;

if (USER && PASS) {
  app.use((req, res, next) => {
    // Allow webhooks to bypass auth so Meta/WeChat can reach them
    if (req.path.startsWith('/webhooks/')) return next();

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

// Serve Static Assets
app.use(express.static(path.join(__dirname, 'build')));

// --- WEBHOOKS (Production) ---
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || 'globalreach_secret_token';

// 1. WhatsApp Verification
app.get('/webhooks/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === WEBHOOK_TOKEN) {
      console.log('WhatsApp Webhook Verified');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// 2. WhatsApp Incoming
app.post('/webhooks/whatsapp', (req, res) => {
  console.log('WhatsApp Payload Received');
  // In a real hosted app with a DB, you would save this message to the database here.
  // Since this is a static-file backed React app, real-time updates via Webhook 
  // require WebSockets (Socket.io) which adds complexity.
  // For now, we log it.
  res.sendStatus(200);
});

// 3. WeChat Verification
app.get('/webhooks/wechat', (req, res) => {
  const signature = req.query.signature;
  const timestamp = req.query.timestamp;
  const nonce = req.query.nonce;
  const echostr = req.query.echostr;

  if (!signature || !timestamp || !nonce) return res.sendStatus(400);

  const tmpStr = [WEBHOOK_TOKEN, timestamp, nonce].sort().join('');
  const sha1 = crypto.createHash('sha1').update(tmpStr).digest('hex');

  if (sha1 === signature) {
    console.log('WeChat Webhook Verified');
    res.send(echostr);
  } else {
    res.sendStatus(403);
  }
});

// 4. WeChat Incoming
app.post('/webhooks/wechat', (req, res) => {
  console.log('WeChat Payload Received');
  res.sendStatus(200);
});

// SPA Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Production server running on port ${PORT}`);
});