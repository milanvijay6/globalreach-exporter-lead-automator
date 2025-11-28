import { OwnerAuthService } from './ownerAuthService';
import { PlatformService } from './platformService';
import { Logger } from './loggerService';

const STORAGE_KEY_SOURCE_ACCESS_TOKENS = 'globalreach_source_access_tokens';
const SOURCE_ACCESS_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface SourceAccessToken {
  token: string;
  expiresAt: number;
  grantedAt: number;
}

// In-memory store for active tokens
const activeTokens = new Map<string, SourceAccessToken>();

/**
 * Source Code Protection Service
 * Manages access to source code, config files, and logs with owner re-authentication
 */
export const SourceCodeProtectionService = {
  /**
   * Requests source code access (requires owner re-authentication)
   */
  requestSourceCodeAccess: async (
    ownerEmail: string,
    ownerPassword: string
  ): Promise<{ granted: boolean; token?: string; error?: string }> => {
    try {
      // Verify owner credentials
      const isValid = await OwnerAuthService.verifyOwnerCredentials(ownerEmail, ownerPassword);
      if (!isValid) {
        return { granted: false, error: 'Invalid owner credentials' };
      }

      // Generate access token
      const token = `src-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const accessToken: SourceAccessToken = {
        token,
        expiresAt: Date.now() + SOURCE_ACCESS_DURATION_MS,
        grantedAt: Date.now(),
      };

      // Store token
      activeTokens.set(token, accessToken);
      
      // Also persist to storage
      const stored = await PlatformService.secureLoad(STORAGE_KEY_SOURCE_ACCESS_TOKENS);
      const tokens: Record<string, SourceAccessToken> = stored ? JSON.parse(stored) : {};
      tokens[token] = accessToken;
      await PlatformService.secureSave(STORAGE_KEY_SOURCE_ACCESS_TOKENS, JSON.stringify(tokens));

      Logger.info('[SourceCodeProtectionService] Source code access granted');
      return { granted: true, token };
    } catch (error: any) {
      Logger.error('[SourceCodeProtectionService] Failed to grant access:', error);
      return { granted: false, error: error.message || 'Failed to grant access' };
    }
  },

  /**
   * Verifies a source code access token
   */
  verifySourceCodeAccessToken: (token: string): boolean => {
    const accessToken = activeTokens.get(token);
    
    if (!accessToken) {
      // Try loading from storage
      return false;
    }

    // Check if expired
    if (accessToken.expiresAt < Date.now()) {
      activeTokens.delete(token);
      return false;
    }

    return true;
  },

  /**
   * Gets protected paths that require owner authentication
   */
  getProtectedPaths: (): string[] => {
    return [
      'config',
      'logs',
      'source',
      'scripts',
      'electron/main.js',
      'electron/preload.js',
      '.env',
      'package.json',
    ];
  },

  /**
   * Checks if a path is protected
   */
    isPathProtected: (path: string): boolean => {
      const protectedPaths = SourceCodeProtectionService.getProtectedPaths();
      return protectedPaths.some(protectedPath => path.includes(protectedPath));
    },

  /**
   * Cleans up expired tokens
   */
  cleanupExpiredTokens: async (): Promise<void> => {
    try {
      const now = Date.now();
      const expired: string[] = [];

      for (const [token, accessToken] of activeTokens.entries()) {
        if (accessToken.expiresAt < now) {
          expired.push(token);
        }
      }

      expired.forEach(token => activeTokens.delete(token));

      // Also clean up storage
      const stored = await PlatformService.secureLoad(STORAGE_KEY_SOURCE_ACCESS_TOKENS);
      if (stored) {
        const tokens: Record<string, SourceAccessToken> = JSON.parse(stored);
        const filtered: Record<string, SourceAccessToken> = {};
        
        for (const [token, accessToken] of Object.entries(tokens)) {
          if (accessToken.expiresAt >= now) {
            filtered[token] = accessToken;
          }
        }
        
        await PlatformService.secureSave(STORAGE_KEY_SOURCE_ACCESS_TOKENS, JSON.stringify(filtered));
      }
    } catch (error) {
      Logger.error('[SourceCodeProtectionService] Failed to cleanup tokens:', error);
    }
  },

  /**
   * Revokes a source code access token
   */
  revokeToken: async (token: string): Promise<void> => {
    activeTokens.delete(token);
    
    const stored = await PlatformService.secureLoad(STORAGE_KEY_SOURCE_ACCESS_TOKENS);
    if (stored) {
      const tokens: Record<string, SourceAccessToken> = JSON.parse(stored);
      delete tokens[token];
      await PlatformService.secureSave(STORAGE_KEY_SOURCE_ACCESS_TOKENS, JSON.stringify(tokens));
    }
  },
};

