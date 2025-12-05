import { User } from '../types';
import { UserService } from './userService';
import { OwnerAuthService } from './ownerAuthService';
import { PlatformService } from './platformService';
import { Logger } from './loggerService';
import { logSecurityEvent } from './securityService';
import { logAdminAction } from './auditService';

const STORAGE_KEY_AUTH_ATTEMPTS = 'globalreach_auth_attempts';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const AUTH_ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

interface AuthAttempt {
  email: string;
  count: number;
  lastAttempt: number;
  lockoutUntil?: number;
}

/**
 * Authentication Service
 * Handles user login, logout, password verification, and account lockout
 */
export const AuthService = {
  /**
   * Logs in a user with email and password
   */
  login: async (
    email: string,
    password: string
  ): Promise<{ success: boolean; user?: User; error?: string }> => {
    try {
      // Check rate limiting
      const rateLimit = AuthService.checkRateLimit(email);
      if (!rateLimit.allowed) {
        return {
          success: false,
          error: `Too many login attempts. Please try again in ${Math.ceil((rateLimit.retryAfter || 0) / 60)} minutes.`,
        };
      }

      // Check if this is owner login
      const isOwner = email.toLowerCase() === 'milanvijay24@gmail.com';
      if (isOwner) {
        const isValid = await OwnerAuthService.verifyOwnerCredentials(email, password);
        if (!isValid) {
          await AuthService.recordFailedAttempt(email);
          return { success: false, error: 'Invalid email or password' };
        }

        // Create or get owner user
        const ownerUser = await AuthService.getOrCreateOwnerUser();
        await AuthService.recordSuccessfulLogin(ownerUser.id);
        await logSecurityEvent('LOGIN_SUCCESS', ownerUser.id, `Owner login: ${email}`);
        
        return { success: true, user: ownerUser };
      }

      // Regular user login
      const users = await UserService.getAllUsers();
      const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

      if (!user) {
        await AuthService.recordFailedAttempt(email);
        return { success: false, error: 'Invalid email or password' };
      }

      // Check if account is locked
      if (user.lockoutUntil && user.lockoutUntil > Date.now()) {
        const minutesLeft = Math.ceil((user.lockoutUntil - Date.now()) / 60000);
        return {
          success: false,
          error: `Account is locked. Please try again in ${minutesLeft} minutes.`,
        };
      }

      // Check if account is active
      if (user.status !== 'active') {
        return {
          success: false,
          error: `Account is ${user.status}. Please contact an administrator.`,
        };
      }

      // Verify password
      const isValid = await AuthService.verifyPassword(user.id, password);
      if (!isValid) {
        await AuthService.recordFailedAttempt(email);
        await AuthService.incrementFailedAttempts(user.id);
        await logSecurityEvent('LOGIN_FAILED', user.id, `Failed login attempt: ${email}`);
        return { success: false, error: 'Invalid email or password' };
      }

      // Successful login
      await AuthService.recordSuccessfulLogin(user.id);
      await AuthService.resetFailedAttempts(user.id);
      
      // Update last login
      await UserService.updateUser(user.id, {
        lastLogin: Date.now(),
        failedLoginAttempts: 0,
        lockoutUntil: undefined,
      });

      await logSecurityEvent('LOGIN_SUCCESS', user.id, `User login: ${email}`);
      
      return { success: true, user };
    } catch (error: any) {
      Logger.error('[AuthService] Login error:', error);
      return { success: false, error: error.message || 'Login failed' };
    }
  },

  /**
   * Logs out the current user
   */
  logout: async (): Promise<void> => {
    try {
      const { clearUserSession } = await import('./securityService');
      clearUserSession();
      Logger.info('[AuthService] User logged out');
    } catch (error) {
      Logger.error('[AuthService] Logout error:', error);
    }
  },

  /**
   * Verifies a user's password
   */
  verifyPassword: async (userId: string, password: string): Promise<boolean> => {
    try {
      const user = await UserService.getUser(userId);
      if (!user || !user.passwordHash) {
        return false;
      }

      const passwordHash = await AuthService.hashPassword(password);
      return passwordHash === user.passwordHash;
    } catch (error) {
      Logger.error('[AuthService] Password verification error:', error);
      return false;
    }
  },

  /**
   * Hashes a password using SHA-256
   * Note: In production, consider using bcrypt for better security
   */
  hashPassword: async (password: string): Promise<string> => {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      Logger.error('[AuthService] Password hashing error:', error);
      throw new Error('Failed to hash password');
    }
  },

  /**
   * Checks rate limiting for login attempts
   */
  checkRateLimit: (email: string): { allowed: boolean; retryAfter?: number } => {
    try {
      // This would ideally be stored in memory or a more persistent store
      // For now, we'll use a simple in-memory check combined with user record
      // The actual implementation should check the user's failedLoginAttempts
      return { allowed: true };
    } catch (error) {
      Logger.error('[AuthService] Rate limit check error:', error);
      return { allowed: true }; // Fail open
    }
  },

  /**
   * Locks an account after too many failed attempts
   */
  lockAccount: async (userId: string): Promise<void> => {
    try {
      const lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
      await UserService.updateUser(userId, {
        lockoutUntil,
        failedLoginAttempts: MAX_FAILED_ATTEMPTS,
      });
      await logSecurityEvent('ACCOUNT_LOCKED', userId, 'Account locked due to failed login attempts');
      Logger.warn(`[AuthService] Account locked: ${userId}`);
    } catch (error) {
      Logger.error('[AuthService] Account lock error:', error);
    }
  },

  /**
   * Unlocks an account
   */
  unlockAccount: async (userId: string): Promise<void> => {
    try {
      await UserService.updateUser(userId, {
        lockoutUntil: undefined,
        failedLoginAttempts: 0,
      });
      await logSecurityEvent('ACCOUNT_UNLOCKED', userId, 'Account unlocked');
      Logger.info(`[AuthService] Account unlocked: ${userId}`);
    } catch (error) {
      Logger.error('[AuthService] Account unlock error:', error);
    }
  },

  /**
   * Records a failed login attempt
   */
  recordFailedAttempt: async (email: string): Promise<void> => {
    try {
      const stored = await PlatformService.secureLoad(STORAGE_KEY_AUTH_ATTEMPTS);
      const attempts: AuthAttempt[] = stored ? JSON.parse(stored) : [];
      
      const existing = attempts.find(a => a.email.toLowerCase() === email.toLowerCase());
      const now = Date.now();

      if (existing) {
        existing.count++;
        existing.lastAttempt = now;
        
        if (existing.count >= MAX_FAILED_ATTEMPTS) {
          existing.lockoutUntil = now + LOCKOUT_DURATION_MS;
        }
      } else {
        attempts.push({
          email: email.toLowerCase(),
          count: 1,
          lastAttempt: now,
        });
      }

      // Clean up old attempts
      const filtered = attempts.filter(a => now - a.lastAttempt < AUTH_ATTEMPT_WINDOW_MS);
      
      await PlatformService.secureSave(STORAGE_KEY_AUTH_ATTEMPTS, JSON.stringify(filtered));
    } catch (error) {
      Logger.error('[AuthService] Failed to record attempt:', error);
    }
  },

  /**
   * Records a successful login
   */
  recordSuccessfulLogin: async (userId: string): Promise<void> => {
    try {
      const stored = await PlatformService.secureLoad(STORAGE_KEY_AUTH_ATTEMPTS);
      const attempts: AuthAttempt[] = stored ? JSON.parse(stored) : [];
      
      // Remove any attempts for this user's email
      const user = await UserService.getUser(userId);
      if (user) {
        const filtered = attempts.filter(a => a.email.toLowerCase() !== user.email.toLowerCase());
        await PlatformService.secureSave(STORAGE_KEY_AUTH_ATTEMPTS, JSON.stringify(filtered));
      }
    } catch (error) {
      Logger.error('[AuthService] Failed to record successful login:', error);
    }
  },

  /**
   * Increments failed login attempts for a user
   */
  incrementFailedAttempts: async (userId: string): Promise<void> => {
    try {
      const user = await UserService.getUser(userId);
      if (!user) return;

      const failedAttempts = (user.failedLoginAttempts || 0) + 1;
      
      if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
        await AuthService.lockAccount(userId);
      } else {
        await UserService.updateUser(userId, {
          failedLoginAttempts: failedAttempts,
        });
      }
    } catch (error) {
      Logger.error('[AuthService] Failed to increment attempts:', error);
    }
  },

  /**
   * Resets failed login attempts for a user
   */
  resetFailedAttempts: async (userId: string): Promise<void> => {
    try {
      await UserService.updateUser(userId, {
        failedLoginAttempts: 0,
        lockoutUntil: undefined,
      });
    } catch (error) {
      Logger.error('[AuthService] Failed to reset attempts:', error);
    }
  },

  /**
   * Gets or creates the owner user
   */
  getOrCreateOwnerUser: async (): Promise<User> => {
    try {
      // Use includeOwners=true to access owner users for owner-specific operations
      const users = await UserService.getAllUsers(undefined, true);
      let owner = users.find(u => u.email.toLowerCase() === 'milanvijay24@gmail.com' || u.role === 'Owner');

      if (!owner) {
        // Create owner user with ALL permissions
        const passwordHash = await AuthService.hashPassword('vijayvargiya@24');
        owner = {
          id: 'owner-1',
          name: 'Owner',
          email: 'milanvijay24@gmail.com',
          role: 'Owner' as any,
          passwordHash,
          status: 'active',
          createdAt: Date.now(),
          // Owner has ALL permissions
          permissions: [
            'READ',
            'WRITE',
            'DELETE',
            'ADMIN_ACCESS',
            'API_KEY_MANAGE',
            'SETTINGS_MANAGE',
            'DATA_EXPORT',
            'AUDIT_VIEW',
            'COMPANY_CONFIG_MANAGE',
          ] as any[],
        };
        await UserService.createUser(owner);
      } else {
        // Ensure owner has correct role and all permissions
        const allPermissions = [
          'READ',
          'WRITE',
          'DELETE',
          'ADMIN_ACCESS',
          'API_KEY_MANAGE',
          'SETTINGS_MANAGE',
          'DATA_EXPORT',
          'AUDIT_VIEW',
          'COMPANY_CONFIG_MANAGE',
        ] as any[];
        
        if (owner.role !== 'Owner' || !owner.permissions || owner.permissions.length !== allPermissions.length) {
          owner.role = 'Owner' as any;
          owner.permissions = allPermissions;
          await UserService.updateUser(owner.id, { 
            role: 'Owner' as any,
            permissions: allPermissions 
          });
        }
      }

      return owner;
    } catch (error) {
      Logger.error('[AuthService] Failed to get/create owner:', error);
      throw error;
    }
  },
};

