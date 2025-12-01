import { Logger } from './loggerService';
import { MagicLinkService } from './magicLinkService';
// EmailAuthService is imported dynamically to avoid bundling Node.js modules
// import { EmailAuthService } from './emailAuthService';

export interface ParsedLink {
  type: 'magic-link' | 'oauth' | 'unknown';
  token?: string;
  code?: string;
  state?: string;
  email?: string;
  provider?: 'gmail' | 'outlook'; // Only OAuth 2.0 providers supported
  params?: Record<string, string>;
}

export interface LinkValidationResult {
  valid: boolean;
  parsed?: ParsedLink;
  error?: string;
}

/**
 * Link Handler Service
 * Processes login links, magic links, and OAuth callbacks from emails
 */
export const LinkHandlerService = {
  /**
   * Handles a login link click from email or other sources
   */
  handleLoginLink: async (url: string): Promise<LinkValidationResult> => {
    try {
      Logger.info('[LinkHandler] Processing login link', { url: url.substring(0, 100) });

      // Parse URL
      const parsed = LinkHandlerService.parseURLParameters(url);
      
      if (!parsed) {
        return { valid: false, error: 'Invalid URL format' };
      }

      // Route to appropriate handler
      const result = await LinkHandlerService.routeToAuthFlow(parsed);
      return result;
    } catch (error: any) {
      Logger.error('[LinkHandler] Login link handling failed:', error);
      return { valid: false, error: error.message || 'Failed to process login link' };
    }
  },

  /**
   * Parses URL parameters and extracts authentication data
   */
  parseURLParameters: (url: string): ParsedLink | null => {
    try {
      let urlObj: URL;
      
      // Handle different URL formats
      if (url.startsWith('globalreach://')) {
        // Custom protocol
        urlObj = new URL(url.replace('globalreach://', 'http://'));
      } else if (url.startsWith('http://') || url.startsWith('https://')) {
        urlObj = new URL(url);
      } else {
        // Try to parse as relative URL with query string
        const match = url.match(/^([^?]+)\?(.+)$/);
        if (match) {
          urlObj = new URL(`http://localhost${match[0]}`);
        } else {
          return null;
        }
      }

      const params: Record<string, string> = {};
      urlObj.searchParams.forEach((value, key) => {
        params[key] = value;
      });

      // Determine link type
      if (params.token) {
        // Magic link
        return {
          type: 'magic-link',
          token: params.token,
          email: params.email,
          provider: (params.provider as 'gmail' | 'outlook') || 'gmail', // Default to gmail if not specified
          params,
        };
      } else if (params.code && params.state) {
        // OAuth callback
        return {
          type: 'oauth',
          code: params.code,
          state: params.state,
          email: params.email,
          provider: params.provider as 'gmail' | 'outlook' || 'gmail',
          params,
        };
      }

      return { type: 'unknown', params };
    } catch (error: any) {
      Logger.error('[LinkHandler] URL parsing failed:', error);
      return null;
    }
  },

  /**
   * Validates link signature and authenticity
   */
  validateLinkSignature: (link: ParsedLink): boolean => {
    try {
      if (link.type === 'magic-link' && link.token) {
        // Validate magic link token
        const validation = MagicLinkService.validateMagicLink(link.token);
        return validation.valid;
      } else if (link.type === 'oauth' && link.state) {
        // Validate OAuth state (check if it's properly formatted)
        try {
          const stateData = JSON.parse(Buffer.from(link.state, 'base64url').toString());
          return !!stateData.provider && !!stateData.nonce && !!stateData.timestamp;
        } catch {
          return false;
        }
      }
      return false;
    } catch (error) {
      Logger.error('[LinkHandler] Signature validation failed:', error);
      return false;
    }
  },

  /**
   * Routes to the appropriate authentication flow
   */
  routeToAuthFlow: async (link: ParsedLink): Promise<LinkValidationResult> => {
    try {
      // Validate signature first
      if (!LinkHandlerService.validateLinkSignature(link)) {
        return { valid: false, error: 'Invalid or tampered link signature' };
      }

      if (link.type === 'magic-link') {
        // Handle magic link
        if (!link.token) {
          return { valid: false, error: 'Missing magic link token' };
        }

        const validation = MagicLinkService.validateMagicLink(link.token);
        if (!validation.valid || !validation.payload) {
          return { valid: false, error: validation.error || 'Invalid magic link' };
        }

        Logger.info('[LinkHandler] Magic link validated, routing to connection flow', {
          email: validation.payload.email,
          provider: validation.payload.provider,
        });

        return {
          valid: true,
          parsed: {
            type: 'magic-link',
            token: link.token,
            email: validation.payload.email,
            provider: validation.payload.provider,
          },
        };
      } else if (link.type === 'oauth') {
        // Handle OAuth callback
        if (!link.code || !link.state) {
          return { valid: false, error: 'Missing OAuth code or state' };
        }

        Logger.info('[LinkHandler] OAuth callback received, routing to token exchange', {
          provider: link.provider,
        });

        return {
          valid: true,
          parsed: {
            type: 'oauth',
            code: link.code,
            state: link.state,
            email: link.email,
            provider: link.provider,
          },
        };
      }

      return { valid: false, error: 'Unknown link type' };
    } catch (error: any) {
      Logger.error('[LinkHandler] Auth flow routing failed:', error);
      return { valid: false, error: error.message || 'Failed to route to auth flow' };
    }
  },

  /**
   * Extracts email and provider from link
   */
  extractEmailInfo: (link: ParsedLink): { email?: string; provider?: 'gmail' | 'outlook' } => {
    if (link.type === 'magic-link' && link.token) {
      const validation = MagicLinkService.validateMagicLink(link.token);
      if (validation.valid && validation.payload) {
        return {
          email: validation.payload.email,
          provider: validation.payload.provider,
        };
      }
    }

    return {
      email: link.email,
      provider: link.provider,
    };
  },

  /**
   * Detects provider from email address in link
   * DEPRECATED: Email functionality removed - always returns null
   */
  detectProviderFromEmail: async (email?: string): Promise<'gmail' | 'outlook' | null> => {
    // Email functionality removed
    return null;
  },
};

