const winston = require('winston');
const { loadPlatformConnections, savePlatformConnections } = require('../../services/securityService');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

/**
 * OAuth Token Refresh Job
 * Runs every 30 minutes
 * Refreshes OAuth tokens for connected platforms
 */
async function refreshTokens() {
  logger.info('[RefreshTokens] Starting OAuth token refresh...');

  try {
    const connections = loadPlatformConnections();
    if (!connections || connections.length === 0) {
      logger.info('[RefreshTokens] No platform connections to refresh');
      return { success: true, refreshed: 0 };
    }

    let refreshed = 0;
    const { refreshPlatformTokens } = require('../../services/securityService');

    for (const conn of connections) {
      try {
        // Check if token needs refresh (expires in less than 1 hour)
        if (conn.expiresAt && new Date(conn.expiresAt) < new Date(Date.now() + 60 * 60 * 1000)) {
          logger.info(`[RefreshTokens] Refreshing token for ${conn.channel}...`);
          
          const refreshedConn = await refreshPlatformTokens(conn);
          if (refreshedConn) {
            refreshed++;
            logger.info(`[RefreshTokens] ✅ Token refreshed for ${conn.channel}`);
          }
        }
      } catch (error) {
        logger.warn(`[RefreshTokens] Failed to refresh token for ${conn.channel}:`, error.message);
      }
    }

    logger.info(`[RefreshTokens] Refreshed ${refreshed}/${connections.length} tokens`);
    return { success: true, refreshed, total: connections.length };
  } catch (error) {
    logger.error('[RefreshTokens] Error refreshing tokens:', error);
    throw error;
  }
}

module.exports = {
  refreshTokens,
};










