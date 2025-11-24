const { app, BrowserWindow, ipcMain, safeStorage, shell, dialog } = require('electron');
const path = require('path');
const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const winston = require('winston');
const { autoUpdater } = require('electron-updater');

// --- CONFIGURATION ---
const DEFAULT_PORT = 4000;
const CONFIG_FILE_NAME = 'config.json';
const BACKUP_ENCRYPTION_KEY = crypto.scryptSync('shreenathji_secret', 'salt', 32);

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
    // Open DevTools for debugging (both dev and production)
    mainWindow.webContents.openDevTools();
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

app.whenReady().then(() => {
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

    const result = await EmailService.testConnection(credentials, getConfig);
    
    // Enhance error messages from EmailService if needed
    if (!result.success && result.error) {
      let errorMessage = result.error;
      
      if (result.error.includes('ECONNREFUSED')) {
        errorMessage = 'Connection refused. Please check if the SMTP host and port are correct.';
      } else if (result.error.includes('ETIMEDOUT')) {
        errorMessage = 'Connection timeout. Please check your internet connection and firewall settings.';
      } else if (result.error.includes('ENOTFOUND')) {
        errorMessage = `SMTP host not found: ${credentials?.smtpHost || 'unknown'}. Please check the hostname.`;
      } else if (result.error.includes('authentication') || result.error.includes('535')) {
        errorMessage = 'Authentication failed. Please check your username/email and password. For Gmail/Outlook with 2FA, use an App Password.';
      } else if (result.error.includes('554')) {
        errorMessage = 'SMTP server rejected the connection. Please check your server settings.';
      }
      
      return { success: false, error: errorMessage };
    }
    
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