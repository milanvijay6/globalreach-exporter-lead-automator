import { Logger } from './loggerService';
import { EmailCredentials } from './types';

// Dynamic import for googleapis
let google: any;

const getGoogle = async () => {
  if (!google) {
    // Only import in Node.js/Electron environment
    if (typeof window === 'undefined' || (window as any).electronAPI) {
      try {
        // Use require for Node.js modules in Electron to avoid Vite bundling
        if (typeof require !== 'undefined') {
          // Dynamic require to prevent static analysis
          const moduleName = 'googleapis';
          const googleapis = require(moduleName);
          google = googleapis.google || googleapis;
        } else {
          // Fallback: use Function constructor to prevent static analysis
          const moduleName = 'googleapis';
          const importFunc = new Function('specifier', 'return import(specifier)');
          const googleapis = await importFunc(moduleName);
          google = googleapis.google || googleapis.default?.google || googleapis.default || googleapis;
        }
      } catch (error: any) {
        throw new Error('Google APIs is not available in this environment. OAuth requires Node.js.');
      }
    } else {
      throw new Error('Google APIs is not available in browser environment. OAuth requires Electron.');
    }
  }
  return google;
};

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  expiryDate?: number; // Absolute timestamp when token expires
  tokenType?: string;
  scope?: string;
}

export interface OAuthState {
  provider: 'gmail' | 'outlook';
  nonce: string;
  timestamp: number;
  email?: string;
}

/**
 * OAuth Service for Gmail and Outlook authentication
 */
export const OAuthService = {
  /**
   * Generates a secure random state string for OAuth
   */
  generateState: (provider: 'gmail' | 'outlook', email?: string): string => {
    const nonce = require('crypto').randomBytes(32).toString('hex');
    const state: OAuthState = {
      provider,
      nonce,
      timestamp: Date.now(),
      email,
    };
    return Buffer.from(JSON.stringify(state)).toString('base64url');
  },

  /**
   * Validates and parses OAuth state
   */
  parseState: (stateString: string): OAuthState | null => {
    try {
      const state = JSON.parse(Buffer.from(stateString, 'base64url').toString());
      // Validate state is not too old (15 minutes max)
      if (Date.now() - state.timestamp > 15 * 60 * 1000) {
        Logger.warn('[OAuthService] State expired');
        return null;
      }
      return state;
    } catch (error) {
      Logger.error('[OAuthService] Failed to parse state:', error);
      return null;
    }
  },

  /**
   * Initiates Gmail OAuth flow
   */
  initiateGmailOAuth: async (
    config: OAuthConfig,
    email?: string
  ): Promise<{ authUrl: string; state: string }> => {
    try {
      const googleLib = await getGoogle();
      const state = OAuthService.generateState('gmail', email);

      const oauth2Client = new googleLib.auth.OAuth2(
        config.clientId,
        config.clientSecret,
        config.redirectUri
      );

      const scopes = [
        'https://www.googleapis.com/auth/gmail.modify', // Includes read, send, and modify permissions
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ];

      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        state,
        prompt: 'consent', // Force consent to get refresh token
      });

      Logger.info('[OAuthService] Gmail OAuth URL generated', { email, hasState: !!state });
      return { authUrl, state };
    } catch (error: any) {
      Logger.error('[OAuthService] Failed to initiate Gmail OAuth:', error);
      throw new Error(`Failed to initiate Gmail OAuth: ${error.message}`);
    }
  },

  /**
   * Initiates Outlook/Microsoft OAuth flow
   */
  initiateOutlookOAuth: async (
    config: OAuthConfig,
    email?: string
  ): Promise<{ authUrl: string; state: string }> => {
    try {
      const state = OAuthService.generateState('outlook', email);

      const scopes = [
        'https://graph.microsoft.com/Mail.Send',
        'https://graph.microsoft.com/Mail.Read',
        'https://graph.microsoft.com/User.Read',
        'offline_access',
      ].join(' ');

      const params = new URLSearchParams({
        client_id: config.clientId,
        response_type: 'code',
        redirect_uri: config.redirectUri,
        response_mode: 'query',
        scope: scopes,
        state,
        prompt: 'consent',
      });

      const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;

      Logger.info('[OAuthService] Outlook OAuth URL generated', { email, hasState: !!state });
      return { authUrl, state };
    } catch (error: any) {
      Logger.error('[OAuthService] Failed to initiate Outlook OAuth:', error);
      throw new Error(`Failed to initiate Outlook OAuth: ${error.message}`);
    }
  },

  /**
   * Handles OAuth callback and exchanges code for tokens
   */
  handleOAuthCallback: async (
    provider: 'gmail' | 'outlook',
    code: string,
    state: string,
    config: OAuthConfig
  ): Promise<OAuthTokens> => {
    try {
      const parsedState = OAuthService.parseState(state);
      if (!parsedState || parsedState.provider !== provider) {
        throw new Error('Invalid or expired OAuth state');
      }

      if (provider === 'gmail') {
        return await OAuthService.exchangeGmailCode(code, config);
      } else {
        return await OAuthService.exchangeOutlookCode(code, config);
      }
    } catch (error: any) {
      Logger.error('[OAuthService] OAuth callback failed:', error);
      throw new Error(`OAuth callback failed: ${error.message}`);
    }
  },

  /**
   * Exchanges Gmail OAuth code for tokens
   */
  exchangeGmailCode: async (
    code: string,
    config: OAuthConfig
  ): Promise<OAuthTokens> => {
    try {
      const googleLib = await getGoogle();
      const oauth2Client = new googleLib.auth.OAuth2(
        config.clientId,
        config.clientSecret,
        config.redirectUri
      );

      const { tokens } = await oauth2Client.getToken(code);

      if (!tokens.access_token) {
        throw new Error('No access token received');
      }

      Logger.info('[OAuthService] Gmail tokens obtained successfully');
      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expiry_date ? tokens.expiry_date - Date.now() : undefined,
        expiryDate: tokens.expiry_date || undefined,
        tokenType: tokens.token_type,
        scope: tokens.scope,
      };
    } catch (error: any) {
      Logger.error('[OAuthService] Failed to exchange Gmail code:', error);
      throw new Error(`Failed to exchange Gmail code: ${error.message}`);
    }
  },

  /**
   * Exchanges Outlook OAuth code for tokens
   */
  exchangeOutlookCode: async (
    code: string,
    config: OAuthConfig
  ): Promise<OAuthTokens> => {
    try {
      const tokenEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
      
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          redirect_uri: config.redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error_description || `HTTP ${response.status}`);
      }

      const tokens = await response.json();

      if (!tokens.access_token) {
        throw new Error('No access token received');
      }

      Logger.info('[OAuthService] Outlook tokens obtained successfully');
      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in ? tokens.expires_in * 1000 : undefined,
        tokenType: tokens.token_type,
        scope: tokens.scope,
      };
    } catch (error: any) {
      Logger.error('[OAuthService] Failed to exchange Outlook code:', error);
      throw new Error(`Failed to exchange Outlook code: ${error.message}`);
    }
  },

  /**
   * Refreshes an expired OAuth token
   */
  refreshOAuthToken: async (
    provider: 'gmail' | 'outlook',
    refreshToken: string,
    config: OAuthConfig
  ): Promise<OAuthTokens> => {
    try {
      if (provider === 'gmail') {
        return await OAuthService.refreshGmailToken(refreshToken, config);
      } else {
        return await OAuthService.refreshOutlookToken(refreshToken, config);
      }
    } catch (error: any) {
      Logger.error('[OAuthService] Token refresh failed:', error);
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  },

  /**
   * Refreshes Gmail OAuth token
   */
  refreshGmailToken: async (
    refreshToken: string,
    config: OAuthConfig
  ): Promise<OAuthTokens> => {
    try {
      const googleLib = await getGoogle();
      const oauth2Client = new googleLib.auth.OAuth2(
        config.clientId,
        config.clientSecret,
        config.redirectUri
      );

      oauth2Client.setCredentials({
        refresh_token: refreshToken,
      });

      const { credentials } = await oauth2Client.refreshAccessToken();

      Logger.info('[OAuthService] Gmail token refreshed successfully');
      return {
        accessToken: credentials.access_token!,
        refreshToken: credentials.refresh_token || refreshToken,
        expiresIn: credentials.expiry_date ? credentials.expiry_date - Date.now() : undefined,
        expiryDate: credentials.expiry_date || undefined,
        tokenType: credentials.token_type,
        scope: credentials.scope,
      };
    } catch (error: any) {
      Logger.error('[OAuthService] Failed to refresh Gmail token:', error);
      throw new Error(`Failed to refresh Gmail token: ${error.message}`);
    }
  },

  /**
   * Refreshes Outlook OAuth token
   */
  refreshOutlookToken: async (
    refreshToken: string,
    config: OAuthConfig
  ): Promise<OAuthTokens> => {
    try {
      const tokenEndpoint = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
      
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error_description || `HTTP ${response.status}`);
      }

      const tokens = await response.json();

      Logger.info('[OAuthService] Outlook token refreshed successfully');
      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || refreshToken,
        expiresIn: tokens.expires_in ? tokens.expires_in * 1000 : undefined,
        tokenType: tokens.token_type,
        scope: tokens.scope,
      };
    } catch (error: any) {
      Logger.error('[OAuthService] Failed to refresh Outlook token:', error);
      throw new Error(`Failed to refresh Outlook token: ${error.message}`);
    }
  },

  /**
   * Revokes an OAuth token
   */
  revokeOAuthToken: async (
    provider: 'gmail' | 'outlook',
    token: string,
    config?: OAuthConfig
  ): Promise<boolean> => {
    try {
      if (provider === 'gmail') {
        const revokeUrl = `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`;
        const response = await fetch(revokeUrl, { method: 'POST' });
        return response.ok;
      } else {
        // Outlook doesn't have a simple revoke endpoint, but we can invalidate by removing from storage
        Logger.info('[OAuthService] Outlook token revocation (removed from storage)');
        return true;
      }
    } catch (error: any) {
      Logger.error('[OAuthService] Token revocation failed:', error);
      return false;
    }
  },
};

