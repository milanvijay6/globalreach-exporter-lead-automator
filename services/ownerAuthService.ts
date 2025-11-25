import { OwnerCredentials } from '../types';
import { PlatformService } from './platformService';
import { Logger } from './loggerService';

const STORAGE_KEY_OWNER_CREDENTIALS = 'globalreach_owner_credentials';
const OWNER_EMAIL_ENV = 'OWNER_EMAIL';
const OWNER_PASSWORD_HASH_ENV = 'OWNER_PASSWORD_HASH';

// Default owner credentials (will be hashed on first use)
const DEFAULT_OWNER_EMAIL = 'milanvijay24@gmail.com';
const DEFAULT_OWNER_PASSWORD = 'vijayvargiya@24';

/**
 * Owner Authentication Service
 * Manages owner credentials securely from environment variables and encrypted config
 */
export const OwnerAuthService = {
  /**
   * Gets owner credentials from environment variables or encrypted config
   */
  getOwnerCredentials: async (): Promise<OwnerCredentials | null> => {
    try {
      // First, try environment variables (if available in Electron main process)
      let email: string | undefined;
      let passwordHash: string | undefined;

      // In Electron, we can access env vars via IPC
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        try {
          email = await (window as any).electronAPI.getEnvVar(OWNER_EMAIL_ENV);
          passwordHash = await (window as any).electronAPI.getEnvVar(OWNER_PASSWORD_HASH_ENV);
        } catch (error) {
          Logger.warn('[OwnerAuthService] Could not access env vars via IPC:', error);
        }
      }

      // Fallback to encrypted config
      if (!email || !passwordHash) {
        const stored = await PlatformService.secureLoad(STORAGE_KEY_OWNER_CREDENTIALS);
        if (stored) {
          const parsed = JSON.parse(stored);
          email = parsed.email || email;
          passwordHash = parsed.passwordHash || passwordHash;
        }
      }

      // If still no credentials, initialize with defaults
      if (!email || !passwordHash) {
        Logger.info('[OwnerAuthService] No owner credentials found, initializing with defaults');
        await OwnerAuthService.initializeOwnerCredentials();
        return await OwnerAuthService.getOwnerCredentials();
      }

      return { email, passwordHash };
    } catch (error) {
      Logger.error('[OwnerAuthService] Failed to get owner credentials:', error);
      return null;
    }
  },

  /**
   * Verifies owner credentials
   */
  verifyOwnerCredentials: async (email: string, password: string): Promise<boolean> => {
    try {
      const credentials = await OwnerAuthService.getOwnerCredentials();
      if (!credentials) {
        return false;
      }

      // Verify email matches
      if (credentials.email.toLowerCase() !== email.toLowerCase()) {
        Logger.warn('[OwnerAuthService] Email mismatch');
        return false;
      }

      // Verify password hash
      const passwordHash = await OwnerAuthService.hashPassword(password);
      return passwordHash === credentials.passwordHash;
    } catch (error) {
      Logger.error('[OwnerAuthService] Failed to verify owner credentials:', error);
      return false;
    }
  },

  /**
   * Hashes a password using SHA-256 (for owner credentials)
   * Note: For user passwords, use bcrypt in authService
   */
  hashPassword: async (password: string): Promise<string> => {
    try {
      // Use Web Crypto API (available in both Node and browser)
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      Logger.error('[OwnerAuthService] Failed to hash password:', error);
      throw new Error('Failed to hash password');
    }
  },

  /**
   * Initializes owner credentials (first-time setup)
   */
  initializeOwnerCredentials: async (): Promise<void> => {
    try {
      const passwordHash = await OwnerAuthService.hashPassword(DEFAULT_OWNER_PASSWORD);
      
      const credentials: OwnerCredentials = {
        email: DEFAULT_OWNER_EMAIL,
        passwordHash,
      };

      // Store in encrypted config (fallback if env vars not available)
      await PlatformService.secureSave(
        STORAGE_KEY_OWNER_CREDENTIALS,
        JSON.stringify(credentials)
      );

      Logger.info('[OwnerAuthService] Owner credentials initialized');
    } catch (error) {
      Logger.error('[OwnerAuthService] Failed to initialize owner credentials:', error);
      throw error;
    }
  },

  /**
   * Checks if a user is the owner
   */
  isOwner: (user: { email: string; role?: string }): boolean => {
    return user.email.toLowerCase() === DEFAULT_OWNER_EMAIL.toLowerCase() || 
           user.role === 'Owner';
  },
};

