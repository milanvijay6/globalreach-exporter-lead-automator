const WebSocket = require('ws');
const http = require('http');
const winston = require('winston');
const { handleWebSocketMessage } = require('./handlers');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

let wss = null;

/**
 * Initialize WebSocket server
 */
function initializeWebSocketServer(server) {
  if (!server) {
    logger.warn('[WebSocket] No HTTP server provided, WebSocket server not initialized');
    return null;
  }

  try {
    wss = new WebSocket.Server({ 
      server,
      path: process.env.WS_ENDPOINT || '/ws',
    });

    wss.on('connection', (ws, req) => {
      const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      ws.clientId = clientId;
      ws.userId = req.headers['x-user-id'] || null;
      
      logger.info(`[WebSocket] Client connected: ${clientId} (User: ${ws.userId || 'anonymous'})`);

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        clientId,
        timestamp: Date.now(),
      }));

      // Handle messages
      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          await handleWebSocketMessage(ws, data);
        } catch (error) {
          logger.error(`[WebSocket] Error handling message from ${clientId}:`, error);
          ws.send(JSON.stringify({
            type: 'error',
            error: error.message || 'Invalid message format',
            timestamp: Date.now(),
          }));
        }
      });

      // Handle close
      ws.on('close', () => {
        logger.info(`[WebSocket] Client disconnected: ${clientId}`);
        // Cleanup subscriptions
        if (ws.subscriptions) {
          ws.subscriptions.forEach(sub => {
            // Unsubscribe logic would go here
          });
        }
      });

      // Handle errors
      ws.on('error', (error) => {
        logger.error(`[WebSocket] Error for client ${clientId}:`, error);
      });

      // Initialize subscriptions array
      ws.subscriptions = [];
    });

    logger.info(`[WebSocket] ✅ WebSocket server initialized on path: ${process.env.WS_ENDPOINT || '/ws'}`);
    return wss;
  } catch (error) {
    logger.error('[WebSocket] Failed to initialize WebSocket server:', error);
    return null;
  }
}

/**
 * Broadcast message to all connected clients
 */
function broadcast(data, filter = null) {
  if (!wss) {
    return;
  }

  const message = JSON.stringify(data);
  let count = 0;

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      // Apply filter if provided
      if (!filter || filter(client)) {
        client.send(message);
        count++;
      }
    }
  });

  logger.debug(`[WebSocket] Broadcasted to ${count} clients`);
}

/**
 * Send message to specific user
 */
function sendToUser(userId, data) {
  if (!wss) {
    return;
  }

  const message = JSON.stringify(data);
  let count = 0;

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.userId === userId) {
      client.send(message);
      count++;
    }
  });

  logger.debug(`[WebSocket] Sent to ${count} clients for user ${userId}`);
}

/**
 * Get connected clients count
 */
function getConnectedCount() {
  if (!wss) {
    return 0;
  }

  let count = 0;
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      count++;
    }
  });

  return count;
}

module.exports = {
  initializeWebSocketServer,
  broadcast,
  sendToUser,
  getConnectedCount,
  getServer: () => wss,
};

