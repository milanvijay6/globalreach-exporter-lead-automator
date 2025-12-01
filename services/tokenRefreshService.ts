import { Logger } from './loggerService';
import { refreshIntegrationToken } from './securityService';
import { IntegrationServiceFactory } from './integrationService';

/**
 * Token Refresh Service
 * Background service that automatically refreshes tokens for all connected integrations
 */
class TokenRefreshServiceImpl {
  private refreshInterval: NodeJS.Timeout | null = null;
  private readonly REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  private readonly REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000; // Refresh 5 minutes before expiry

  /**
   * Start the token refresh service
   */
  start(): void {
    if (this.refreshInterval) {
      Logger.warn('[TokenRefreshService] Service already running');
      return;
    }

    Logger.info('[TokenRefreshService] Starting token refresh service');
    
    // Initial check
    this.checkAndRefreshTokens();
    
    // Set up interval
    this.refreshInterval = setInterval(() => {
      this.checkAndRefreshTokens();
    }, this.REFRESH_INTERVAL_MS);
  }

  /**
   * Stop the token refresh service
   */
  stop(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      Logger.info('[TokenRefreshService] Token refresh service stopped');
    }
  }

  /**
   * Check all connected integrations and refresh tokens if needed
   */
  private async checkAndRefreshTokens(): Promise<void> {
    try {
      const services: Array<'outlook' | 'whatsapp' | 'wechat'> = ['outlook', 'whatsapp', 'wechat'];
      
      for (const service of services) {
        try {
          const integrationService = IntegrationServiceFactory.getService(service);
          const status = await integrationService.getStatus();
          
          if (!status.isConnected) {
            continue; // Skip disconnected services
          }
          
          // Check if token needs refresh
          if (status.tokenExpiry) {
            const now = Date.now();
            const timeUntilExpiry = status.tokenExpiry - now;
            
            // Refresh if token expires within REFRESH_BEFORE_EXPIRY_MS
            if (timeUntilExpiry > 0 && timeUntilExpiry <= this.REFRESH_BEFORE_EXPIRY_MS) {
              Logger.info(`[TokenRefreshService] Refreshing ${service} token (expires in ${Math.round(timeUntilExpiry / 1000)}s)`);
              
              try {
                const newTokens = await refreshIntegrationToken(service);
                if (newTokens) {
                  Logger.info(`[TokenRefreshService] Successfully refreshed ${service} token`);
                } else {
                  Logger.warn(`[TokenRefreshService] Failed to refresh ${service} token: No tokens returned`);
                }
              } catch (error: any) {
                Logger.error(`[TokenRefreshService] Failed to refresh ${service} token:`, error);
                // Update status to error
                await this.updateServiceHealth(service, 'error', error.message);
              }
            } else if (timeUntilExpiry <= 0) {
              // Token already expired
              Logger.warn(`[TokenRefreshService] ${service} token has expired`);
              await this.updateServiceHealth(service, 'error', 'Token expired');
            }
          } else if (service === 'wechat') {
            // WeChat tokens expire in 2 hours, refresh proactively
            try {
              const newTokens = await refreshIntegrationToken(service);
              if (newTokens) {
                Logger.info(`[TokenRefreshService] Successfully refreshed ${service} token`);
              }
            } catch (error: any) {
              Logger.error(`[TokenRefreshService] Failed to refresh ${service} token:`, error);
            }
          }
        } catch (error: any) {
          Logger.error(`[TokenRefreshService] Error checking ${service}:`, error);
        }
      }
    } catch (error: any) {
      Logger.error('[TokenRefreshService] Error in checkAndRefreshTokens:', error);
    }
  }

  /**
   * Update service health status
   */
  private async updateServiceHealth(
    service: 'outlook' | 'whatsapp' | 'wechat',
    healthStatus: 'healthy' | 'error',
    errorMessage?: string
  ): Promise<void> {
    try {
      const { loadPlatformConnections, savePlatformConnection, loadEmailConnection, saveEmailConnection } = await import('./securityService');
      const { Channel, PlatformStatus } = await import('../types');
      
      if (service === 'outlook') {
        const conn = await loadEmailConnection();
        if (conn) {
          await saveEmailConnection({
            ...conn,
            healthStatus,
          });
        }
      } else {
        const connections = await loadPlatformConnections();
        const conn = connections.find(c => c.channel === (service === 'whatsapp' ? Channel.WHATSAPP : Channel.WECHAT));
        if (conn) {
          await savePlatformConnection({
            ...conn,
            healthStatus,
          });
        }
      }
    } catch (error: any) {
      Logger.error(`[TokenRefreshService] Failed to update ${service} health:`, error);
    }
  }

  /**
   * Manually trigger a refresh for a specific service
   */
  async refreshService(service: 'outlook' | 'whatsapp' | 'wechat'): Promise<boolean> {
    try {
      Logger.info(`[TokenRefreshService] Manually refreshing ${service} token`);
      const newTokens = await refreshIntegrationToken(service);
      if (newTokens) {
        Logger.info(`[TokenRefreshService] Successfully refreshed ${service} token`);
        await this.updateServiceHealth(service, 'healthy');
        return true;
      }
      return false;
    } catch (error: any) {
      Logger.error(`[TokenRefreshService] Failed to refresh ${service} token:`, error);
      await this.updateServiceHealth(service, 'error', error.message);
      return false;
    }
  }
}

// Singleton instance
let tokenRefreshServiceInstance: TokenRefreshServiceImpl | null = null;

export const TokenRefreshService = {
  getInstance: (): TokenRefreshServiceImpl => {
    if (!tokenRefreshServiceInstance) {
      tokenRefreshServiceInstance = new TokenRefreshServiceImpl();
    }
    return tokenRefreshServiceInstance;
  },
};

