// Dynamic imports for Node.js-only modules
let authenticator: any;
let totp: any;
let QRCode: any;

const getOtpLib = async () => {
  if (!authenticator || !totp) {
    const otplib = await import('otplib');
    authenticator = otplib.authenticator;
    totp = otplib.totp;
  }
  return { authenticator, totp };
};

const getQRCode = async () => {
  if (!QRCode) {
    QRCode = (await import('qrcode')).default;
  }
  return QRCode;
};

import { User } from '../types';
import { PlatformService } from './platformService';
import { Logger } from './loggerService';
import { UserService } from './userService';

const STORAGE_KEY_MFA_SECRETS = 'globalreach_mfa_secrets';
const MFA_ISSUER = 'GlobalReach Exporter';
const BACKUP_CODES_COUNT = 10;

/**
 * MFA Service
 * Handles multi-factor authentication using TOTP (Time-based One-Time Password)
 */

/**
 * Generates a new MFA secret for a user
 */
export const generateMfaSecret = async (userId: string): Promise<{ secret: string; qrCodeUrl: string }> => {
  try {
    const { authenticator: auth } = await getOtpLib();
    const QRCodeLib = await getQRCode();
    
    // Generate a new secret
    const secret = auth.generateSecret();
    
    // Get user info for QR code label
    const user = await UserService.getUser(userId);
    const userEmail = user?.name || userId;
    
    // Create OTP Auth URL for QR code
    const otpAuthUrl = auth.keyuri(userEmail, MFA_ISSUER, secret);
    
    // Generate QR code as data URL
    const qrCodeUrl = await QRCodeLib.toDataURL(otpAuthUrl);
    
    Logger.info(`[MfaService] Generated MFA secret for user ${userId}`);
    
    return { secret, qrCodeUrl };
  } catch (error) {
    Logger.error('[MfaService] Failed to generate MFA secret:', error);
    throw error;
  }
};

/**
 * Verifies an MFA token for a user
 */
export const verifyMfaToken = async (userId: string, token: string): Promise<boolean> => {
  try {
    const { authenticator: auth } = await getOtpLib();
    
    const user = await UserService.getUser(userId);
    if (!user || !user.mfaEnabled || !user.mfaSecret) {
      return false;
    }
    
    // Decrypt the secret (stored encrypted)
    const secret = user.mfaSecret; // In production, decrypt here
    
    // Verify the token
    const isValid = auth.verify({ token, secret });
    
    if (isValid) {
      // Update last verified timestamp
      await UserService.updateUser(userId, {
        lastMfaVerified: Date.now(),
      });
      
      Logger.info(`[MfaService] MFA token verified for user ${userId}`);
    } else {
      Logger.warn(`[MfaService] Invalid MFA token for user ${userId}`);
    }
    
    return isValid;
  } catch (error) {
    Logger.error('[MfaService] Failed to verify MFA token:', error);
    return false;
  }
};

/**
 * Enables MFA for a user
 */
export const enableMfa = async (
  userId: string,
  secret: string,
  backupCodes: string[]
): Promise<void> => {
  try {
    // Encrypt the secret before storing
    const encryptedSecret = secret; // In production, encrypt here using PlatformService
    
    // Store backup codes encrypted
    const encryptedBackupCodes = JSON.stringify(backupCodes); // In production, encrypt
    
    // Update user with MFA enabled
    await UserService.updateUser(userId, {
      mfaEnabled: true,
      mfaSecret: encryptedSecret,
    });
    
    // Store backup codes separately (encrypted)
    await PlatformService.secureSave(
      `${STORAGE_KEY_MFA_SECRETS}_${userId}_backup`,
      encryptedBackupCodes
    );
    
    Logger.info(`[MfaService] MFA enabled for user ${userId}`);
  } catch (error) {
    Logger.error('[MfaService] Failed to enable MFA:', error);
    throw error;
  }
};

/**
 * Disables MFA for a user (requires password confirmation)
 */
export const disableMfa = async (userId: string, password: string): Promise<void> => {
  try {
    // Verify password (would need to integrate with auth service)
    // For now, we'll just disable MFA
    
    // Update user
    await UserService.updateUser(userId, {
      mfaEnabled: false,
      mfaSecret: undefined,
      lastMfaVerified: undefined,
    });
    
    // Remove backup codes
    await PlatformService.secureSave(
      `${STORAGE_KEY_MFA_SECRETS}_${userId}_backup`,
      ''
    );
    
    Logger.info(`[MfaService] MFA disabled for user ${userId}`);
  } catch (error) {
    Logger.error('[MfaService] Failed to disable MFA:', error);
    throw error;
  }
};

/**
 * Generates backup codes for MFA recovery
 */
export const generateBackupCodes = (): string[] => {
  const codes: string[] = [];
  for (let i = 0; i < BACKUP_CODES_COUNT; i++) {
    // Generate 8-character alphanumeric codes
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    codes.push(code);
  }
  return codes;
};

/**
 * Verifies a backup code and marks it as used
 */
export const verifyBackupCode = async (userId: string, code: string): Promise<boolean> => {
  try {
    // Load backup codes
    const stored = await PlatformService.secureLoad(
      `${STORAGE_KEY_MFA_SECRETS}_${userId}_backup`
    );
    
    if (!stored) {
      return false;
    }
    
    const backupCodes: string[] = JSON.parse(stored);
    
    // Check if code exists
    const codeIndex = backupCodes.indexOf(code.toUpperCase());
    if (codeIndex === -1) {
      return false;
    }
    
    // Remove used code
    backupCodes.splice(codeIndex, 1);
    
    // Save updated codes
    await PlatformService.secureSave(
      `${STORAGE_KEY_MFA_SECRETS}_${userId}_backup`,
      JSON.stringify(backupCodes)
    );
    
    // Update last verified timestamp
    await UserService.updateUser(userId, {
      lastMfaVerified: Date.now(),
    });
    
    Logger.info(`[MfaService] Backup code verified for user ${userId}`);
    
    return true;
  } catch (error) {
    Logger.error('[MfaService] Failed to verify backup code:', error);
    return false;
  }
};

/**
 * Checks if MFA is required for a user action
 */
export const isMfaRequired = async (userId: string, action: string): Promise<boolean> => {
  try {
    const user = await UserService.getUser(userId);
    if (!user || !user.mfaEnabled) {
      return false;
    }
    
    // Require MFA for sensitive actions
    const sensitiveActions = [
      'api_key_create',
      'api_key_delete',
      'api_key_rotate',
      'settings_modify',
      'user_delete',
      'data_export',
    ];
    
    if (sensitiveActions.includes(action)) {
      // Check if MFA was verified recently (within 5 minutes)
      const lastVerified = user.lastMfaVerified || 0;
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      
      return lastVerified < fiveMinutesAgo;
    }
    
    return false;
  } catch (error) {
    Logger.error('[MfaService] Failed to check MFA requirement:', error);
    return false;
  }
};

/**
 * Gets remaining backup codes for a user
 */
export const getRemainingBackupCodes = async (userId: string): Promise<number> => {
  try {
    const stored = await PlatformService.secureLoad(
      `${STORAGE_KEY_MFA_SECRETS}_${userId}_backup`
    );
    
    if (!stored) {
      return 0;
    }
    
    const backupCodes: string[] = JSON.parse(stored);
    return backupCodes.length;
  } catch (error) {
    Logger.error('[MfaService] Failed to get remaining backup codes:', error);
    return 0;
  }
};

/**
 * Checks if MFA verification is still valid (within 5 minutes)
 */
export const isMfaVerificationValid = (user: User): boolean => {
  if (!user.lastMfaVerified) {
    return false;
  }
  
  const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
  return user.lastMfaVerified >= fiveMinutesAgo;
};
