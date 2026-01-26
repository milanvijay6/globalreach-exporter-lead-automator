const appInsights = require('applicationinsights');
const winston = require('winston');

// Logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

let initialized = false;

/**
 * Initialize Azure Application Insights
 * Automatically tracks requests, dependencies, exceptions, and custom metrics
 */
function initializeApplicationInsights() {
  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  
  if (!connectionString) {
    logger.info('[AppInsights] Not initialized - APPLICATIONINSIGHTS_CONNECTION_STRING not set');
    logger.info('[AppInsights] Add connection string in Azure Portal to enable monitoring');
    return false;
  }

  if (initialized) {
    logger.info('[AppInsights] Already initialized');
    return true;
  }

  try {
    appInsights.setup(connectionString)
      .setAutoDependencyCorrelation(true)
      .setAutoCollectRequests(true)
      .setAutoCollectPerformance(true, true)
      .setAutoCollectExceptions(true)
      .setAutoCollectDependencies(true)
      .setAutoCollectConsole(true, true)
      .setUseDiskRetryCaching(true)
      .setSendLiveMetrics(true)
      .setDistributedTracingMode(appInsights.DistributedTracingModes.AI_AND_W3C)
      .start();
    
    // Set cloud role name for better identification in Azure
    appInsights.defaultClient.context.tags[appInsights.defaultClient.context.keys.cloudRole] = 'GlobalReach-CRM';
    
    initialized = true;
    logger.info('[AppInsights] ✅ Application Insights initialized successfully');
    return true;
  } catch (error) {
    logger.error('[AppInsights] ❌ Failed to initialize:', error.message);
    return false;
  }
}

/**
 * Get Application Insights client for custom telemetry
 */
function getClient() {
  if (!initialized) {
    return null;
  }
  return appInsights.defaultClient;
}

/**
 * Track custom event
 */
function trackEvent(name, properties = {}) {
  const client = getClient();
  if (client) {
    client.trackEvent({ name, properties });
  }
}

/**
 * Track custom metric
 */
function trackMetric(name, value, properties = {}) {
  const client = getClient();
  if (client) {
    client.trackMetric({ name, value, properties });
  }
}

module.exports = {
  initializeApplicationInsights,
  getClient,
  trackEvent,
  trackMetric,
  isInitialized: () => initialized
};
