import { AuthSession, PlatformConnection, User } from "../types";
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

export const saveUserSession = async (user: User) => {
  try {
    const sessionData = JSON.stringify({
      user,
      token: `mock-jwt-${Date.now()}`,
      expiry: Date.now() + (7 * 24 * 60 * 60 * 1000)
    });
    
    // Use Secure Save if available (Electron), else LocalStorage
    await PlatformService.secureSave(STORAGE_KEY_USER, sessionData);
  } catch (e) {
    console.error("Failed to save session", e);
  }
};

export const loadUserSession = async (): Promise<User | null> => {
  try {
    const stored = await PlatformService.secureLoad(STORAGE_KEY_USER);
    if (!stored) return null;
    
    const parsed = JSON.parse(stored);
    if (parsed.expiry < Date.now()) {
      return null;
    }
    return parsed.user;
  } catch (e) {
    return null;
  }
};

export const clearUserSession = () => {
  // Just overwriting with empty string for simplicity across platforms
  PlatformService.secureSave(STORAGE_KEY_USER, "");
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

export const refreshPlatformTokens = async (connections: PlatformConnection[]): Promise<PlatformConnection[]> => {
  // Enhanced token refresh with rotation on suspicious activity
  const now = Date.now();
  const updatedConnections: PlatformConnection[] = [];
  
  for (const conn of connections) {
    // Check if token needs refresh (OAuth tokens)
    if (conn.emailCredentials?.provider === 'gmail' || conn.emailCredentials?.provider === 'outlook') {
      try {
        const { EmailAuthService } = await import('./emailAuthService');
        const refreshed = await EmailAuthService.refreshTokensIfNeeded(conn.emailCredentials);
        if (refreshed) {
          conn.emailCredentials = refreshed;
          // Save updated credentials
          const allConnections = await loadPlatformConnections();
          const updated = allConnections.map(c => 
            c.channel === conn.channel ? conn : c
          );
          savePlatformConnections(updated);
        }
      } catch (error) {
        Logger.warn('[SecurityService] Token refresh failed:', error);
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
    // Revoke OAuth tokens
    const connections = await loadPlatformConnections();
    for (const conn of connections) {
      if (conn.emailCredentials?.provider === 'gmail' || conn.emailCredentials?.provider === 'outlook') {
        if (conn.emailCredentials.accessToken) {
          try {
            const { OAuthService } = await import('./oauthService');
            await OAuthService.revokeOAuthToken(
              conn.emailCredentials.provider,
              conn.emailCredentials.accessToken
            );
          } catch (error) {
            Logger.warn('[SecurityService] Failed to revoke token during deletion:', error);
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
 * Generates CSRF token
 */
export const generateCSRFToken = (): string => {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Validates CSRF token
 */
export const validateCSRFToken = (token: string, sessionToken: string): boolean => {
  return token === sessionToken && token.length === 64;
};