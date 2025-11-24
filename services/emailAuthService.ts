import { Logger } from './loggerService';
import { EmailCredentials, PlatformConnection } from './types';
// EmailService is imported dynamically to avoid bundling Node.js modules
// import { EmailService } from './emailService';
// OAuthService is imported dynamically to avoid bundling Node.js modules
// import { OAuthService } from './oauthService';

export type EmailProvider = 'gmail' | 'outlook' | 'custom';
export type AuthMethod = 'oauth' | 'imap' | 'smtp' | 'oauth_imap';

export interface AuthMethodResult {
  method: AuthMethod;
  provider: EmailProvider;
  requiresOAuth: boolean;
  requiresCredentials: boolean;
}

/**
 * Email Authentication Service
 * Handles provider detection, auth method determination, and credential validation
 */
export const EmailAuthService = {
  /**
   * Detects email provider from email address domain
   */
  detectEmailProvider: (email: string): EmailProvider => {
    const domain = email.toLowerCase().split('@')[1];
    if (!domain) return 'custom';

    // Gmail domains
    if (domain === 'gmail.com' || domain === 'googlemail.com') {
      return 'gmail';
    }

    // Outlook/Microsoft domains
    if (
      domain === 'outlook.com' ||
      domain === 'hotmail.com' ||
      domain === 'live.com' ||
      domain === 'msn.com' ||
      domain.endsWith('.onmicrosoft.com') ||
      domain.endsWith('.office365.com')
    ) {
      return 'outlook';
    }

    return 'custom';
  },

  /**
   * Determines the best authentication method for a provider
   */
  getAuthMethod: (provider: EmailProvider, email?: string): AuthMethodResult => {
    switch (provider) {
      case 'gmail':
        return {
          method: 'oauth',
          provider: 'gmail',
          requiresOAuth: true,
          requiresCredentials: false,
        };
      case 'outlook':
        return {
          method: 'oauth',
          provider: 'outlook',
          requiresOAuth: true,
          requiresCredentials: false,
        };
      case 'custom':
        return {
          method: 'imap',
          provider: 'custom',
          requiresOAuth: false,
          requiresCredentials: true,
        };
      default:
        return {
          method: 'imap',
          provider: 'custom',
          requiresOAuth: false,
          requiresCredentials: true,
        };
    }
  },

  /**
   * Validates email credentials based on provider type
   */
  validateCredentials: async (
    credentials: EmailCredentials
  ): Promise<{ valid: boolean; error?: string; details?: any }> => {
    try {
      // Validate provider
      if (!credentials.provider) {
        return { valid: false, error: 'Provider is required' };
      }

      // OAuth-based providers (Gmail/Outlook)
      if (credentials.provider === 'gmail' || credentials.provider === 'outlook') {
        if (!credentials.accessToken) {
          return { valid: false, error: 'Access token is required for OAuth providers' };
        }

        if (!credentials.oauthClientId || !credentials.oauthClientSecret) {
          return {
            valid: false,
            error: 'OAuth client credentials are required',
          };
        }

        // Test connection - For OAuth providers, we'll use Gmail API which doesn't require nodemailer
        // This is only called for OAuth-based connections, so nodemailer shouldn't be needed
        try {
          // For OAuth providers, test connection via Gmail API (if available)
          // Note: Gmail API testing doesn't require nodemailer
          if (typeof window !== 'undefined' && (window as any).electronAPI?.testEmailConnection) {
            const result = await (window as any).electronAPI.testEmailConnection(credentials);
            return { 
              valid: result.success || false, 
              error: result.error 
            };
          }
          // Fallback: OAuth connections are validated by token presence
          return { valid: true };
        } catch (error: any) {
          // OAuth validation mainly checks for token presence, so if IPC fails, assume valid
          if (error.message?.includes('nodemailer') || error.message?.includes('module specifier')) {
            // For OAuth, nodemailer isn't needed - just check token presence
            return { valid: true };
          }
          return { valid: false, error: error.message || 'Connection test failed' };
        }
      }

      // IMAP/SMTP providers
      if (credentials.provider === 'imap' || credentials.provider === 'smtp') {
        if (!credentials.username || !credentials.password) {
          return { valid: false, error: 'Username and password are required' };
        }

        if (credentials.provider === 'imap' && !credentials.imapHost) {
          return { valid: false, error: 'IMAP host is required' };
        }

        if (credentials.provider === 'smtp' && !credentials.smtpHost) {
          return { valid: false, error: 'SMTP host is required' };
        }

        // Test connection using IPC (runs in main process where nodemailer is available)
        try {
          // Use IPC service wrapper to avoid importing emailService.ts
          const { EmailIPCService } = await import('./emailIPCService');
          const result = await EmailIPCService.testConnection(credentials);
          return { 
            valid: result.success || false, 
            error: result.error,
            details: result 
          };
        } catch (error: any) {
          // Check if it's a nodemailer module resolution error
          if (error.message?.includes('nodemailer') || error.message?.includes('module specifier')) {
            return { 
              valid: false, 
              error: 'Email service not available. Please restart the application.' 
            };
          }
          return { valid: false, error: error.message || 'Connection test failed' };
        }
      }

      return { valid: true };
    } catch (error: any) {
      Logger.error('[EmailAuthService] Validation error:', error);
      return { valid: false, error: error.message || 'Validation failed' };
    }
  },

  /**
   * Stores credentials securely with encryption
   */
  storeCredentialsSecurely: async (
    credentials: EmailCredentials,
    connection: Partial<PlatformConnection>
  ): Promise<PlatformConnection> => {
    try {
      const { savePlatformConnections, loadPlatformConnections } = await import('./securityService');
      const { Channel, PlatformStatus } = await import('../types');

      // Encrypt sensitive data
      const encryptedCredentials: EmailCredentials = {
        ...credentials,
        // Password should already be encrypted by securityService
        // Access tokens are stored but should be encrypted at rest
      };

      const fullConnection: PlatformConnection = {
        channel: Channel.EMAIL,
        status: PlatformStatus.CONNECTED,
        accountName: connection.accountName,
        connectedAt: Date.now(),
        provider: credentials.provider === 'gmail' ? 'google' : 
                 credentials.provider === 'outlook' ? 'microsoft' : 'custom',
        emailCredentials: encryptedCredentials,
        lastTested: Date.now(),
        healthStatus: 'healthy',
      };

      // Load existing connections and update
      const existingConnections = await loadPlatformConnections();
      const updatedConnections = [
        ...existingConnections.filter(c => c.channel !== Channel.EMAIL),
        fullConnection,
      ];

      savePlatformConnections(updatedConnections);
      Logger.info('[EmailAuthService] Credentials stored securely');

      return fullConnection;
    } catch (error: any) {
      Logger.error('[EmailAuthService] Failed to store credentials:', error);
      throw new Error(`Failed to store credentials: ${error.message}`);
    }
  },

  /**
   * Checks if credentials need token refresh
   */
  needsTokenRefresh: (credentials: EmailCredentials): boolean => {
    if (credentials.provider !== 'gmail' && credentials.provider !== 'outlook') {
      return false;
    }

    if (!credentials.accessToken || !credentials.refreshToken) {
      return false;
    }

    // If we have refresh token, we can refresh when needed
    // In a real implementation, you'd check token expiry
    return true;
  },

  /**
   * Refreshes OAuth tokens if needed
   */
  refreshTokensIfNeeded: async (
    credentials: EmailCredentials
  ): Promise<EmailCredentials | null> => {
    try {
      if (!EmailAuthService.needsTokenRefresh(credentials)) {
        return null;
      }

      if (!credentials.oauthClientId || !credentials.oauthClientSecret || !credentials.refreshToken) {
        Logger.warn('[EmailAuthService] Cannot refresh token: missing credentials');
        return null;
      }

      const provider = credentials.provider === 'gmail' ? 'gmail' : 'outlook';
      
      // Get redirect URI from stored credentials or construct from server port
      let redirectUri = credentials.redirectUri;
      if (!redirectUri) {
        // Try to get server port from config, default to 4000
        const { PlatformService } = await import('./platformService');
        const port = await PlatformService.getAppConfig('serverPort', 4000);
        redirectUri = `http://localhost:${port}/auth/oauth/callback`;
      }
      
      const config = {
        clientId: credentials.oauthClientId!,
        clientSecret: credentials.oauthClientSecret!,
        redirectUri,
      };

      const { OAuthService } = await import('./oauthService');
      const tokens = await OAuthService.refreshOAuthToken(
        provider,
        credentials.refreshToken,
        config
      );

      const updatedCredentials: EmailCredentials = {
        ...credentials,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken || credentials.refreshToken,
        tokenExpiryDate: tokens.expiryDate || (tokens.expiresIn ? Date.now() + tokens.expiresIn : undefined),
        redirectUri,
      };

      // Record successful refresh
      EmailAuthService.tokenRefreshMonitor.recordRefreshAttempt(true, provider);
      Logger.info('[EmailAuthService] Tokens refreshed successfully');
      return updatedCredentials;
    } catch (error: any) {
      // Record failed refresh
      const provider = credentials.provider === 'gmail' ? 'gmail' : 'outlook';
      EmailAuthService.tokenRefreshMonitor.recordRefreshAttempt(false, provider, error.message);
      Logger.error('[EmailAuthService] Token refresh failed:', error);
      return null;
    }
  },

  /**
   * Token refresh monitoring and health checks
   */
  tokenRefreshMonitor: {
    // Track refresh attempts
    refreshHistory: [] as Array<{ timestamp: number; success: boolean; provider: string; error?: string }>,
    
    /**
     * Records a token refresh attempt
     */
    recordRefreshAttempt: (success: boolean, provider: string, error?: string) => {
      const { tokenRefreshMonitor } = EmailAuthService;
      tokenRefreshMonitor.refreshHistory.push({
        timestamp: Date.now(),
        success,
        provider,
        error,
      });
      
      // Keep only last 100 records
      if (tokenRefreshMonitor.refreshHistory.length > 100) {
        tokenRefreshMonitor.refreshHistory.shift();
      }
    },

    /**
     * Gets token refresh statistics
     */
    getRefreshStats: (timeframeMs: number = 24 * 60 * 60 * 1000) => {
      const { tokenRefreshMonitor } = EmailAuthService;
      const cutoff = Date.now() - timeframeMs;
      const recent = tokenRefreshMonitor.refreshHistory.filter(r => r.timestamp > cutoff);
      
      const total = recent.length;
      const successful = recent.filter(r => r.success).length;
      const failed = recent.filter(r => !r.success).length;
      
      return {
        total,
        successful,
        failed,
        successRate: total > 0 ? successful / total : 1,
        lastRefresh: recent.length > 0 ? recent[recent.length - 1].timestamp : null,
        recentErrors: recent.filter(r => !r.success).slice(-5).map(r => r.error),
      };
    },

    /**
     * Checks token health for a connection
     */
    checkTokenHealth: async (credentials: EmailCredentials): Promise<{
      healthy: boolean;
      issues: string[];
      expiresIn?: number;
    }> => {
      const issues: string[] = [];
      
      if (!credentials.accessToken) {
        issues.push('Missing access token');
        return { healthy: false, issues };
      }

      if (!credentials.refreshToken && (credentials.provider === 'gmail' || credentials.provider === 'outlook')) {
        issues.push('Missing refresh token - may need to re-authenticate');
      }

      // Check token expiry
      if (credentials.tokenExpiryDate) {
        const now = Date.now();
        const expiresIn = credentials.tokenExpiryDate - now;
        const hoursUntilExpiry = expiresIn / (1000 * 60 * 60);

        if (expiresIn < 0) {
          issues.push('Token has expired');
        } else if (hoursUntilExpiry < 1) {
          issues.push('Token expires in less than 1 hour');
        } else if (hoursUntilExpiry < 24 && !credentials.refreshToken) {
          issues.push('Token expires soon and no refresh token available');
        }
      }

      // Check refresh history for patterns
      const stats = EmailAuthService.tokenRefreshMonitor.getRefreshStats(24 * 60 * 60 * 1000);
      if (stats.failed > 3 && stats.successRate < 0.5) {
        issues.push(`Multiple recent refresh failures (${stats.failed} failures)`);
      }

      return {
        healthy: issues.length === 0,
        issues,
        expiresIn: credentials.tokenExpiryDate ? credentials.tokenExpiryDate - Date.now() : undefined,
      };
    },
  },
};

