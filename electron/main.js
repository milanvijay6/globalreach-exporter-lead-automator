const { app, BrowserWindow, ipcMain, safeStorage, shell, dialog, Menu } = require('electron');
const path = require('path');
const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const winston = require('winston');
const { autoUpdater } = require('electron-updater');

// --- CONFIGURATION ---
const DEFAULT_PORT = 4000;
const CONFIG_FILE_NAME = 'config.json';

// Encryption key configuration - use environment variables in production
// WARNING: In production, set ENCRYPTION_KEY_SECRET and ENCRYPTION_KEY_SALT environment variables for security
const ENCRYPTION_SECRET = process.env.ENCRYPTION_KEY_SECRET || 'shreenathji_secret';
const ENCRYPTION_SALT = process.env.ENCRYPTION_KEY_SALT || 'salt';

// --- LOGGER SETUP ---
const logDir = path.join(app.getPath('userData'), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(logDir, 'combined.log') }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
});

// Generate encryption key after logger is initialized
const BACKUP_ENCRYPTION_KEY = crypto.scryptSync(ENCRYPTION_SECRET, ENCRYPTION_SALT, 32);

// Warn if using default encryption key in production
if (process.env.NODE_ENV === 'production' && (!process.env.ENCRYPTION_KEY_SECRET || !process.env.ENCRYPTION_KEY_SALT)) {
  logger.warn('[Config] WARNING: Using default encryption key. Set ENCRYPTION_KEY_SECRET and ENCRYPTION_KEY_SALT environment variables for production security.');
}

// --- SIMPLE CONFIG STORE ---
const configPath = path.join(app.getPath('userData'), CONFIG_FILE_NAME);

function getConfig(key, defaultValue) {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      const json = JSON.parse(data);
      return json[key] !== undefined ? json[key] : defaultValue;
    }
  } catch (err) {
    logger.error('Error reading config', err);
  }
  return defaultValue;
}

function setConfig(key, value) {
  try {
    let json = {};
    if (fs.existsSync(configPath)) {
      json = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    json[key] = value;
    fs.writeFileSync(configPath, JSON.stringify(json, null, 2));
    return true;
  } catch (err) {
    logger.error('Error writing config', err);
    return false;
  }
}

// --- EXPRESS SERVER ---
let serverInstance;

function startServer(startingPort) {
  const appServer = express();
  
  // Get network binding configuration
  const networkBinding = getConfig('networkBinding', '0.0.0.0'); // Default to all interfaces
  
  // Middleware
  appServer.use(express.json());
  appServer.use(express.urlencoded({ extended: true }));
  // WeChat uses XML, so we need to handle text/xml separately in the route

  // Static Files (only in production mode when build exists with index.html)
  // This points to 'electron/build'
  const buildPath = path.join(__dirname, 'build');
  const indexPath = path.join(buildPath, 'index.html');
  // Only consider it production if build directory AND index.html both exist
  const isDev = !fs.existsSync(buildPath) || !fs.existsSync(indexPath) || process.env.NODE_ENV === 'development';
  
  if (!isDev && fs.existsSync(buildPath) && fs.existsSync(indexPath)) {
    // Production: Serve static files from build directory
    logger.info(`Production mode: Serving static files from: ${buildPath}`);
    appServer.use(express.static(buildPath));
  } else {
    // Development: Don't serve static files, Vite dev server handles that
    logger.info(`Development mode: Static files will be served by Vite dev server`);
  }

  // Webhook Routes
  // WhatsApp Webhook Verification (GET)
  appServer.get('/webhooks/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const verifyToken = getConfig('webhookVerifyToken', 'globalreach_secret_token');
    
    if (mode === 'subscribe' && token === verifyToken) {
      logger.info('WhatsApp webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      logger.warn('WhatsApp webhook verification failed', { mode, token });
      res.sendStatus(403);
    }
  });

  // WhatsApp Webhook Handler (POST)
  appServer.post('/webhooks/whatsapp', (req, res) => {
    logger.info('WhatsApp webhook received', { body: JSON.stringify(req.body).substring(0, 200) });
    
    try {
      const payload = req.body;
      
      // Verify it's a WhatsApp webhook
      if (payload.object !== 'whatsapp_business_account') {
        logger.warn('Invalid webhook object type', payload.object);
        return res.sendStatus(400);
      }

      // Forward to renderer if window exists
      if (mainWindow) {
        mainWindow.webContents.send('webhook-payload', { 
          channel: 'WhatsApp', 
          payload: payload, 
          timestamp: Date.now() 
        });
      }
      
      res.sendStatus(200);
    } catch (err) {
      logger.error('Error processing WhatsApp webhook', err);
      res.sendStatus(500);
    }
  });

  // WeChat Webhook Verification (GET)
  appServer.get('/webhooks/wechat', (req, res) => {
    const signature = req.query.signature;
    const timestamp = req.query.timestamp;
    const nonce = req.query.nonce;
    const echostr = req.query.echostr;
    const webhookToken = getConfig('webhookVerifyToken', 'globalreach_secret_token');

    if (!signature || !timestamp || !nonce || !echostr) {
      logger.warn('WeChat webhook verification failed: Missing parameters');
      return res.sendStatus(400);
    }

    // WeChat signature algorithm: SHA1(token + timestamp + nonce) sorted
    const tmpStr = [webhookToken, timestamp, nonce].sort().join('');
    const sha1 = crypto.createHash('sha1').update(tmpStr).digest('hex');

    if (sha1 === signature) {
      logger.info('WeChat webhook verified successfully');
      res.send(echostr);
    } else {
      logger.warn('WeChat webhook verification failed: Invalid signature', { 
        received: signature, 
        expected: sha1 
      });
      res.sendStatus(403);
    }
  });

  // WeChat Webhook Handler (POST)
  appServer.post('/webhooks/wechat', express.text({ type: 'application/xml', limit: '10mb' }), (req, res) => {
    logger.info('WeChat webhook received', { body: req.body?.substring(0, 200) });
    
    try {
      const xmlPayload = req.body;
      
      if (!xmlPayload) {
        logger.warn('WeChat webhook: Empty payload');
        return res.sendStatus(400);
      }

      // Verify signature (optional but recommended for security)
      const signature = req.query.signature;
      const timestamp = req.query.timestamp;
      const nonce = req.query.nonce;
      const webhookToken = getConfig('webhookVerifyToken', 'globalreach_secret_token');

      if (signature && timestamp && nonce) {
        const tmpStr = [webhookToken, timestamp, nonce].sort().join('');
        const sha1 = crypto.createHash('sha1').update(tmpStr).digest('hex');
        
        if (sha1 !== signature) {
          logger.warn('WeChat webhook: Invalid signature', { received: signature, expected: sha1 });
          return res.sendStatus(403);
        }
      }

      // Forward to renderer if window exists
      if (mainWindow) {
        mainWindow.webContents.send('webhook-payload', { 
          channel: 'WeChat', 
          payload: xmlPayload, 
          timestamp: Date.now() 
        });
      }
      
      // WeChat expects a response (can be empty or echo)
      res.type('application/xml');
      res.send('<xml><return_code><![CDATA[SUCCESS]]></return_code></xml>');
    } catch (err) {
      logger.error('Error processing WeChat webhook', err);
      res.sendStatus(500);
    }
  });

  // OAuth Callback Routes
  appServer.get('/auth/oauth/callback', async (req, res) => {
    try {
      const { code, state, error } = req.query;
      
      if (error) {
        logger.error('OAuth callback error:', error);
        if (mainWindow) {
          mainWindow.webContents.send('oauth-callback', {
            success: false,
            error: error,
            provider: null,
          });
        }
        return res.send(`
          <html>
            <body>
              <h2>Authentication Failed</h2>
              <p>Error: ${error}</p>
              <p>You can close this window and try again.</p>
              <script>setTimeout(() => window.close(), 3000);</script>
            </body>
          </html>
        `);
      }

      if (!code || !state) {
        logger.warn('OAuth callback missing code or state');
        return res.send(`
          <html>
            <body>
              <h2>Authentication Error</h2>
              <p>Missing authorization code or state parameter.</p>
              <p>You can close this window and try again.</p>
              <script>setTimeout(() => window.close(), 3000);</script>
            </body>
          </html>
        `);
      }

      logger.info('OAuth callback received', { hasCode: !!code, hasState: !!state });

      // Parse state to determine provider
      let provider = 'gmail';
      try {
        const stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
        provider = stateData.provider || 'gmail';
      } catch {
        // Default to gmail if state parsing fails
      }

      // Send to renderer process
      if (mainWindow) {
        mainWindow.webContents.send('oauth-callback', {
          success: true,
          code: code,
          state: state,
          provider: provider,
        });
      }

      res.send(`
        <html>
          <body>
            <h2>Authentication Successful</h2>
            <p>You can close this window and return to the application.</p>
            <script>setTimeout(() => window.close(), 2000);</script>
          </body>
        </html>
      `);
    } catch (err) {
      logger.error('OAuth callback handler error:', err);
      res.send(`
        <html>
          <body>
            <h2>Authentication Error</h2>
            <p>An error occurred processing the authentication.</p>
            <p>You can close this window and try again.</p>
            <script>setTimeout(() => window.close(), 3000);</script>
          </body>
        </html>
      `);
    }
  });

  // Magic Link Callback Route
  appServer.get('/auth/magic-link/callback', async (req, res) => {
    try {
      const { token, email } = req.query;
      
      if (!token) {
        logger.warn('Magic link callback missing token');
        return res.send(`
          <html>
            <body>
              <h2>Invalid Link</h2>
              <p>Missing authentication token.</p>
              <p>You can close this window.</p>
              <script>setTimeout(() => window.close(), 3000);</script>
            </body>
          </html>
        `);
      }

      logger.info('Magic link callback received', { hasToken: !!token, email });

      // Send to renderer process
      if (mainWindow) {
        mainWindow.webContents.send('magic-link-callback', {
          token: token,
          email: email,
        });
      }

      res.send(`
        <html>
          <body>
            <h2>Processing Authentication</h2>
            <p>Please return to the application.</p>
            <script>setTimeout(() => window.close(), 2000);</script>
          </body>
        </html>
      `);
    } catch (err) {
      logger.error('Magic link callback handler error:', err);
      res.send(`
        <html>
          <body>
            <h2>Authentication Error</h2>
            <p>An error occurred processing the magic link.</p>
            <p>You can close this window and try again.</p>
            <script>setTimeout(() => window.close(), 3000);</script>
          </body>
        </html>
      `);
    }
  });

  // Fallback for React Router (only in production mode)
  // Product API Endpoints
  // GET /api/products - List products with optional filters
  appServer.get('/api/products', async (req, res) => {
    try {
      const { category, search, tags, status, limit = 50, offset = 0 } = req.query;
      
      // Forward request to renderer via IPC
      if (mainWindow) {
        mainWindow.webContents.send('api-request', {
          type: 'get-products',
          params: { category, search, tags, status, limit: parseInt(limit), offset: parseInt(offset) },
          requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        });
        
        // Wait for response (with timeout)
        return new Promise((resolve) => {
          const timeout = setTimeout(() => {
            ipcMain.removeAllListeners('api-response');
            res.status(500).json({ success: false, error: 'Request timeout' });
            resolve();
          }, 10000);
          
          ipcMain.once('api-response', (event, { requestId, success, data, error }) => {
            clearTimeout(timeout);
            if (success) {
              res.json({ success: true, data, total: data.length, limit: parseInt(limit), offset: parseInt(offset) });
            } else {
              res.status(500).json({ success: false, error });
            }
            resolve();
          });
        });
      } else {
        res.status(503).json({ success: false, error: 'Application not ready' });
      }
    } catch (error) {
      logger.error('[API] Error in GET /api/products:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/products/:id - Get single product
  appServer.get('/api/products/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      if (mainWindow) {
        mainWindow.webContents.send('api-request', {
          type: 'get-product',
          params: { id },
          requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        });
        
        return new Promise((resolve) => {
          const timeout = setTimeout(() => {
            ipcMain.removeAllListeners('api-response');
            res.status(500).json({ success: false, error: 'Request timeout' });
            resolve();
          }, 10000);
          
          ipcMain.once('api-response', (event, { requestId, success, data, error }) => {
            clearTimeout(timeout);
            if (success) {
              res.json({ success: true, data });
            } else {
              res.status(404).json({ success: false, error });
            }
            resolve();
          });
        });
      } else {
        res.status(503).json({ success: false, error: 'Application not ready' });
      }
    } catch (error) {
      logger.error('[API] Error in GET /api/products/:id:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/products/recommended - Get product recommendations for customer
  appServer.get('/api/products/recommended', async (req, res) => {
    try {
      const { customerId, context, limit = 10 } = req.query;
      
      if (mainWindow) {
        mainWindow.webContents.send('api-request', {
          type: 'get-recommended-products',
          params: { customerId, context, limit: parseInt(limit) },
          requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        });
        
        return new Promise((resolve) => {
          const timeout = setTimeout(() => {
            ipcMain.removeAllListeners('api-response');
            res.status(500).json({ success: false, error: 'Request timeout' });
            resolve();
          }, 10000);
          
          ipcMain.once('api-response', (event, { requestId, success, data, error }) => {
            clearTimeout(timeout);
            if (success) {
              res.json({ success: true, data });
            } else {
              res.status(500).json({ success: false, error });
            }
            resolve();
          });
        });
      } else {
        res.status(503).json({ success: false, error: 'Application not ready' });
      }
    } catch (error) {
      logger.error('[API] Error in GET /api/products/recommended:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // GET /api/products/search - Search products
  // Serve product photos
  appServer.get('/api/product-photos/:productId/:fileName', (req, res) => {
    try {
      const { productId, fileName } = req.params;
      const photosDir = path.join(app.getPath('userData'), 'product-photos', productId);
      const filePath = path.join(photosDir, fileName);
      
      // Security: Check if file exists and is within photos directory
      if (!fs.existsSync(filePath)) {
        return res.status(404).send('Photo not found');
      }
      
      // Verify the file is actually in the photos directory (prevent directory traversal)
      const resolvedPath = path.resolve(filePath);
      const resolvedDir = path.resolve(photosDir);
      if (!resolvedPath.startsWith(resolvedDir)) {
        return res.status(403).send('Access denied');
      }
      
      // Determine content type from file extension
      const ext = path.extname(fileName).toLowerCase();
      const mimeTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      
      // Set headers and send file
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      res.sendFile(resolvedPath);
    } catch (error) {
      logger.error('[ProductPhoto] Serve photo error:', error);
      res.status(500).send('Error serving photo');
    }
  });

  appServer.get('/api/products/search', async (req, res) => {
    try {
      const { q, category, tags } = req.query;
      
      if (mainWindow) {
        mainWindow.webContents.send('api-request', {
          type: 'search-products',
          params: { q, category, tags: tags ? tags.split(',') : undefined },
          requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        });
        
        return new Promise((resolve) => {
          const timeout = setTimeout(() => {
            ipcMain.removeAllListeners('api-response');
            res.status(500).json({ success: false, error: 'Request timeout' });
            resolve();
          }, 10000);
          
          ipcMain.once('api-response', (event, { requestId, success, data, error }) => {
            clearTimeout(timeout);
            if (success) {
              res.json({ success: true, data });
            } else {
              res.status(500).json({ success: false, error });
            }
            resolve();
          });
        });
      } else {
        res.status(503).json({ success: false, error: 'Application not ready' });
      }
    } catch (error) {
      logger.error('[API] Error in GET /api/products/search:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  appServer.get('*', (req, res) => {
    if (req.path.startsWith('/webhooks/')) return res.sendStatus(404);
    if (req.path.startsWith('/auth/')) return res.sendStatus(404);
    
    // Re-check isDev in case build was created after server started
    const currentBuildPath = path.join(__dirname, 'build');
    const currentIndexPath = path.join(currentBuildPath, 'index.html');
    // Only consider it production if both build directory AND index.html exist
    const currentIsDev = !fs.existsSync(currentBuildPath) || !fs.existsSync(currentIndexPath) || process.env.NODE_ENV === 'development';
    
    // Only serve index.html in production mode when build exists
    if (!currentIsDev && fs.existsSync(currentBuildPath) && fs.existsSync(currentIndexPath)) {
      res.sendFile(currentIndexPath);
    } else {
      // Development mode: Don't serve fallback, Vite dev server handles routing
      // Just return 404 silently - don't show error message
      logger.debug(`Development mode: Request to ${req.path} - handled by Vite dev server`);
      res.sendStatus(404);
    }
  });

  return new Promise((resolve, reject) => {
    const tryListen = (port) => {
      const server = appServer.listen(port, networkBinding, () => {
        const os = require('os');
        const networkInterfaces = os.networkInterfaces();
        const addresses = [];
        
        // Get localhost
        addresses.push(`http://localhost:${port}`);
        if (networkBinding === '0.0.0.0') {
          // Get network IPs
          for (const [name, interfaces] of Object.entries(networkInterfaces)) {
            if (!interfaces) continue;
            for (const iface of interfaces) {
              if (iface.family === 'IPv4' && !iface.internal) {
                addresses.push(`http://${iface.address}:${port}`);
              }
            }
          }
        }
        
        logger.info(`Backend server running on:`);
        addresses.forEach(addr => logger.info(`  - ${addr}`));
        
        // Configure firewall if needed
        const firewallConfigured = getConfig('firewallConfigured', false);
        if (!firewallConfigured && networkBinding === '0.0.0.0') {
          try {
            const { execSync } = require('child_process');
            execSync(`netsh advfirewall firewall add rule name="GlobalReach" dir=in action=allow protocol=TCP localport=${port}`, { stdio: 'pipe' });
            setConfig('firewallConfigured', true);
            logger.info('Firewall rule configured');
          } catch (err) {
            logger.warn('Failed to configure firewall rule (may require admin):', err.message);
          }
        }
        
        setConfig('serverPort', port);
        setConfig('serverAddresses', addresses);
        resolve({ server, port, addresses });
      }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          logger.warn(`Port ${port} in use, trying ${port + 1}`);
          tryListen(port + 1);
        } else {
          reject(err);
        }
      });
    };
    tryListen(startingPort);
  });
}

// --- ELECTRON WINDOW ---
let mainWindow;

async function createWindow() {
  // Check if we're in development mode (Vite dev server) or production (built files)
  const buildPath = path.join(__dirname, 'build');
  const indexPath = path.join(buildPath, 'index.html');
  // Only consider it production if build directory AND index.html both exist
  const isDev = !fs.existsSync(buildPath) || !fs.existsSync(indexPath) || process.env.NODE_ENV === 'development';
  const vitePort = 3000; // Match vite.config.ts server port
  
  // 1. Start Express Server (for webhooks and API, always needed)
  let port = DEFAULT_PORT;
  try {
    const result = await startServer(DEFAULT_PORT);
    serverInstance = result.server;
    port = result.port;
  } catch (err) {
    logger.error('Failed to start Express server', err);
    dialog.showErrorBox('Server Error', 'Failed to start local backend. Check logs.');
    return;
  }

  // 2. Create Window
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: true,
      webSecurity: true
    },
    show: false // Don't show until ready
  });

  // Show window when ready to prevent white screen flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Always open DevTools for debugging and error visibility
    mainWindow.webContents.openDevTools();
    
    // Inject error logging script for better error visibility
    mainWindow.webContents.executeJavaScript(`
      (function() {
        // Override console.error to catch React errors
        const originalError = console.error;
        console.error = function(...args) {
          if (args.some(arg => typeof arg === 'string' && (arg.includes('310') || arg.includes('Maximum update depth')))) {
            console.group('🚨 REACT ERROR #310 - INFINITE LOOP');
            console.error('Full error details:', ...args);
            console.trace('Stack trace:');
            console.groupEnd();
          }
          originalError.apply(console, args);
        };
        
        // Log all React errors with full details
        window.addEventListener('error', (e) => {
          if (e.message && (e.message.includes('310') || e.message.includes('Maximum update depth'))) {
            console.error('🚨 INFINITE LOOP ERROR:', {
              message: e.message,
              filename: e.filename,
              lineno: e.lineno,
              colno: e.colno,
              error: e.error,
              stack: e.error?.stack
            });
          }
        });
      })();
    `).catch(err => logger.warn('Failed to inject error logging:', err));
  });

  // 3. Load from Vite Dev Server (development) or Local Express Server (production)
  let url;
  if (isDev) {
    // Development: Use Vite dev server (port 3000 from vite.config.ts)
    url = `http://localhost:${vitePort}`;
    logger.info(`Development mode: Loading Electron window from Vite dev server: ${url}`);
    logger.info(`Note: Make sure to run 'npm run dev' in a separate terminal`);
  } else {
    // Production: Use local Express server serving built files
    url = `http://localhost:${port}`;
    logger.info(`Production mode: Loading Electron window from: ${url}`);
    
    // Wait a moment for server to be fully ready
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Add error handlers
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    logger.error('Failed to load URL', { errorCode, errorDescription, validatedURL, isMainFrame });
    console.error('Failed to load:', { errorCode, errorDescription, validatedURL, isMainFrame });
    if (isMainFrame) {
      if (isDev) {
        dialog.showErrorBox('Load Error', `Failed to load application at ${url}.\n\nError: ${errorDescription}\n\nMake sure Vite dev server is running:\nnpm run dev`);
      } else {
        dialog.showErrorBox('Load Error', `Failed to load application at ${url}\n\nError: ${errorDescription}\n\nPlease check:\n1. Server is running on port ${port}\n2. Build files exist in electron/build\n3. Check console for errors`);
      }
    }
  });
  
  // Log console errors from renderer
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    if (level >= 2) { // Error or warning
      logger.error(`[Renderer ${level}] ${message}`, { line, sourceId });
      console.error(`[Renderer ${level}] ${message}`);
    }
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    logger.info(`[Console ${level}] ${message}`, { line, sourceId });
    console.log(`[Console ${level}] ${message}`);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    logger.info('Page finished loading');
    console.log('Page finished loading successfully');
  });

  mainWindow.webContents.on('dom-ready', () => {
    logger.info('DOM ready');
    console.log('DOM is ready');
  });

  // Catch uncaught exceptions in the renderer
  mainWindow.webContents.on('unresponsive', () => {
    logger.warn('Renderer process became unresponsive');
    console.warn('Renderer process became unresponsive');
  });

  mainWindow.webContents.on('responsive', () => {
    logger.info('Renderer process became responsive again');
    console.log('Renderer process became responsive again');
  });

  // Catch uncaught exceptions in the renderer
  mainWindow.webContents.on('unresponsive', () => {
    logger.warn('Renderer process became unresponsive');
    console.warn('Renderer process became unresponsive');
  });

  mainWindow.webContents.on('responsive', () => {
    logger.info('Renderer process became responsive again');
    console.log('Renderer process became responsive again');
  });

  // Catch renderer process crashes
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    logger.error('Renderer process crashed', details);
    console.error('Renderer process crashed:', details);
    dialog.showErrorBox('Application Error', 'The application has crashed. Please restart the app.');
  });

  // Load the URL
  logger.info(`Attempting to load: ${url}`);
  console.log(`Attempting to load: ${url}`);
  mainWindow.loadURL(url).catch(err => {
    logger.error('Failed to load URL', err);
    console.error('Failed to load URL:', err);
    if (isDev) {
      dialog.showErrorBox('Load Error', `Failed to load application at ${url}.\n\nMake sure Vite dev server is running:\nnpm run dev`);
    } else {
      dialog.showErrorBox('Load Error', `Failed to load application at ${url}`);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Add keyboard shortcuts for reload
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // Ctrl+R or F5 to reload
    if ((input.control && input.key.toLowerCase() === 'r') || input.key === 'F5') {
      event.preventDefault();
      mainWindow.reload();
    }
    // Ctrl+Shift+R for hard reload
    if (input.control && input.shift && input.key.toLowerCase() === 'r') {
      event.preventDefault();
      mainWindow.webContents.reloadIgnoringCache();
    }
  });

  // Listen for Vite HMR updates in development
  if (isDev) {
    // Poll for Vite dev server changes (simple approach)
    // In development, Vite's HMR should work, but we can also add a manual reload trigger
    mainWindow.webContents.on('did-finish-load', () => {
      // Inject a script to listen for Vite HMR updates
      mainWindow.webContents.executeJavaScript(`
        if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
          // Listen for Vite HMR updates
          if (import.meta.hot) {
            import.meta.hot.on('vite:beforeFullReload', () => {
              console.log('[Electron] Vite full reload detected');
            });
          }
        }
      `).catch(() => {
        // Ignore errors if script injection fails
      });
    });
  }
}

// --- APP LIFECYCLE ---
// Register custom protocol handler for deep links
if (!app.isDefaultProtocolClient('globalreach')) {
  app.setAsDefaultProtocolClient('globalreach');
}

// Handle deep links (macOS)
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (mainWindow) {
    mainWindow.webContents.send('deep-link', url);
  } else {
    // Store for when window is ready
    app.once('ready', () => {
      if (mainWindow) {
        mainWindow.webContents.send('deep-link', url);
      }
    });
  }
});

// Handle deep links (Windows - second-instance)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    // Focus main window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    
    // Check for deep link in command line
    const url = commandLine.find(arg => arg.startsWith('globalreach://'));
    if (url && mainWindow) {
      mainWindow.webContents.send('deep-link', url);
    }
  });
}

// Create application menu
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) {
              mainWindow.reload();
            }
          }
        },
        {
          label: 'Hard Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.reloadIgnoringCache();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Developer Tools',
          accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.toggleDevTools();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) {
              mainWindow.reload();
            }
          }
        },
        {
          label: 'Hard Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.reloadIgnoringCache();
            }
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  
  autoUpdater.checkForUpdatesAndNotify().catch(err => logger.warn('Update check failed', err));
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
  if (serverInstance) serverInstance.close();
});

// Enhanced auto-update handlers
autoUpdater.on('checking-for-update', () => {
  logger.info('Checking for updates...');
});

autoUpdater.on('update-available', (info) => {
  logger.info('Update available:', info.version);
});

autoUpdater.on('update-not-available', () => {
  logger.info('No updates available');
});

autoUpdater.on('error', (err) => {
  logger.error('Update error:', err);
});

autoUpdater.on('download-progress', (progressObj) => {
  logger.info(`Update download progress: ${Math.round(progressObj.percent)}%`);
});

autoUpdater.on('update-downloaded', (info) => {
  logger.info('Update downloaded:', info.version);
  // Don't auto-install, let user decide through UI
});

// --- IPC HANDLERS ---
ipcMain.handle('get-config', (event, key) => getConfig(key));
ipcMain.handle('set-config', (event, key, value) => setConfig(key, value));

ipcMain.handle('secure-save', async (event, key, value) => {
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(value);
    setConfig(`secure_${key}`, encrypted.toString('hex'));
    return true;
  }
  return false;
});

ipcMain.handle('secure-load', async (event, key) => {
  if (safeStorage.isEncryptionAvailable()) {
    const hex = getConfig(`secure_${key}`);
    if (!hex) return null;
    try {
      const buffer = Buffer.from(hex, 'hex');
      return safeStorage.decryptString(buffer);
    } catch (e) {
      logger.error('Decryption failed', e);
    }
  }
  return null;
});

ipcMain.handle('reset-app', async () => {
  try {
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
      return true;
    }
    return false;
  } catch (error) {
    logger.error('Reset failed', error);
    return false;
  }
});

ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('get-path', (event, name) => app.getPath(name));

ipcMain.handle('reload-window', () => {
  if (mainWindow) {
    mainWindow.reload();
    return { success: true };
  }
  return { success: false, error: 'No window available' };
});

ipcMain.handle('reload-window-ignoring-cache', () => {
  if (mainWindow) {
    mainWindow.webContents.reloadIgnoringCache();
    return { success: true };
  }
  return { success: false, error: 'No window available' };
});

ipcMain.handle('create-backup', async (event, dataString) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save Encrypted Backup',
    filters: [{ name: 'Backup', extensions: ['grbk'] }]
  });
  if (canceled || !filePath) return { success: false };

  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', BACKUP_ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(dataString, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const payload = JSON.stringify({ iv: iv.toString('hex'), data: encrypted });
    fs.writeFileSync(filePath, payload);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('restore-backup', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [{ name: 'Backup', extensions: ['grbk'] }],
    properties: ['openFile']
  });
  if (canceled || filePaths.length === 0) return { success: false };

  try {
    const content = fs.readFileSync(filePaths[0], 'utf8');
    const json = JSON.parse(content);
    const iv = Buffer.from(json.iv, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', BACKUP_ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(json.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return { success: true, data: decrypted };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// --- Product Photo Management IPC Handlers ---
ipcMain.handle('product-photo-upload', async (event, { productId, photoId, fileData, fileName, mimeType }) => {
  try {
    const photosDir = path.join(app.getPath('userData'), 'product-photos', productId);
    if (!fs.existsSync(photosDir)) {
      fs.mkdirSync(photosDir, { recursive: true });
    }

    // Convert array back to Buffer
    const buffer = Buffer.from(fileData);
    
    // Save original file
    const filePath = path.join(photosDir, `${photoId}_${fileName}`);
    fs.writeFileSync(filePath, buffer);

    // Generate HTTP URLs (served through Express server)
    // Use relative path that will be served by Express
    const port = getConfig('serverPort', DEFAULT_PORT);
    const url = `http://localhost:${port}/api/product-photos/${productId}/${photoId}_${fileName}`;
    
    // For now, use same URL for thumbnail (can be enhanced with image optimization later)
    const thumbnailUrl = url;

    // Get image dimensions if possible (basic check, can be enhanced)
    let width, height;
    if (mimeType.startsWith('image/')) {
      // For now, we'll skip dimension detection (can add sharp or jimp later)
      // This is a placeholder for future enhancement
      width = undefined;
      height = undefined;
    }

    logger.info(`[ProductPhoto] Uploaded photo ${photoId} for product ${productId}`);
    
    return {
      success: true,
      url,
      thumbnailUrl,
      width,
      height,
    };
  } catch (error) {
    logger.error('[ProductPhoto] Upload failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('product-photo-delete', async (event, { productId, photoId }) => {
  try {
    const photosDir = path.join(app.getPath('userData'), 'product-photos', productId);
    if (!fs.existsSync(photosDir)) {
      return { success: false, error: 'Photo directory not found' };
    }

    // Find and delete photo file
    const files = fs.readdirSync(photosDir);
    const photoFile = files.find(f => f.startsWith(photoId));
    
    if (photoFile) {
      const filePath = path.join(photosDir, photoFile);
      fs.unlinkSync(filePath);
      logger.info(`[ProductPhoto] Deleted photo ${photoId} for product ${productId}`);
      return { success: true };
    } else {
      return { success: false, error: 'Photo file not found' };
    }
  } catch (error) {
    logger.error('[ProductPhoto] Delete failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('product-photo-get-url', async (event, { productId, photoId }) => {
  try {
    const photosDir = path.join(app.getPath('userData'), 'product-photos', productId);
    if (!fs.existsSync(photosDir)) {
      return { success: false, error: 'Photo directory not found' };
    }

    // Find photo file
    const files = fs.readdirSync(photosDir);
    const photoFile = files.find(f => f.startsWith(photoId));
    
    if (photoFile) {
      // Generate HTTP URL (served through Express server)
      const port = getConfig('serverPort', DEFAULT_PORT);
      const url = `http://localhost:${port}/api/product-photos/${productId}/${photoFile}`;
      return { success: true, url };
    } else {
      return { success: false, error: 'Photo file not found' };
    }
  } catch (error) {
    logger.error('[ProductPhoto] Get URL failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-log-path', () => path.join(logDir, 'combined.log'));
ipcMain.on('log-message', (event, level, message, data) => {
  logger.log(level, message, data);
});

// Load EmailService from main process
const EmailService = require('./services/emailService');

// Helper function to load platform connections from main process
// Uses the same secure storage mechanism as securityService
function loadPlatformConnectionsFromMain() {
  try {
    const STORAGE_KEY_PLATFORMS = 'globalreach_platforms';
    if (safeStorage.isEncryptionAvailable()) {
      const hex = getConfig(`secure_${STORAGE_KEY_PLATFORMS}`);
      if (hex) {
        try {
          const buffer = Buffer.from(hex, 'hex');
          const decrypted = safeStorage.decryptString(buffer);
          return JSON.parse(decrypted);
        } catch (e) {
          logger.error('Decryption failed for platform connections:', e);
        }
      }
    } else {
      // Fallback to unencrypted storage
      const stored = getConfig(STORAGE_KEY_PLATFORMS);
      if (stored) {
        return JSON.parse(stored);
      }
    }
  } catch (err) {
    logger.error('Error loading platform connections:', err);
  }
  return [];
}

// Helper function to save platform connections from main process
function savePlatformConnectionsToMain(connections) {
  try {
    const STORAGE_KEY_PLATFORMS = 'globalreach_platforms';
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(JSON.stringify(connections));
      setConfig(`secure_${STORAGE_KEY_PLATFORMS}`, encrypted.toString('hex'));
    } else {
      // Fallback to unencrypted storage
      setConfig(STORAGE_KEY_PLATFORMS, JSON.stringify(connections));
    }
    return true;
  } catch (err) {
    logger.error('Error saving platform connections:', err);
    return false;
  }
}

// Helper function to get email connection
function getEmailConnectionFromMain() {
  const connections = loadPlatformConnectionsFromMain();
  const emailConnection = connections.find(conn => 
    (conn.channel === 'EMAIL' || conn.channel === 'email') && 
    (conn.status === 'Connected' || conn.status === 'connected') && 
    conn.emailCredentials
  ) || null;
  return emailConnection;
}

// Email connection test handler (runs in main process where Node.js modules are available)
ipcMain.handle('email-test-connection', async (event, credentials) => {
  try {
    logger.info('Email test connection requested:', { 
      provider: credentials?.provider,
      smtpHost: credentials?.smtpHost,
      username: credentials?.username ? credentials.username.substring(0, 3) + '***' : 'missing'
    });

    if (!credentials) {
      return { success: false, error: 'No credentials provided' };
    }

    // Validate credentials structure
    if (!credentials.username || !credentials.password) {
      return { success: false, error: 'Username and password are required' };
    }

    if (!credentials.smtpHost) {
      return { success: false, error: 'SMTP host is required' };
    }

    const result = await EmailService.testConnection(credentials, getConfig);
    
    if (result.success) {
      logger.info('Email connection test successful');
    } else {
      logger.warn('Email connection test failed:', result.error?.substring(0, 200));
    }
    
    // Return the error message from EmailService which should already be user-friendly
    return result;
  } catch (error) {
    logger.error('Email test connection error:', {
      message: error.message,
      code: error.code,
      responseCode: error.responseCode,
      stack: error.stack
    });
    
    let errorMessage = error.message || 'Connection test failed';
    
    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Connection refused. Please check if the SMTP host and port are correct.';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Connection timeout. Please check your internet connection and firewall settings.';
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = `SMTP host not found: ${credentials?.smtpHost || 'unknown'}. Please check the hostname.`;
    } else if (error.responseCode === 535 || error.message?.includes('authentication')) {
      errorMessage = 'Authentication failed. Please check your username/email and password. For Gmail/Outlook with 2FA, use an App Password.';
    } else if (error.responseCode === 554) {
      errorMessage = 'SMTP server rejected the connection. Please check your server settings.';
    }
    
    return { 
      success: false, 
      error: errorMessage 
    };
  }
});

// Email send via SMTP handler
ipcMain.handle('email-send-smtp', async (event, credentials, options) => {
  try {
    logger.info('Email send via SMTP requested:', {
      provider: credentials?.provider,
      smtpHost: credentials?.smtpHost,
      to: options?.to
    });

    if (!credentials || !options) {
      return { success: false, error: 'Invalid parameters' };
    }

    const result = await EmailService.sendViaSMTP(credentials, options);
    return result;
  } catch (error) {
    logger.error('Email send SMTP error:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to send email via SMTP' 
    };
  }
});

// Email send via Gmail API handler
ipcMain.handle('email-send-gmail', async (event, credentials, options) => {
  try {
    logger.info('Email send via Gmail requested:', {
      to: options?.to
    });

    if (!credentials || !options) {
      return { success: false, error: 'Invalid parameters' };
    }

    const result = await EmailService.sendViaGmail(
      credentials, 
      options, 
      getConfig, 
      loadPlatformConnectionsFromMain, 
      savePlatformConnectionsToMain
    );
    return result;
  } catch (error) {
    logger.error('Email send Gmail error:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to send email via Gmail' 
    };
  }
});

// Email read via IMAP handler
ipcMain.handle('email-read-imap', async (event, credentials, maxResults = 10) => {
  try {
    logger.info('Email read via IMAP requested:', {
      provider: credentials?.provider,
      imapHost: credentials?.imapHost,
      maxResults
    });

    if (!credentials) {
      return { success: false, error: 'No credentials provided' };
    }

    const result = await EmailService.readViaIMAP(credentials, maxResults);
    return result;
  } catch (error) {
    logger.error('Email read IMAP error:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to read emails via IMAP' 
    };
  }
});

// Email read via Gmail API handler
ipcMain.handle('email-read-gmail', async (event, credentials, maxResults = 10, query) => {
  try {
    logger.info('Email read via Gmail requested:', {
      maxResults,
      query
    });

    if (!credentials) {
      return { success: false, error: 'No credentials provided' };
    }

    const result = await EmailService.readViaGmail(
      credentials, 
      maxResults, 
      query, 
      getConfig, 
      loadPlatformConnectionsFromMain, 
      savePlatformConnectionsToMain
    );
    return result;
  } catch (error) {
    logger.error('Email read Gmail error:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to read emails via Gmail' 
    };
  }
});

// Get email connection handler
ipcMain.handle('email-get-connection', async (event) => {
  try {
    const connection = getEmailConnectionFromMain();
    return { success: true, connection };
  } catch (error) {
    logger.error('Email get connection error:', error);
    return { 
      success: false, 
      error: error.message || 'Failed to get email connection' 
    };
  }
});

// OAuth IPC Handlers
ipcMain.handle('oauth-initiate', async (event, { provider, config, email }) => {
  try {
    logger.info('OAuth initiation requested', { provider, email, hasConfig: !!config });
    
    let authUrl, state;
    const crypto = require('crypto');
    
    if (provider === 'gmail') {
      // Gmail OAuth should be handled via renderer process OAuth service
      throw new Error('Gmail OAuth initiation should use renderer process OAuth service');
    } else if (provider === 'outlook') {
      // Generate state for Outlook
      const nonce = crypto.randomBytes(32).toString('hex');
      const stateObj = {
        provider: 'outlook',
        nonce,
        timestamp: Date.now(),
        email
      };
      state = Buffer.from(JSON.stringify(stateObj)).toString('base64url');
      
      // Build Outlook OAuth URL
      const tenantId = config.tenantId || 'common';
      const scopes = [
        'https://graph.microsoft.com/Mail.Send',
        'https://graph.microsoft.com/Mail.Read',
        'https://graph.microsoft.com/User.Read',
        'offline_access',
      ].join(' ');
      
      const params = new URLSearchParams({
        client_id: config.clientId,
        response_type: 'code',
        redirect_uri: config.redirectUri,
        response_mode: 'query',
        scope: scopes,
        state,
        prompt: 'consent',
      });
      
      authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
    } else {
      throw new Error(`Unsupported OAuth provider: ${provider}`);
    }
    
    // Open OAuth URL in default browser
    await shell.openExternal(authUrl);
    
    logger.info('OAuth URL opened in browser', { provider, hasState: !!state });
    
    return { success: true, state };
  } catch (error) {
    logger.error('OAuth initiation failed', error);
    return { success: false, error: error.message || 'Failed to initiate OAuth' };
  }
});

ipcMain.handle('oauth-exchange', async (event, { provider, code, state, config }) => {
  try {
    logger.info('OAuth code exchange requested', { provider, hasCode: !!code, hasState: !!state });
    // Code exchange is handled in renderer process via OAuthService
    return { success: false, error: 'OAuth code exchange should be handled in renderer process via OAuthService' };
  } catch (error) {
    logger.error('OAuth code exchange failed', error);
    return { success: false, error: error.message || 'Failed to exchange OAuth code' };
  }
});

ipcMain.handle('oauth-refresh', async (event, { provider, refreshToken, config }) => {
  try {
    logger.info('OAuth token refresh requested', { provider });
    // Token refresh is handled in renderer process via OAuthService
    return { success: false, error: 'OAuth token refresh should be handled in renderer process via OAuthService' };
  } catch (error) {
    logger.error('OAuth token refresh failed', error);
    return { success: false, error: error.message || 'Failed to refresh OAuth token' };
  }
});

ipcMain.handle('oauth-revoke', async (event, { provider, token, config }) => {
  try {
    logger.info('OAuth token revocation requested', { provider });
    // Token revocation is handled in renderer process via OAuthService
    return { success: false, error: 'OAuth token revocation should be handled in renderer process via OAuthService' };
  } catch (error) {
    logger.error('OAuth token revocation failed', error);
    return { success: false, error: error.message || 'Failed to revoke OAuth token' };
  }
});

// --- WhatsApp Web IPC Handlers ---
let whatsappWebClient = null;
let whatsappWebQRCode = null;
let whatsappWebPairingCode = null;
let whatsappWebReady = false;
let whatsappWebEventListeners = [];

ipcMain.handle('whatsapp-web-init', async (event, config) => {
  try {
    logger.info('WhatsApp Web initialization requested');
    
    // Clear require cache to ensure fresh module load
    const moduleName = 'whatsapp-web.js';
    const modulePath = path.join(__dirname, '..', 'node_modules', moduleName);
    
    // Try to resolve the module path, but don't fail if it doesn't exist in cache
    let resolvedPath;
    try {
      resolvedPath = require.resolve(moduleName);
      // Clear cache for this module and its dependencies
      if (require.cache[resolvedPath]) {
        delete require.cache[resolvedPath];
        logger.info('Cleared require cache for whatsapp-web.js');
      }
    } catch (resolveError) {
      logger.warn('Could not resolve module path (will try direct require):', resolveError.message);
      resolvedPath = null;
    }
    
    // Dynamic import to avoid bundling issues
    // whatsapp-web.js exports Client and LocalAuth directly
    let Client, LocalAuth;
    
    try {
      // Try to require the module with fresh cache
      let whatsappModule;
      try {
        logger.info('Attempting to require whatsapp-web.js from:', resolvedPath);
        whatsappModule = require(moduleName);
        logger.info('Module required successfully');
      } catch (requireErr) {
        // If direct require fails, try with absolute path
        logger.warn('Direct require failed, trying absolute path:', {
          error: requireErr.message,
          stack: requireErr.stack,
          code: requireErr.code
        });
        try {
          logger.info('Trying absolute path:', modulePath);
          // Clear cache for absolute path too
          if (require.cache[modulePath]) {
            delete require.cache[modulePath];
          }
          whatsappModule = require(modulePath);
          logger.info('Module loaded from absolute path');
        } catch (absPathErr) {
          logger.error('Both require methods failed:', {
            directError: requireErr.message,
            absPathError: absPathErr.message,
            directStack: requireErr.stack,
            absPathStack: absPathErr.stack
          });
          throw absPathErr;
        }
      }
      
      // Debug: Log what we got from the module
      logger.info('WhatsApp module loaded:', {
        hasClient: !!whatsappModule.Client,
        hasLocalAuth: !!whatsappModule.LocalAuth,
        clientType: typeof whatsappModule.Client,
        localAuthType: typeof whatsappModule.LocalAuth,
        keys: Object.keys(whatsappModule).slice(0, 10) // First 10 keys
      });
      
      if (!whatsappModule.Client) {
        throw new Error('Client not found in whatsapp-web.js module. Available exports: ' + Object.keys(whatsappModule).join(', '));
      }
      
      Client = whatsappModule.Client;
      LocalAuth = whatsappModule.LocalAuth;
      
      // Verify Client is a constructor
      if (typeof Client !== 'function') {
        throw new Error(`Client is not a constructor. Type: ${typeof Client}, Value: ${String(Client).substring(0, 100)}`);
      }
      
      // Verify it can be instantiated (check if it's a class)
      if (!Client.prototype) {
        throw new Error('Client does not have a prototype - not a valid constructor');
      }
      
      logger.info('Client and LocalAuth verified successfully', {
        clientName: Client.name,
        localAuthName: LocalAuth ? LocalAuth.name : 'undefined'
      });
    } catch (requireError) {
      logger.error('Failed to load whatsapp-web.js module:', {
        error: requireError.message,
        stack: requireError.stack
      });
      throw new Error(`Failed to load WhatsApp Web module: ${requireError.message}`);
    }
    
    // Verify LocalAuth is also a constructor
    if (!LocalAuth || typeof LocalAuth !== 'function') {
      throw new Error(`LocalAuth is not a constructor. Type: ${typeof LocalAuth}`);
    }
    
    // Get session path
    const sessionPath = config?.sessionPath || path.join(app.getPath('userData'), 'whatsapp-web-session');
    
    // Clean up existing client if any
    if (whatsappWebClient) {
      try {
        await whatsappWebClient.destroy();
      } catch (err) {
        logger.warn('Failed to destroy existing WhatsApp Web client', err);
      }
    }
    
    // Create LocalAuth instance
    let authStrategy;
    try {
      authStrategy = new LocalAuth({
        dataPath: sessionPath,
      });
      logger.info('LocalAuth instance created successfully');
    } catch (authError) {
      logger.error('Failed to create LocalAuth instance:', authError);
      throw new Error(`Failed to create LocalAuth: ${authError.message}`);
    }
    
    // Create Client instance
    try {
      // Final verification before instantiation
      if (typeof Client !== 'function') {
        throw new Error(`Client is not a function before instantiation. Type: ${typeof Client}, Value: ${String(Client)}`);
      }
      
      if (!Client.prototype) {
        throw new Error('Client does not have a prototype before instantiation');
      }
      
      logger.info('Creating Client instance...', {
        clientType: typeof Client,
        clientName: Client.name || 'unnamed',
        hasPrototype: !!Client.prototype,
        isConstructor: typeof Client === 'function' && Client.prototype && Client.prototype.constructor === Client
      });
      
      // Get user data directory for browser storage
      const browserUserDataDir = path.join(app.getPath('userData'), 'whatsapp-web-browser');
      
      // Try to instantiate
      const clientOptions = {
        authStrategy: authStrategy,
        puppeteer: {
          headless: true,
          userDataDir: browserUserDataDir, // Isolated browser profile for storage
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--enable-features=NetworkService',
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security',
            '--allow-running-insecure-content',
            '--disable-features=IsolateOrigins,site-per-process',
            '--enable-local-storage',
            '--enable-indexed-db',
          ],
          // Ensure IndexedDB and localStorage work properly
          ignoreDefaultArgs: ['--disable-extensions'],
        },
      };
      
      // Add phone number pairing if provided
      if (config?.phoneNumber) {
        // Format phone number: remove all non-digits
        const phoneNumber = config.phoneNumber.replace(/\D/g, '');
        if (phoneNumber.length >= 10) {
          clientOptions.pairWithPhoneNumber = {
            phoneNumber: phoneNumber,
            showNotification: config.showNotification !== false,
            intervalMs: config.intervalMs || 180000, // 3 minutes default
          };
          logger.info('Phone number pairing enabled', { phoneNumber: phoneNumber.substring(0, 3) + '***' });
        }
      }
      
      logger.info('Calling new Client() with options:', JSON.stringify(clientOptions, null, 2).substring(0, 500));
      
      whatsappWebClient = new Client(clientOptions);
      
      logger.info('Client instance created successfully', {
        clientType: typeof whatsappWebClient,
        hasInitialize: typeof whatsappWebClient.initialize === 'function'
      });
    } catch (clientError) {
      logger.error('Failed to create Client instance:', {
        error: clientError.message,
        errorName: clientError.name,
        stack: clientError.stack,
        clientType: typeof Client,
        clientName: Client ? Client.name : 'undefined',
        clientConstructor: Client ? String(Client).substring(0, 300) : 'undefined',
        errorString: String(clientError)
      });
      
      // Provide more helpful error message
      let errorMessage = `Failed to create WhatsApp Client: ${clientError.message}`;
      if (clientError.message && clientError.message.includes('is not a constructor')) {
        errorMessage += `. This usually means the module didn't load correctly. Client type: ${typeof Client}, Client name: ${Client ? Client.name : 'undefined'}`;
      }
      
      throw new Error(errorMessage);
    }
    
    // Set up event handlers
    whatsappWebClient.on('qr', (qr) => {
      logger.info('WhatsApp Web QR code received');
      whatsappWebQRCode = qr;
      whatsappWebPairingCode = null;
      whatsappWebReady = false;
      
      // Send QR code to all renderer processes
      const allWindows = BrowserWindow.getAllWindows();
      allWindows.forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('whatsapp-web-qr', qr);
        }
      });
    });
    
    // Listen for pairing code (phone number authentication)
    whatsappWebClient.on('pairing_code', (code) => {
      logger.info('WhatsApp Web pairing code received');
      whatsappWebPairingCode = code;
      whatsappWebQRCode = null;
      whatsappWebReady = false;
      
      // Send pairing code to all renderer processes
      const allWindows = BrowserWindow.getAllWindows();
      allWindows.forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('whatsapp-web-pairing-code', code);
        }
      });
    });
    
    whatsappWebClient.on('ready', () => {
      logger.info('WhatsApp Web client is ready - connection established');
      whatsappWebReady = true;
      whatsappWebQRCode = null;
      whatsappWebPairingCode = null;
      
      // Notify all renderer processes
      const allWindows = BrowserWindow.getAllWindows();
      logger.info(`Sending whatsapp-web-ready event to ${allWindows.length} window(s)`);
      allWindows.forEach(win => {
        if (win && !win.isDestroyed()) {
          try {
            win.webContents.send('whatsapp-web-ready');
            logger.info('Sent whatsapp-web-ready event to window');
          } catch (err) {
            logger.error('Failed to send whatsapp-web-ready event:', err);
          }
        }
      });
    });
    
    whatsappWebClient.on('auth_failure', (msg) => {
      logger.error('WhatsApp Web authentication failed', msg);
      whatsappWebReady = false;
      
      const allWindows = BrowserWindow.getAllWindows();
      allWindows.forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('whatsapp-web-auth-failure', msg);
        }
      });
    });
    
    whatsappWebClient.on('disconnected', (reason) => {
      logger.warn('WhatsApp Web disconnected', reason);
      whatsappWebReady = false;
      
      const allWindows = BrowserWindow.getAllWindows();
      allWindows.forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('whatsapp-web-disconnected', reason);
        }
      });
    });
    
    whatsappWebClient.on('message', async (msg) => {
      // Forward incoming messages to renderer
      const allWindows = BrowserWindow.getAllWindows();
      allWindows.forEach(win => {
        if (win && !win.isDestroyed()) {
          win.webContents.send('whatsapp-web-message', {
            from: msg.from,
            body: msg.body,
            timestamp: msg.timestamp,
            id: msg.id,
          });
        }
      });
    });
    
    // Initialize client with error handling for storage issues
    try {
      await whatsappWebClient.initialize();
    } catch (initError) {
      // If initialization fails due to storage issues, try clearing the session
      if (initError.message && (initError.message.includes('IndexedDB') || initError.message.includes('storage') || initError.message.includes('invariant'))) {
        logger.warn('Storage error detected, attempting to clear session and retry');
        try {
          // Clear the browser user data directory
          const browserUserDataDir = path.join(app.getPath('userData'), 'whatsapp-web-browser');
          if (fs.existsSync(browserUserDataDir)) {
            logger.info('Clearing browser user data directory:', browserUserDataDir);
            fs.rmSync(browserUserDataDir, { recursive: true, force: true });
          }
          
          // Also clear the session directory
          const sessionPath = config?.sessionPath || path.join(app.getPath('userData'), 'whatsapp-web-session');
          if (fs.existsSync(sessionPath)) {
            logger.info('Clearing session directory:', sessionPath);
            fs.rmSync(sessionPath, { recursive: true, force: true });
          }
          
          // Recreate client with fresh session
          logger.info('Recreating client with fresh session');
          throw new Error('Session cleared, please retry initialization');
        } catch (clearError) {
          logger.error('Failed to clear session:', clearError);
          throw initError; // Re-throw original error
        }
      } else {
        throw initError; // Re-throw if not a storage error
      }
    }
    
    return {
      success: true,
      qrCode: whatsappWebQRCode,
      pairingCode: whatsappWebPairingCode,
      ready: whatsappWebReady,
    };
  } catch (error) {
    logger.error('WhatsApp Web initialization failed', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      error: error
    });
    
    // Provide more detailed error message
    let errorMessage = 'Failed to initialize WhatsApp Web';
    if (error.message) {
      errorMessage = error.message;
    } else if (error.toString) {
      errorMessage = error.toString();
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
});

ipcMain.handle('whatsapp-web-get-status', async () => {
  const status = {
    initialized: whatsappWebClient !== null,
    ready: whatsappWebReady,
    qrCode: whatsappWebQRCode,
    pairingCode: whatsappWebPairingCode,
  };
  logger.info('WhatsApp Web status requested:', status);
  return status;
});

// Request pairing code for phone number authentication
ipcMain.handle('whatsapp-web-request-pairing-code', async (event, { phoneNumber, showNotification = true, intervalMs = 180000 }) => {
  try {
    if (!whatsappWebClient) {
      return {
        success: false,
        error: 'WhatsApp Web client is not initialized. Please initialize first.',
      };
    }
    
    // Format phone number (remove all non-digits)
    const formattedPhone = phoneNumber.replace(/\D/g, '');
    
    if (formattedPhone.length < 10) {
      return {
        success: false,
        error: 'Invalid phone number format. Please include country code (e.g., 12025550108 for US)',
      };
    }
    
    logger.info('Requesting pairing code for phone number', { phoneNumber: formattedPhone.substring(0, 3) + '***' });
    
    // Check if client is initialized and has a page
    // Wait for the page to be ready before requesting pairing code
    let pupPage = whatsappWebClient.pupPage;
    if (!pupPage) {
      logger.warn('Client page not ready, waiting for initialization...');
      // Wait a bit for the page to be ready (max 5 seconds)
      let retries = 0;
      while (!pupPage && retries < 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        pupPage = whatsappWebClient.pupPage;
        retries++;
      }
      
      if (!pupPage) {
        return {
          success: false,
          error: 'WhatsApp Web client is not fully initialized. Please wait a moment and try again.',
        };
      }
    }
    
    // Ensure onCodeReceivedEvent is exposed before requesting pairing code
    // whatsapp-web.js needs this function to be available in the browser context
    try {
      const exists = await pupPage.evaluate(() => {
        return typeof window.onCodeReceivedEvent === 'function';
      }).catch(() => false);
      
      if (!exists) {
        logger.info('Exposing onCodeReceivedEvent function for pairing code');
        
        // Expose the function to handle pairing code events
        await pupPage.exposeFunction('onCodeReceivedEvent', async (code) => {
          logger.info('Pairing code received via exposed function:', code);
          whatsappWebPairingCode = code;
          whatsappWebQRCode = null;
          
          // Emit the pairing_code event
          whatsappWebClient.emit('pairing_code', code);
          
          // Send pairing code to all renderer processes
          const allWindows = BrowserWindow.getAllWindows();
          allWindows.forEach(win => {
            if (win && !win.isDestroyed()) {
              win.webContents.send('whatsapp-web-pairing-code', code);
            }
          });
          
          return code;
        });
        logger.info('Successfully exposed onCodeReceivedEvent function');
      } else {
        logger.info('onCodeReceivedEvent function already exists');
      }
    } catch (exposeError) {
      logger.warn('Failed to expose onCodeReceivedEvent, will try requestPairingCode anyway:', exposeError.message);
    }
    
    // Request pairing code - the library will use the exposed onCodeReceivedEvent
    const pairingCode = await whatsappWebClient.requestPairingCode(formattedPhone, showNotification, intervalMs);
    
    whatsappWebPairingCode = pairingCode;
    whatsappWebQRCode = null;
    
    logger.info('Pairing code received:', pairingCode);
    
    // Emit the pairing_code event
    whatsappWebClient.emit('pairing_code', pairingCode);
    
    // Send pairing code to all renderer processes
    const allWindows = BrowserWindow.getAllWindows();
    allWindows.forEach(win => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('whatsapp-web-pairing-code', pairingCode);
      }
    });
    
    return {
      success: true,
      pairingCode: pairingCode,
    };
  } catch (error) {
    logger.error('Failed to request pairing code', error);
    return {
      success: false,
      error: error.message || 'Failed to request pairing code',
    };
  }
});

ipcMain.handle('whatsapp-web-send', async (event, { to, content }) => {
  try {
    if (!whatsappWebClient || !whatsappWebReady) {
      return {
        success: false,
        error: 'WhatsApp Web is not ready. Please scan QR code first.',
      };
    }
    
    // Format phone number for WhatsApp Web
    // WhatsApp Web format: number@c.us (number should be digits only, no + or spaces)
    let phoneNumber = to.trim();
    
    // Remove @c.us if already present
    phoneNumber = phoneNumber.replace('@c.us', '');
    
    // Remove all non-digits (spaces, +, -, etc.)
    phoneNumber = phoneNumber.replace(/\D/g, '');
    
    // Validate phone number
    if (phoneNumber.length < 10) {
      return {
        success: false,
        error: 'Invalid phone number format. Please include country code (e.g., 1234567890 or +1234567890)',
      };
    }
    
    // Format as WhatsApp ID: number@c.us
    const whatsappId = phoneNumber + '@c.us';
    
    logger.info('Sending WhatsApp Web message', { 
      original: to, 
      formatted: whatsappId, 
      contentLength: content.length 
    });
    
    await whatsappWebClient.sendMessage(whatsappId, content);
    
    return { success: true };
  } catch (error) {
    logger.error('WhatsApp Web send failed', error);
    return {
      success: false,
      error: error.message || 'Failed to send message',
    };
  }
});

ipcMain.handle('whatsapp-web-disconnect', async () => {
  try {
    if (whatsappWebClient) {
      await whatsappWebClient.destroy();
      whatsappWebClient = null;
      whatsappWebReady = false;
      whatsappWebQRCode = null;
      logger.info('WhatsApp Web disconnected');
    }
    return { success: true };
  } catch (error) {
    logger.error('WhatsApp Web disconnect failed', error);
    return {
      success: false,
      error: error.message || 'Failed to disconnect',
    };
  }
});