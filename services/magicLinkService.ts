import { Logger } from './loggerService';
import jwt from 'jsonwebtoken';
import * as crypto from 'crypto';

export interface MagicLinkPayload {
  email: string;
  provider: 'gmail' | 'outlook'; // Only OAuth 2.0 providers supported
  nonce: string;
  timestamp: number;
  purpose: 'email_connection' | 'user_login';
}

export interface MagicLinkResult {
  token: string;
  url: string;
  expiresAt: number;
}

// In-memory nonce store (in production, use Redis or database)
const usedNonces = new Set<string>();
const NONCE_CLEANUP_INTERVAL = 30 * 60 * 1000; // 30 minutes

// Clean up old nonces periodically
setInterval(() => {
  const now = Date.now();
  // Remove nonces older than 1 hour
  // In a real implementation, track nonce timestamps
  if (usedNonces.size > 1000) {
    usedNonces.clear();
    Logger.debug('[MagicLinkService] Cleared nonce cache');
  }
}, NONCE_CLEANUP_INTERVAL);

/**
 * Magic Link Service
 * Generates and validates secure magic links for email authentication
 */
export const MagicLinkService = {
  /**
   * Gets or generates a secret key for JWT signing
   */
  getSecretKey: (): string => {
    // In production, this should be stored securely (environment variable, key management service)
    // For now, generate a stable key from app data directory
    try {
      const { PlatformService } = require('./platformService');
      // Try to get a stable secret from secure storage
      const stored = PlatformService.secureLoad('magic_link_secret');
      if (stored) {
        return stored;
      }
      
      // Generate a new secret
      const secret = crypto.randomBytes(64).toString('hex');
      PlatformService.secureSave('magic_link_secret', secret);
      return secret;
    } catch {
      // Fallback to a default (not secure for production)
      return process.env.MAGIC_LINK_SECRET || 'default-secret-change-in-production';
    }
  },

  /**
   * Generates a secure magic link
   */
  generateMagicLink: (
    email: string,
    provider: 'gmail' | 'outlook', // Only OAuth 2.0 providers supported
    purpose: 'email_connection' | 'user_login' = 'email_connection',
    expirationMinutes: number = 15
  ): MagicLinkResult => {
    try {
      const nonce = crypto.randomBytes(32).toString('hex');
      const timestamp = Date.now();
      const expiresAt = timestamp + expirationMinutes * 60 * 1000;

      const payload: MagicLinkPayload = {
        email,
        provider,
        nonce,
        timestamp,
        purpose,
      };

      const secret = MagicLinkService.getSecretKey();
      const token = jwt.sign(payload, secret, {
        expiresIn: `${expirationMinutes}m`,
        algorithm: 'HS256',
      });

      // Generate deep link URL
      const baseUrl = 'globalreach://auth/callback';
      const url = `${baseUrl}?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

      Logger.info('[MagicLinkService] Magic link generated', { email, provider, purpose });
      
      return {
        token,
        url,
        expiresAt,
      };
    } catch (error: any) {
      Logger.error('[MagicLinkService] Failed to generate magic link:', error);
      throw new Error(`Failed to generate magic link: ${error.message}`);
    }
  },

  /**
   * Validates a magic link token
   */
  validateMagicLink: (token: string): {
    valid: boolean;
    payload?: MagicLinkPayload;
    error?: string;
  } => {
    try {
      const secret = MagicLinkService.getSecretKey();

      // Verify JWT signature and expiration
      let decoded: any;
      try {
        decoded = jwt.verify(token, secret, {
          algorithms: ['HS256'],
        });
      } catch (jwtError: any) {
        if (jwtError.name === 'TokenExpiredError') {
          return { valid: false, error: 'Magic link has expired' };
        }
        if (jwtError.name === 'JsonWebTokenError') {
          return { valid: false, error: 'Invalid magic link token' };
        }
        throw jwtError;
      }

      const payload = decoded as MagicLinkPayload;

      // Validate payload structure
      if (!payload.email || !payload.provider || !payload.nonce || !payload.timestamp) {
        return { valid: false, error: 'Invalid magic link payload' };
      }

      // Check if nonce has been used (replay attack prevention)
      if (usedNonces.has(payload.nonce)) {
        Logger.warn('[MagicLinkService] Replay attack detected', { email: payload.email });
        return { valid: false, error: 'Magic link has already been used' };
      }

      // Check timestamp (additional validation)
      const age = Date.now() - payload.timestamp;
      const maxAge = 15 * 60 * 1000; // 15 minutes
      if (age > maxAge) {
        return { valid: false, error: 'Magic link has expired' };
      }

      // Mark nonce as used
      usedNonces.add(payload.nonce);

      Logger.info('[MagicLinkService] Magic link validated successfully', {
        email: payload.email,
        provider: payload.provider,
      });

      return { valid: true, payload };
    } catch (error: any) {
      Logger.error('[MagicLinkService] Magic link validation error:', error);
      return { valid: false, error: error.message || 'Validation failed' };
    }
  },

  /**
   * Sends a magic link via email
   * DEPRECATED: Email functionality removed - this function always returns an error
   */
  sendMagicLink: async (
    toEmail: string,
    provider: 'gmail' | 'outlook', // Only OAuth 2.0 providers supported
    purpose: 'email_connection' | 'user_login' = 'email_connection'
  ): Promise<{ success: boolean; error?: string }> => {
    Logger.warn('[MagicLinkService] sendMagicLink called but email functionality is removed');
    return { 
      success: false, 
      error: 'Email functionality has been removed from the application. Magic links are no longer supported.' 
    };
  },

  /**
   * Extracts token from URL
   */
  extractTokenFromUrl: (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      return urlObj.searchParams.get('token');
    } catch {
      // Try to extract from string if not a valid URL
      const match = url.match(/[?&]token=([^&]+)/);
      return match ? decodeURIComponent(match[1]) : null;
    }
  },
};

