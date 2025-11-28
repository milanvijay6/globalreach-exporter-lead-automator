const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Secure Storage
  secureSave: (key, value) => ipcRenderer.invoke('secure-save', key, value),
  secureLoad: (key) => ipcRenderer.invoke('secure-load', key),
  
  // Config
  getConfig: (key) => ipcRenderer.invoke('get-config', key),
  setConfig: (key, value) => ipcRenderer.invoke('set-config', key, value),
  resetApp: () => ipcRenderer.invoke('reset-app'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Updates
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onUpdateReady: (callback) => ipcRenderer.on('update-ready', callback),
  
  // Webhooks
  onWebhookPayload: (callback) => ipcRenderer.on('webhook-payload', callback),
  
  // Backup & Restore
  backupData: (data) => ipcRenderer.invoke('create-backup', data),
  restoreData: () => ipcRenderer.invoke('restore-backup'),

  // Logging
  logMessage: (level, message, data) => ipcRenderer.send('log-message', level, message, data),
  getLogPath: () => ipcRenderer.invoke('get-log-path'),
  
  // Environment
  platform: process.platform,
  
  // OAuth
  initiateOAuth: (provider, config, email) => ipcRenderer.invoke('oauth-initiate', { provider, config, email }),
  exchangeOAuthCode: (provider, code, state, config) => ipcRenderer.invoke('oauth-exchange', { provider, code, state, config }),
  refreshOAuthToken: (provider, refreshToken, config) => ipcRenderer.invoke('oauth-refresh', { provider, refreshToken, config }),
  revokeOAuthToken: (provider, token, config) => ipcRenderer.invoke('oauth-revoke', { provider, token, config }),
  onOAuthCallback: (callback) => ipcRenderer.on('oauth-callback', callback),
  removeOAuthCallback: () => ipcRenderer.removeAllListeners('oauth-callback'),
  
  // Magic Links
  validateMagicLink: (token) => ipcRenderer.invoke('magic-link-validate', token),
  generateMagicLink: (email, provider, purpose) => ipcRenderer.invoke('magic-link-generate', { email, provider, purpose }),
  sendMagicLink: (email, provider, purpose) => ipcRenderer.invoke('magic-link-send', { email, provider, purpose }),
  onMagicLinkCallback: (callback) => ipcRenderer.on('magic-link-callback', callback),
  removeMagicLinkCallback: () => ipcRenderer.removeAllListeners('magic-link-callback'),
  
  // Deep Links
  handleDeepLink: (url) => ipcRenderer.invoke('handle-deep-link', url),
  onDeepLink: (callback) => {
    ipcRenderer.on('deep-link', (event, url) => callback(event, url));
  },
  removeDeepLink: () => ipcRenderer.removeAllListeners('deep-link'),
  
  // Email
  testEmailConnection: (credentials) => ipcRenderer.invoke('email-test-connection', credentials),
  sendEmailSMTP: (credentials, options) => ipcRenderer.invoke('email-send-smtp', credentials, options),
  sendEmailGmail: (credentials, options) => ipcRenderer.invoke('email-send-gmail', credentials, options),
  readEmailsIMAP: (credentials, maxResults) => ipcRenderer.invoke('email-read-imap', credentials, maxResults),
  readEmailsGmail: (credentials, maxResults, query) => ipcRenderer.invoke('email-read-gmail', credentials, maxResults, query),
  getEmailConnection: () => ipcRenderer.invoke('email-get-connection'),
  
  // Window Management
  reloadWindow: () => ipcRenderer.invoke('reload-window'),
  reloadWindowIgnoringCache: () => ipcRenderer.invoke('reload-window-ignoring-cache'),
  
  // WhatsApp Web
  whatsappWebInit: (config) => ipcRenderer.invoke('whatsapp-web-init', config),
  whatsappWebGetStatus: () => ipcRenderer.invoke('whatsapp-web-get-status'),
  whatsappWebRequestPairingCode: (params) => ipcRenderer.invoke('whatsapp-web-request-pairing-code', params),
  whatsappWebSend: (to, content) => ipcRenderer.invoke('whatsapp-web-send', { to, content }),
  whatsappWebDisconnect: () => ipcRenderer.invoke('whatsapp-web-disconnect'),
  onWhatsAppWebQR: (callback) => ipcRenderer.on('whatsapp-web-qr', (event, qr) => callback(event, qr)),
  onWhatsAppWebPairingCode: (callback) => ipcRenderer.on('whatsapp-web-pairing-code', (event, code) => callback(event, code)),
  onWhatsAppWebReady: (callback) => ipcRenderer.on('whatsapp-web-ready', callback),
  onWhatsAppWebAuthFailure: (callback) => ipcRenderer.on('whatsapp-web-auth-failure', (event, msg) => callback(event, msg)),
  onWhatsAppWebDisconnected: (callback) => ipcRenderer.on('whatsapp-web-disconnected', (event, reason) => callback(event, reason)),
  onWhatsAppWebMessage: (callback) => ipcRenderer.on('whatsapp-web-message', (event, msg) => callback(event, msg)),
  removeWhatsAppWebListeners: () => {
    ipcRenderer.removeAllListeners('whatsapp-web-qr');
    ipcRenderer.removeAllListeners('whatsapp-web-pairing-code');
    ipcRenderer.removeAllListeners('whatsapp-web-ready');
    ipcRenderer.removeAllListeners('whatsapp-web-auth-failure');
    ipcRenderer.removeAllListeners('whatsapp-web-disconnected');
    ipcRenderer.removeAllListeners('whatsapp-web-message');
  },
  
  // Path utilities
  getPath: (name) => ipcRenderer.invoke('get-path', name),
  
  // Product Photo Management
  productPhotoUpload: (params) => ipcRenderer.invoke('product-photo-upload', params),
  productPhotoDelete: (params) => ipcRenderer.invoke('product-photo-delete', params),
  productPhotoGetUrl: (params) => ipcRenderer.invoke('product-photo-get-url', params)
});