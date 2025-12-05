import { PinVerification, User } from '../types';
import { UserService } from './userService';
import { AuthService } from './authService';
import { PlatformService } from './platformService';
import { Logger } from './loggerService';
import { logSecurityEvent } from './securityService';
import { logAdminAction } from './auditService';

const STORAGE_KEY_PIN_VERIFICATIONS = 'globalreach_pin_verifications';
const PIN_VERIFICATION_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// In-memory store for PIN verifications
const pinVerifications = new Map<string, PinVerification>();

/**
 * PIN Service
 * Manages 4-digit PIN authentication for users
 */
export const PinService = {
  /**
   * Sets a PIN for a user
   */
  setPin: async (
    userId: string,
    pin: string,
    currentPassword?: string
  ): Promise<boolean> => {
    try {
      // Validate PIN format (4 digits)
      if (!/^\d{4}$/.test(pin)) {
        throw new Error('PIN must be exactly 4 digits');
      }

      const user = await UserService.getUser(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // If PIN already exists, require current password
      if (user.pinHash && currentPassword) {
        const isValid = await AuthService.verifyPassword(userId, currentPassword);
        if (!isValid) {
          throw new Error('Current password is incorrect');
        }
      }

      // Hash and store PIN
      const pinHash = await PinService.hashPin(pin);
      await UserService.updateUser(userId, {
        pinHash,
      });

      await logSecurityEvent('PIN_SET', userId, 'User set/updated PIN');
      Logger.info(`[PinService] PIN set for user ${userId}`);

      return true;
    } catch (error: any) {
      Logger.error('[PinService] Failed to set PIN:', error);
      throw error;
    }
  },

  /**
   * Verifies a PIN for a user
   */
  verifyPin: async (userId: string, pin: string): Promise<boolean> => {
    try {
      const user = await UserService.getUser(userId);
      if (!user || !user.pinHash) {
        return false;
      }

      const pinHash = await PinService.hashPin(pin);
      const isValid = pinHash === user.pinHash;

      if (isValid) {
        // Store verification (expires in 15 minutes)
        const verification: PinVerification = {
          userId,
          verifiedAt: Date.now(),
          expiresAt: Date.now() + PIN_VERIFICATION_DURATION_MS,
        };
        pinVerifications.set(userId, verification);
        
        // Also persist to storage
        const stored = await PlatformService.secureLoad(STORAGE_KEY_PIN_VERIFICATIONS);
        const verifications: Record<string, PinVerification> = stored ? JSON.parse(stored) : {};
        verifications[userId] = verification;
        await PlatformService.secureSave(STORAGE_KEY_PIN_VERIFICATIONS, JSON.stringify(verifications));

        await logSecurityEvent('PIN_VERIFIED', userId, 'PIN verified successfully');
      } else {
        await logSecurityEvent('PIN_VERIFICATION_FAILED', userId, 'PIN verification failed');
      }

      return isValid;
    } catch (error) {
      Logger.error('[PinService] PIN verification error:', error);
      return false;
    }
  },

  /**
   * Resets a user's PIN (admin/owner only)
   */
  resetPin: async (
    userId: string,
    resetterId: string,
    resetterPassword: string
  ): Promise<boolean> => {
    try {
      const resetter = await UserService.getUser(resetterId);
      if (!resetter) {
        throw new Error('Resetter not found');
      }

      // Verify resetter's password
      const isValid = await AuthService.verifyPassword(resetterId, resetterPassword);
      if (!isValid) {
        throw new Error('Incorrect password');
      }

      // Check permissions (admin or owner can reset)
      if (resetter.role !== 'Admin' && resetter.role !== 'Owner') {
        throw new Error('Insufficient permissions to reset PIN');
      }

      // Check if target user is owner - non-owners cannot modify owners
      const targetUser = await UserService.getUser(userId);
      if (targetUser && targetUser.role === 'Owner' && resetter.role !== 'Owner') {
        throw new Error('Cannot modify owner users');
      }

      // Clear PIN
      await UserService.updateUser(userId, {
        pinHash: undefined,
      });

      // Clear verification
      pinVerifications.delete(userId);
      const stored = await PlatformService.secureLoad(STORAGE_KEY_PIN_VERIFICATIONS);
      if (stored) {
        const verifications: Record<string, PinVerification> = JSON.parse(stored);
        delete verifications[userId];
        await PlatformService.secureSave(STORAGE_KEY_PIN_VERIFICATIONS, JSON.stringify(verifications));
      }

      await logAdminAction(
        resetter,
        'pin_reset',
        'user',
        { targetUserId: userId }
      );
      await logSecurityEvent('PIN_RESET', userId, `PIN reset by ${resetter.name} (${resetterId})`);

      Logger.info(`[PinService] PIN reset for user ${userId} by ${resetterId}`);
      return true;
    } catch (error: any) {
      Logger.error('[PinService] Failed to reset PIN:', error);
      throw error;
    }
  },

  /**
   * Hashes a PIN using SHA-256
   */
  hashPin: async (pin: string): Promise<string> => {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(pin);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      Logger.error('[PinService] PIN hashing error:', error);
      throw new Error('Failed to hash PIN');
    }
  },

  /**
   * Gets PIN verification status for a user
   */
  getPinVerification: (userId: string): PinVerification | null => {
    const verification = pinVerifications.get(userId);
    if (!verification) {
      return null;
    }

    // Check if expired
    if (verification.expiresAt < Date.now()) {
      pinVerifications.delete(userId);
      return null;
    }

    return verification;
  },

  /**
   * Checks if PIN is required for an action
   */
  requirePinForAction: (action: string): boolean => {
    const sensitiveActions = [
      'settings_access',
      'user_management',
      'payment_access',
      'data_export',
      'api_key_manage',
      'source_code_access',
    ];

    return sensitiveActions.includes(action);
  },

  /**
   * Checks if PIN verification is still valid
   */
  isPinVerified: (userId: string): boolean => {
    const verification = PinService.getPinVerification(userId);
    return verification !== null && verification.expiresAt > Date.now();
  },

  /**
   * Clears PIN verification (e.g., on logout)
   */
  clearPinVerification: async (userId: string): Promise<void> => {
    pinVerifications.delete(userId);
    
    const stored = await PlatformService.secureLoad(STORAGE_KEY_PIN_VERIFICATIONS);
    if (stored) {
      const verifications: Record<string, PinVerification> = JSON.parse(stored);
      delete verifications[userId];
      await PlatformService.secureSave(STORAGE_KEY_PIN_VERIFICATIONS, JSON.stringify(verifications));
    }
  },

  /**
   * Loads PIN verifications from storage on app start
   */
  loadPinVerifications: async (): Promise<void> => {
    try {
      const stored = await PlatformService.secureLoad(STORAGE_KEY_PIN_VERIFICATIONS);
      if (stored) {
        const verifications: Record<string, PinVerification> = JSON.parse(stored);
        const now = Date.now();
        
        // Only load non-expired verifications
        for (const [userId, verification] of Object.entries(verifications)) {
          if (verification.expiresAt > now) {
            pinVerifications.set(userId, verification);
          }
        }
      }
    } catch (error) {
      Logger.error('[PinService] Failed to load PIN verifications:', error);
    }
  },
};

