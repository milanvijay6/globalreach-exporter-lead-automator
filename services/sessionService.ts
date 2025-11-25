import { User } from '../types';
import { PlatformService } from './platformService';
import { Logger } from './loggerService';

const STORAGE_KEY_SESSION_TOKENS = 'globalreach_session_tokens';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000; // Refresh if less than 1 day remaining

interface SessionToken {
  token: string;
  userId: string;
  expiresAt: number;
  issuedAt: number;
  refreshToken: string;
}

// In-memory token store
const activeTokens = new Map<string, SessionToken>();

/**
 * Session Service
 * Manages JWT-like session tokens for user authentication
 */
export const SessionService = {
  /**
   * Generates a session token for a user
   */
  generateSessionToken: (user: User): string => {
    const token = `sess-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const refreshToken = `refresh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const sessionToken: SessionToken = {
      token,
      userId: user.id,
      expiresAt: Date.now() + SESSION_DURATION_MS,
      issuedAt: Date.now(),
      refreshToken,
    };

    activeTokens.set(token, sessionToken);
    return token;
  },

  /**
   * Verifies a session token
   */
  verifySessionToken: async (token: string): Promise<{ valid: boolean; user?: User }> => {
    try {
      const sessionToken = activeTokens.get(token);
      
      if (!sessionToken) {
        // Try loading from storage
        const stored = await PlatformService.secureLoad(STORAGE_KEY_SESSION_TOKENS);
        if (stored) {
          const tokens: Record<string, SessionToken> = JSON.parse(stored);
          const storedToken = tokens[token];
          
          if (storedToken && storedToken.expiresAt > Date.now()) {
            activeTokens.set(token, storedToken);
            const { UserService } = await import('./userService');
            const user = await UserService.getUser(storedToken.userId);
            return { valid: !!user, user: user || undefined };
          }
        }
        return { valid: false };
      }

      // Check if expired
      if (sessionToken.expiresAt < Date.now()) {
        activeTokens.delete(token);
        return { valid: false };
      }

      // Load user
      const { UserService } = await import('./userService');
      const user = await UserService.getUser(sessionToken.userId);
      
      return { valid: !!user, user: user || undefined };
    } catch (error) {
      Logger.error('[SessionService] Token verification error:', error);
      return { valid: false };
    }
  },

  /**
   * Refreshes a session token
   */
  refreshSessionToken: async (token: string): Promise<string | null> => {
    try {
      const sessionToken = activeTokens.get(token);
      if (!sessionToken) {
        return null;
      }

      // Check if token is close to expiry
      const timeUntilExpiry = sessionToken.expiresAt - Date.now();
      if (timeUntilExpiry > REFRESH_THRESHOLD_MS) {
        return token; // Still valid, no need to refresh
      }

      // Generate new token
      const { UserService } = await import('./userService');
      const user = await UserService.getUser(sessionToken.userId);
      if (!user) {
        return null;
      }

      const newToken = SessionService.generateSessionToken(user);
      
      // Remove old token
      activeTokens.delete(token);
      
      // Save to storage
      await SessionService.persistTokens();
      
      return newToken;
    } catch (error) {
      Logger.error('[SessionService] Token refresh error:', error);
      return null;
    }
  },

  /**
   * Persists tokens to storage
   */
  persistTokens: async (): Promise<void> => {
    try {
      const tokens: Record<string, SessionToken> = {};
      for (const [token, sessionToken] of activeTokens.entries()) {
        tokens[token] = sessionToken;
      }
      await PlatformService.secureSave(STORAGE_KEY_SESSION_TOKENS, JSON.stringify(tokens));
    } catch (error) {
      Logger.error('[SessionService] Failed to persist tokens:', error);
    }
  },

  /**
   * Loads tokens from storage
   */
  loadTokens: async (): Promise<void> => {
    try {
      const stored = await PlatformService.secureLoad(STORAGE_KEY_SESSION_TOKENS);
      if (stored) {
        const tokens: Record<string, SessionToken> = JSON.parse(stored);
        const now = Date.now();
        
        // Only load non-expired tokens
        for (const [token, sessionToken] of Object.entries(tokens)) {
          if (sessionToken.expiresAt > now) {
            activeTokens.set(token, sessionToken);
          }
        }
      }
    } catch (error) {
      Logger.error('[SessionService] Failed to load tokens:', error);
    }
  },

  /**
   * Revokes a session token
   */
  revokeToken: async (token: string): Promise<void> => {
    activeTokens.delete(token);
    await SessionService.persistTokens();
  },
};

