const winston = require('winston');
const Parse = require('parse/node');
const Lead = require('../models/Lead');
const Message = require('../models/Message');
const AnalyticsDaily = require('../models/AnalyticsDaily');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

// Store active subscriptions per client
const subscriptions = new Map();

/**
 * Handle WebSocket messages
 */
async function handleWebSocketMessage(ws, data) {
  const { type, payload } = data;

  switch (type) {
    case 'subscribe:lead-updates':
      await subscribeToLeadUpdates(ws, payload);
      break;
    
    case 'subscribe:dashboard':
      await subscribeToDashboard(ws, payload);
      break;
    
    case 'subscribe:email-ingestion':
      await subscribeToEmailIngestion(ws, payload);
      break;
    
    case 'subscribe:system-status':
      await subscribeToSystemStatus(ws, payload);
      break;
    
    case 'unsubscribe':
      await unsubscribe(ws, payload);
      break;
    
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      break;
    
    default:
      ws.send(JSON.stringify({
        type: 'error',
        error: `Unknown message type: ${type}`,
        timestamp: Date.now(),
      }));
  }
}

/**
 * Subscribe to lead updates
 */
async function subscribeToLeadUpdates(ws, payload) {
  const { leadIds } = payload || {};
  
  if (!leadIds || !Array.isArray(leadIds)) {
    ws.send(JSON.stringify({
      type: 'error',
      error: 'leadIds array is required',
      timestamp: Date.now(),
    }));
    return;
  }

  const subscriptionId = `lead-updates-${ws.clientId}-${Date.now()}`;
  
  // Store subscription
  if (!subscriptions.has(ws.clientId)) {
    subscriptions.set(ws.clientId, []);
  }
  subscriptions.get(ws.clientId).push({
    id: subscriptionId,
    type: 'lead-updates',
    leadIds,
  });

  // Add to ws subscriptions for cleanup
  ws.subscriptions.push(subscriptionId);

  // Send confirmation
  ws.send(JSON.stringify({
    type: 'subscribed',
    subscriptionId,
    subscriptionType: 'lead-updates',
    timestamp: Date.now(),
  }));

  // Start polling for updates (would be replaced with Parse LiveQuery in production)
  startLeadUpdatesPolling(ws, subscriptionId, leadIds);
}

/**
 * Subscribe to dashboard updates
 */
async function subscribeToDashboard(ws, payload) {
  const subscriptionId = `dashboard-${ws.clientId}-${Date.now()}`;
  
  // Store subscription
  if (!subscriptions.has(ws.clientId)) {
    subscriptions.set(ws.clientId, []);
  }
  subscriptions.get(ws.clientId).push({
    id: subscriptionId,
    type: 'dashboard',
  });

  ws.subscriptions.push(subscriptionId);

  // Send confirmation
  ws.send(JSON.stringify({
    type: 'subscribed',
    subscriptionId,
    subscriptionType: 'dashboard',
    timestamp: Date.now(),
  }));

  // Start sending dashboard updates
  startDashboardUpdates(ws, subscriptionId);
}

/**
 * Subscribe to email ingestion updates
 */
async function subscribeToEmailIngestion(ws, payload) {
  const subscriptionId = `email-ingestion-${ws.clientId}-${Date.now()}`;
  
  // Store subscription
  if (!subscriptions.has(ws.clientId)) {
    subscriptions.set(ws.clientId, []);
  }
  subscriptions.get(ws.clientId).push({
    id: subscriptionId,
    type: 'email-ingestion',
  });

  ws.subscriptions.push(subscriptionId);

  // Send confirmation
  ws.send(JSON.stringify({
    type: 'subscribed',
    subscriptionId,
    subscriptionType: 'email-ingestion',
    timestamp: Date.now(),
  }));
}

/**
 * Subscribe to system status updates
 */
async function subscribeToSystemStatus(ws, payload) {
  const subscriptionId = `system-status-${ws.clientId}-${Date.now()}`;
  
  // Store subscription
  if (!subscriptions.has(ws.clientId)) {
    subscriptions.set(ws.clientId, []);
  }
  subscriptions.get(ws.clientId).push({
    id: subscriptionId,
    type: 'system-status',
  });

  ws.subscriptions.push(subscriptionId);

  // Send confirmation
  ws.send(JSON.stringify({
    type: 'subscribed',
    subscriptionId,
    subscriptionType: 'system-status',
    timestamp: Date.now(),
  }));

  // Start sending system status updates
  startSystemStatusUpdates(ws, subscriptionId);
}

/**
 * Unsubscribe from a subscription
 */
async function unsubscribe(ws, payload) {
  const { subscriptionId } = payload || {};
  
  if (!subscriptionId) {
    ws.send(JSON.stringify({
      type: 'error',
      error: 'subscriptionId is required',
      timestamp: Date.now(),
    }));
    return;
  }

  // Remove from subscriptions
  if (subscriptions.has(ws.clientId)) {
    const clientSubs = subscriptions.get(ws.clientId);
    const index = clientSubs.findIndex(s => s.id === subscriptionId);
    if (index !== -1) {
      clientSubs.splice(index, 1);
    }
  }

  // Remove from ws subscriptions
  const wsIndex = ws.subscriptions.indexOf(subscriptionId);
  if (wsIndex !== -1) {
    ws.subscriptions.splice(wsIndex, 1);
  }

  // Stop polling/updates for this subscription
  if (ws.pollingIntervals) {
    const interval = ws.pollingIntervals[subscriptionId];
    if (interval) {
      clearInterval(interval);
      delete ws.pollingIntervals[subscriptionId];
    }
  }

  ws.send(JSON.stringify({
    type: 'unsubscribed',
    subscriptionId,
    timestamp: Date.now(),
  }));
}

/**
 * Start polling for lead updates (temporary - would use Parse LiveQuery)
 */
function startLeadUpdatesPolling(ws, subscriptionId, leadIds) {
  if (!ws.pollingIntervals) {
    ws.pollingIntervals = {};
  }

  const interval = setInterval(async () => {
    try {
      // Query for updated leads
      const query = new Parse.Query(Lead);
      query.containedIn('objectId', leadIds);
      query.descending('updatedAt');
      query.limit(10);
      
      const leads = await query.find({ useMasterKey: true });
      
      if (leads.length > 0) {
        const updates = leads.map(l => ({
          id: l.id,
          status: l.get('status'),
          leadScore: l.get('leadScore'),
          lastContacted: l.get('lastContacted'),
          updatedAt: l.get('updatedAt'),
        }));

        ws.send(JSON.stringify({
          type: 'lead-updates',
          subscriptionId,
          data: updates,
          timestamp: Date.now(),
        }));
      }
    } catch (error) {
      logger.error(`[WebSocket] Error polling lead updates:`, error);
    }
  }, 5000); // Poll every 5 seconds

  ws.pollingIntervals[subscriptionId] = interval;
}

/**
 * Start sending dashboard updates
 */
function startDashboardUpdates(ws, subscriptionId) {
  if (!ws.pollingIntervals) {
    ws.pollingIntervals = {};
  }

  const interval = setInterval(async () => {
    try {
      // Get dashboard metrics
      const leadsQuery = new Parse.Query(Lead);
      leadsQuery.notEqualTo('archived', true);
      const totalLeads = await leadsQuery.count({ useMasterKey: true });

      // Get recent analytics
      const analyticsQuery = new Parse.Query(AnalyticsDaily);
      analyticsQuery.descending('date');
      analyticsQuery.limit(1);
      const latest = await analyticsQuery.first({ useMasterKey: true });

      ws.send(JSON.stringify({
        type: 'dashboard-update',
        subscriptionId,
        data: {
          totalLeads,
          lastAnalyticsUpdate: latest ? latest.get('date') : null,
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      }));
    } catch (error) {
      logger.error(`[WebSocket] Error sending dashboard update:`, error);
    }
  }, 5000); // Update every 5 seconds

  ws.pollingIntervals[subscriptionId] = interval;
}

/**
 * Start sending system status updates
 */
function startSystemStatusUpdates(ws, subscriptionId) {
  if (!ws.pollingIntervals) {
    ws.pollingIntervals = {};
  }

  const interval = setInterval(async () => {
    try {
      ws.send(JSON.stringify({
        type: 'system-status-update',
        subscriptionId,
        data: {
          status: 'healthy',
          timestamp: Date.now(),
        },
        timestamp: Date.now(),
      }));
    } catch (error) {
      logger.error(`[WebSocket] Error sending system status update:`, error);
    }
  }, 10000); // Update every 10 seconds

  ws.pollingIntervals[subscriptionId] = interval;
}

module.exports = {
  handleWebSocketMessage,
};

