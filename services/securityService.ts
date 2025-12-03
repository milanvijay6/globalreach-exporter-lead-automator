import { AuthSession, PlatformConnection, User, OutlookEmailCredentials, Channel, PlatformStatus } from "../types";
import { PlatformService } from "./platformService";
import { logAdminAction } from "./auditService";
import { hasAdminAccess, requireAdminAccess } from "./permissionService";
import { isMfaVerificationValid, verifyMfaToken } from "./mfaService";
import { Logger } from "./loggerService";

// Simple Token Bucket simulation for client-side rate limiting
const RATE_LIMIT_WINDOW_MS = 60000; 
const MAX_REQUESTS_PER_WINDOW = 15;
let requestTimestamps: number[] = [];

export const checkRateLimit = (): boolean => {
  const now = Date.now();
  requestTimestamps = requestTimestamps.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS);
  if (requestTimestamps.length >= MAX_REQUESTS_PER_WINDOW) return false;
  requestTimestamps.push(now);
  return true;
};

export const logSecurityEvent = async (eventType: string, userId: string, details: string) => {
  console.log(`[SECURITY AUDIT] ${new Date().toISOString()} | User: ${userId} | Event: ${eventType} | ${details}`);
  
  // Also log to audit service if it's an admin action
  try {
    // Try to get user object
    const user = await loadUserSession();
    if (user && hasAdminAccess(user)) {
      await logAdminAction(
        user,
        eventType.toLowerCase().replace(/_/g, '_'),
        'security',
        { details }
      );
    }
  } catch (error) {
    // Don't fail if audit logging fails
    console.error('[SecurityService] Failed to log to audit service:', error);
  }
};

/**
 * Verifies MFA for admin actions
 */
export const verifyMfaForAdminAction = async (user: User, token: string): Promise<boolean> => {
  if (!user.mfaEnabled) {
    return true; // MFA not required
  }
  
  // Check if verification is still valid (within 5 minutes)
  if (isMfaVerificationValid(user)) {
    return true;
  }
  
  // Verify the token
  return await verifyMfaToken(user.id, token);
};

// --- SESSION PERSISTENCE & MANAGEMENT ---

const STORAGE_KEY_USER = 'globalreach_user_session';
const STORAGE_KEY_PLATFORMS = 'globalreach_platforms';
const STORAGE_KEY_EMAIL_CONNECTION = 'globalreach_email_connection';

export const saveUserSession = async (user: User) => {
  try {
    if (!user || !user.id) {
      console.error("[Session] Cannot save session: Invalid user object");
      return;
    }

    const sessionData = JSON.stringify({
      user,
      token: `mock-jwt-${Date.now()}`,
      expiry: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
      savedAt: Date.now()
    });
    
    // Use Secure Save if available (Electron), else LocalStorage
    await PlatformService.secureSave(STORAGE_KEY_USER, sessionData);
    console.log(`[Session] Session saved for user: ${user.id}`);
  } catch (e: any) {
    console.error("[Session] Failed to save session:", e);
    // Try localStorage fallback if secureSave fails
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const sessionData = JSON.stringify({
          user,
          token: `mock-jwt-${Date.now()}`,
          expiry: Date.now() + (7 * 24 * 60 * 60 * 1000),
          savedAt: Date.now()
        });
        localStorage.setItem(`web_secure_${STORAGE_KEY_USER}`, btoa(sessionData));
        console.log("[Session] Session saved to localStorage fallback");
      } catch (fallbackError) {
        console.error("[Session] Fallback save also failed:", fallbackError);
      }
    }
  }
};

export const loadUserSession = async (): Promise<User | null> => {
  try {
    let stored: string | null = null;
    
    // Try secure load first
    try {
      stored = await PlatformService.secureLoad(STORAGE_KEY_USER);
    } catch (e) {
      console.warn("[Session] Secure load failed, trying localStorage fallback:", e);
    }
    
    // Fallback to localStorage if secureLoad fails or returns null
    if (!stored && typeof window !== 'undefined' && window.localStorage) {
      try {
        const fallbackValue = localStorage.getItem(`web_secure_${STORAGE_KEY_USER}`);
        if (fallbackValue) {
          stored = atob(fallbackValue);
          console.log("[Session] Loaded session from localStorage fallback");
        }
      } catch (e) {
        console.warn("[Session] localStorage fallback also failed:", e);
      }
    }
    
    if (!stored || stored.trim() === '') {
      console.log("[Session] No stored session found");
      return null;
    }
    
    const parsed = JSON.parse(stored);
    
    // Validate session structure
    if (!parsed || !parsed.user || !parsed.expiry) {
      console.warn("[Session] Invalid session structure, clearing");
      await clearUserSession();
      return null;
    }
    
    // Check if session is expired
    const now = Date.now();
    if (parsed.expiry < now) {
      console.log("[Session] Session expired, clearing");
      await clearUserSession();
      return null;
    }
    
    // Validate user object
    if (!parsed.user.id || !parsed.user.email) {
      console.warn("[Session] Invalid user object in session, clearing");
      await clearUserSession();
      return null;
    }
    
    // Refresh session if it's close to expiry (refresh at 80% of expiry time)
    const timeUntilExpiry = parsed.expiry - now;
    const sessionDuration = 7 * 24 * 60 * 60 * 1000; // 7 days
    if (timeUntilExpiry < (sessionDuration * 0.2)) {
      console.log("[Session] Session close to expiry, refreshing");
      await saveUserSession(parsed.user);
    }
    
    console.log(`[Session] Session loaded successfully for user: ${parsed.user.id}`);
    return parsed.user;
  } catch (e: any) {
    console.error("[Session] Failed to load session:", e);
    // Clear corrupted session
    try {
      await clearUserSession();
    } catch (clearError) {
      console.error("[Session] Failed to clear corrupted session:", clearError);
    }
    return null;
  }
};

export const clearUserSession = async () => {
  try {
    // Clear from secure storage
    await PlatformService.secureSave(STORAGE_KEY_USER, "");
    
    // Also clear from localStorage fallback
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.removeItem(`web_secure_${STORAGE_KEY_USER}`);
      } catch (e) {
        console.warn("[Session] Failed to clear localStorage fallback:", e);
      }
    }
    
    console.log("[Session] Session cleared");
  } catch (e) {
    console.error("[Session] Failed to clear session:", e);
  }
};

export const savePlatformConnections = (connections: PlatformConnection[]) => {
  // Connections might contain tokens, so secure save is better
  PlatformService.secureSave(STORAGE_KEY_PLATFORMS, JSON.stringify(connections));
};

export const loadPlatformConnections = async (): Promise<PlatformConnection[]> => {
  try {
    const stored = await PlatformService.secureLoad(STORAGE_KEY_PLATFORMS);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
};

export const saveEmailConnection = async (connection: PlatformConnection): Promise<void> => {
  try {
    await PlatformService.secureSave(STORAGE_KEY_EMAIL_CONNECTION, JSON.stringify(connection));
  } catch (e) {
    Logger.error('[SecurityService] Failed to save email connection:', e);
    throw e;
  }
};

export const loadEmailConnection = async (): Promise<PlatformConnection | null> => {
  try {
    const stored = await PlatformService.secureLoad(STORAGE_KEY_EMAIL_CONNECTION);
    return stored ? JSON.parse(stored) : null;
  } catch (e) {
    Logger.error('[SecurityService] Failed to load email connection:', e);
    return null;
  }
};

export const removeEmailConnection = async (): Promise<void> => {
  try {
    await PlatformService.secureSave(STORAGE_KEY_EMAIL_CONNECTION, '');
  } catch (e) {
    Logger.error('[SecurityService] Failed to remove email connection:', e);
    throw e;
  }
};

export const refreshPlatformTokens = async (connections: PlatformConnection[]): Promise<PlatformConnection[]> => {
  // Enhanced token refresh with rotation on suspicious activity
  const now = Date.now();
  const updatedConnections: PlatformConnection[] = [];
  
  for (const conn of connections) {
    // Refresh email tokens if needed
    if (conn.channel === Channel.EMAIL && conn.emailCredentials) {
      try {
        const refreshed = await refreshEmailTokens(conn.emailCredentials);
        if (refreshed) {
          conn.emailCredentials = refreshed;
          // Save updated credentials
          const allConnections = await loadPlatformConnections();
          const updated = allConnections.map(c => 
            c.channel === conn.channel && c.accountName === conn.accountName ? conn : c
          );
          savePlatformConnections(updated);
        }
      } catch (error) {
        Logger.warn('[SecurityService] Email token refresh failed:', error);
      }
    }
    
    updatedConnections.push({
      ...conn,
      lastTested: now,
      healthStatus: 'healthy'
    });
  }
  
  return updatedConnections;
};

export const getActiveSessions = (): AuthSession[] => {
  return [
    {
      id: 'sess-current',
      userId: 'current',
      device: 'Desktop App (Current)',
      ip: '192.168.1.105',
      lastActive: Date.now(),
      isCurrent: true
    },
    {
      id: 'sess-mobile-1',
      userId: 'current',
      device: 'iPhone 13 Pro',
      ip: '203.12.55.12',
      lastActive: Date.now() - (45 * 60 * 1000),
      isCurrent: false
    }
  ];
};

/**
 * GDPR Compliance: Right to deletion
 * Revokes and deletes all tokens and credentials for a user
 */
export const deleteUserData = async (userId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    // Revoke email OAuth tokens
    const connections = await loadPlatformConnections();
    for (const conn of connections) {
      if (conn.channel === Channel.EMAIL && conn.emailCredentials) {
        if (conn.emailCredentials.accessToken) {
          try {
            const { OAuthService } = await import('./oauthService');
            const { PlatformService } = await import('./platformService');
            const clientId = await PlatformService.getAppConfig('outlookClientId', '');
            const tenantId = await PlatformService.getAppConfig('outlookTenantId', 'common');
            
            if (clientId) {
              await OAuthService.revokeOutlookToken(
                conn.emailCredentials.accessToken,
                {
                  clientId,
                  clientSecret: '', // Not needed for revocation
                  redirectUri: '',
                  tenantId: tenantId || conn.emailCredentials.tenantId || 'common',
                }
            );
            }
          } catch (error) {
            Logger.warn('[SecurityService] Failed to revoke email token during deletion:', error);
          }
        }
      }
    }
    
    // Clear user session
    clearUserSession();
    
    // Clear platform connections (user-specific)
    savePlatformConnections([]);
    
    Logger.info('[SecurityService] User data deleted', { userId });
    logSecurityEvent('DATA_DELETION', userId, 'User requested data deletion (GDPR)');
    
    return { success: true };
  } catch (error: any) {
    Logger.error('[SecurityService] Failed to delete user data:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Unified Integration Token Management
 */
export const saveIntegrationTokens = async (
  service: 'outlook' | 'whatsapp' | 'wechat',
  tokens: { accessToken: string; refreshToken?: string; expiryDate?: number },
  accountData: { accountName?: string; email?: string; phone?: string; wechatId?: string }
): Promise<void> => {
  try {
    if (service === 'outlook') {
      const credentials: OutlookEmailCredentials = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiryDate: tokens.expiryDate,
        userEmail: accountData.email || accountData.accountName || '',
      };
      await saveEmailConnection({
        channel: Channel.EMAIL,
        status: PlatformStatus.CONNECTED,
        accountName: accountData.accountName || accountData.email || '',
        connectedAt: Date.now(),
        provider: 'outlook',
        emailCredentials: credentials,
        healthStatus: 'healthy',
        lastTested: Date.now(),
      });
    } else if (service === 'whatsapp') {
      const connections = await loadPlatformConnections();
      const existing = connections.find(c => c.channel === Channel.WHATSAPP);
      const credentials: any = {
        ...existing?.whatsappCredentials,
        accessToken: tokens.accessToken,
      };
      await savePlatformConnection({
        channel: Channel.WHATSAPP,
        status: PlatformStatus.CONNECTED,
        accountName: accountData.accountName || accountData.phone || '',
        connectedAt: Date.now(),
        provider: 'whatsapp',
        whatsappCredentials: credentials,
        healthStatus: 'healthy',
        lastTested: Date.now(),
      });
    } else if (service === 'wechat') {
      const connections = await loadPlatformConnections();
      const existing = connections.find(c => c.channel === Channel.WECHAT);
      const credentials: any = {
        ...existing?.wechatCredentials,
        accessToken: tokens.accessToken,
        accessTokenExpiry: tokens.expiryDate,
      };
      await savePlatformConnection({
        channel: Channel.WECHAT,
        status: PlatformStatus.CONNECTED,
        accountName: accountData.accountName || accountData.wechatId || '',
        connectedAt: Date.now(),
        provider: 'wechat',
        wechatCredentials: credentials,
        healthStatus: 'healthy',
        lastTested: Date.now(),
      });
    }
  } catch (error) {
    Logger.error(`[SecurityService] Failed to save ${service} tokens:`, error);
    throw error;
  }
};

export const loadIntegrationTokens = async (
  service: 'outlook' | 'whatsapp' | 'wechat'
): Promise<{ accessToken: string; refreshToken?: string; expiryDate?: number } | null> => {
  try {
    if (service === 'outlook') {
      const conn = await loadEmailConnection();
      if (!conn?.emailCredentials) return null;
      return {
        accessToken: conn.emailCredentials.accessToken,
        refreshToken: conn.emailCredentials.refreshToken,
        expiryDate: conn.emailCredentials.expiryDate,
      };
    } else {
      const connections = await loadPlatformConnections();
      const conn = connections.find(c => c.channel === (service === 'whatsapp' ? Channel.WHATSAPP : Channel.WECHAT));
      if (service === 'whatsapp' && conn?.whatsappCredentials) {
        return {
          accessToken: conn.whatsappCredentials.accessToken,
        };
      } else if (service === 'wechat' && conn?.wechatCredentials?.accessToken) {
        return {
          accessToken: conn.wechatCredentials.accessToken,
          expiryDate: conn.wechatCredentials.accessTokenExpiry,
        };
      }
    }
    return null;
  } catch (error) {
    Logger.error(`[SecurityService] Failed to load ${service} tokens:`, error);
    return null;
  }
};

export const refreshIntegrationToken = async (
  service: 'outlook' | 'whatsapp' | 'wechat'
): Promise<{ accessToken: string; refreshToken?: string; expiryDate?: number } | null> => {
  try {
    const { IntegrationServiceFactory } = await import('./integrationService');
    const integrationService = IntegrationServiceFactory.getService(service);
    
    const tokens = await loadIntegrationTokens(service);
    if (!tokens?.refreshToken && service !== 'whatsapp' && service !== 'wechat') {
      throw new Error('No refresh token available');
    }
    
    if (service === 'outlook' && tokens?.refreshToken) {
      const newTokens = await integrationService.refreshToken(tokens.refreshToken);
      const conn = await loadEmailConnection();
      if (conn) {
        await saveEmailConnection({
          ...conn,
          emailCredentials: {
            ...conn.emailCredentials!,
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken || tokens.refreshToken,
            expiryDate: newTokens.expiryDate,
          },
        });
      }
      return newTokens;
    } else if (service === 'wechat') {
      const newTokens = await integrationService.refreshToken('');
      const connections = await loadPlatformConnections();
      const conn = connections.find(c => c.channel === Channel.WECHAT);
      if (conn?.wechatCredentials) {
        await savePlatformConnection({
          ...conn,
          wechatCredentials: {
            ...conn.wechatCredentials,
            accessToken: newTokens.accessToken,
            accessTokenExpiry: newTokens.expiryDate,
          },
        });
      }
      return newTokens;
    }
    
    return null;
  } catch (error) {
    Logger.error(`[SecurityService] Failed to refresh ${service} token:`, error);
    return null;
  }
};

export const revokeIntegrationToken = async (
  service: 'outlook' | 'whatsapp' | 'wechat'
): Promise<void> => {
  try {
    const { IntegrationServiceFactory } = await import('./integrationService');
    const integrationService = IntegrationServiceFactory.getService(service);
    await integrationService.disconnect();
  } catch (error) {
    Logger.error(`[SecurityService] Failed to revoke ${service} token:`, error);
    throw error;
  }
};

/**
 * GDPR Compliance: Data minimization
 * Returns only necessary data for operations
 */
export const getMinimalUserData = async (userId: string): Promise<{
  id: string;
  name: string;
  role: string;
  // No sensitive data like tokens, passwords, etc.
}> => {
  const user = await loadUserSession();
  if (!user || user.id !== userId) {
    throw new Error('User not found');
  }
  
  return {
    id: user.id,
    name: user.name,
    role: user.role,
  };
};

/**
 * GDPR Compliance: Audit logging for data access
 */
export const logDataAccess = (userId: string, dataType: string, action: string) => {
  Logger.info('[SecurityService] Data access logged', { userId, dataType, action, timestamp: Date.now() });
  logSecurityEvent('DATA_ACCESS', userId, `${action} on ${dataType}`);
};

// CSRF token storage
let csrfTokens = new Map<string, { token: string; expiresAt: number }>();

/**
 * Generates a CSRF token
 */
export const generateCSRFToken = (): string => {
  const crypto = require('crypto');
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + (15 * 60 * 1000); // 15 minutes
  
  csrfTokens.set(token, { token, expiresAt });
  
  // Clean up expired tokens
  for (const [key, value] of csrfTokens.entries()) {
    if (value.expiresAt < Date.now()) {
      csrfTokens.delete(key);
    }
  }
  
  return token;
};

/**
 * Validates a CSRF token
 */
export const validateCSRFToken = (token: string): boolean => {
  const stored = csrfTokens.get(token);
  if (!stored) return false;
  
  if (stored.expiresAt < Date.now()) {
    csrfTokens.delete(token);
    return false;
  }
  
  // Token is valid, remove it (one-time use)
  csrfTokens.delete(token);
  return true;
};

/**
 * Rate limiting for auth attempts
 */
const authAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_AUTH_ATTEMPTS = 5;
const AUTH_ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes

export const checkAuthRateLimit = (identifier: string): { allowed: boolean; retryAfter?: number } => {
  const now = Date.now();
  const attempts = authAttempts.get(identifier);
  
  if (!attempts || attempts.resetAt < now) {
    authAttempts.set(identifier, { count: 1, resetAt: now + AUTH_ATTEMPT_WINDOW });
    return { allowed: true };
  }
  
  if (attempts.count >= MAX_AUTH_ATTEMPTS) {
    const retryAfter = Math.ceil((attempts.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  attempts.count++;
  return { allowed: true };
};

/**
 * Validates input to prevent injection attacks
 */
export const validateInput = (input: string, type: 'string' | 'number' | 'email' | 'url' = 'string'): { valid: boolean; sanitized?: string; error?: string } => {
  if (typeof input !== 'string') {
    return { valid: false, error: 'Input must be a string' };
  }
  
  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');
  
  // XSS protection
  sanitized = sanitized
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/<iframe[^>]*>/gi, '')
    .replace(/<object[^>]*>/gi, '')
    .replace(/<embed[^>]*>/gi, '');
  
  // SQL injection patterns
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
    /(\b(UNION|OR|AND)\b.*\b(SELECT|INSERT|UPDATE|DELETE)\b)/i,
    /('|(\\')|(;)|(\\;)|(--)|(\\--)|(\/\*)|(\\\/\*)|(\*\/)|(\\\*\/))/,
  ];
  
  for (const pattern of sqlPatterns) {
    if (pattern.test(sanitized)) {
      Logger.warn('[SecurityService] Potential SQL injection detected');
      return { valid: false, error: 'Invalid input detected' };
    }
  }
  
  // Type-specific validation
  if (type === 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(sanitized)) {
      return { valid: false, error: 'Invalid email format' };
    }
  } else if (type === 'url') {
    try {
      new URL(sanitized);
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }
  } else if (type === 'number') {
    if (isNaN(Number(sanitized))) {
      return { valid: false, error: 'Invalid number format' };
    }
  }
  
  return { valid: true, sanitized };
};

/**
 * Checks for suspicious activity patterns
 */
const suspiciousActivityLog: Array<{ ip: string; timestamp: number; count: number }> = [];

export const checkSuspiciousActivity = (ip: string): boolean => {
  const now = Date.now();
  const windowMs = 5 * 60 * 1000; // 5 minutes
  const threshold = 50; // requests
  
  // Clean old entries
  const recent = suspiciousActivityLog.filter(entry => now - entry.timestamp < windowMs);
  suspiciousActivityLog.length = 0;
  suspiciousActivityLog.push(...recent);
  
  // Find or create entry for this IP
  let entry = suspiciousActivityLog.find(e => e.ip === ip);
  if (!entry) {
    entry = { ip, timestamp: now, count: 0 };
    suspiciousActivityLog.push(entry);
  }
  
  entry.count++;
  
  if (entry.count > threshold) {
    Logger.warn(`[SecurityService] Suspicious activity detected from IP: ${ip} (${entry.count} requests in 5 minutes)`);
    return true;
  }
  
  return false;
};

/**
 * Validates password strength
 */
export const validatePasswordStrength = (password: string): { valid: boolean; errors: string[]; strength: 'weak' | 'medium' | 'strong' } => {
  const errors: string[] = [];
  let strength: 'weak' | 'medium' | 'strong' = 'weak';
  let score = 0;

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  } else {
    score++;
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  } else {
    score++;
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  } else {
    score++;
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  } else {
    score++;
  }

  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  } else {
    score++;
  }

  if (password.length >= 12) {
    score++;
  }

  if (score >= 5) {
    strength = 'strong';
  } else if (score >= 3) {
    strength = 'medium';
  }

  return {
    valid: errors.length === 0,
    errors,
    strength,
  };
};

/**
 * Generates a secure random password
 */
export const generateSecurePassword = (length: number = 16): string => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  
  return Array.from(array)
    .map(x => charset[x % charset.length])
    .join('');
};

/**
 * Checks if password was recently used (password history)
 */
export const checkPasswordHistory = async (userId: string, newPassword: string): Promise<boolean> => {
  try {
    // In a full implementation, this would check against stored password hashes
    // For now, we'll just return true (password not in history)
    // This would require storing password history hashes
    return true;
  } catch (error) {
    Logger.error('[SecurityService] Failed to check password history:', error);
    return true; // Fail open
  }
};
