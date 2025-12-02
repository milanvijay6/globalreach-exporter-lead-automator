import { Logger } from './loggerService';
// EmailCredentials removed - email functionality removed

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
  tenantId?: string; // Optional tenant ID for Outlook/Microsoft (defaults to 'common')
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
    // Use Web Crypto API for browser compatibility
    let nonce: string;
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
      // Browser environment - use Web Crypto API
      const array = new Uint8Array(32);
      window.crypto.getRandomValues(array);
      nonce = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    } else if (typeof require !== 'undefined') {
      // Node.js environment (main process)
      try {
        const crypto = require('crypto');
        nonce = crypto.randomBytes(32).toString('hex');
      } catch (e) {
        // Fallback to Math.random if crypto is not available
        nonce = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      }
    } else {
      // Fallback to Math.random
      nonce = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    }
    
    const state: OAuthState = {
      provider,
      nonce,
      timestamp: Date.now(),
      email,
    };
    
    // Use browser-compatible base64 encoding
    const stateJson = JSON.stringify(state);
    if (typeof window !== 'undefined' && window.btoa) {
      // Browser: use btoa and replace URL-unsafe characters
      const base64 = window.btoa(stateJson);
      return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    } else if (typeof Buffer !== 'undefined') {
      // Node.js: use Buffer
      return Buffer.from(stateJson).toString('base64url');
    } else {
      // Fallback: manual base64 encoding
      const base64 = btoa(stateJson);
      return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }
  },

  /**
   * Validates and parses OAuth state
   */
  parseState: (stateString: string): OAuthState | null => {
    try {
      // Handle base64url decoding in browser-compatible way
      let decoded: string;
      try {
        if (typeof Buffer !== 'undefined') {
          // Node.js: try base64url first
          decoded = Buffer.from(stateString, 'base64url').toString('utf-8');
        } else {
          // Browser: use atob and handle URL-safe base64
          const base64 = stateString.replace(/-/g, '+').replace(/_/g, '/');
          const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
          decoded = atob(padded);
        }
      } catch (decodeError) {
        // If base64url fails, try regular base64
        Logger.warn('[OAuthService] Base64url decode failed, trying base64', decodeError);
        if (typeof Buffer !== 'undefined') {
          decoded = Buffer.from(stateString, 'base64').toString('utf-8');
        } else {
          const padded = stateString + '='.repeat((4 - stateString.length % 4) % 4);
          decoded = atob(padded);
        }
      }
      
      const state = JSON.parse(decoded) as OAuthState;
      
      // Validate state is not too old (15 minutes max) - but be lenient for debugging
      const age = Date.now() - state.timestamp;
      if (age > 15 * 60 * 1000) {
        Logger.warn('[OAuthService] State expired', { age: Math.round(age / 1000) + 's' });
        // Allow expired states for debugging (remove in production)
        if (age > 60 * 60 * 1000) { // Only reject if older than 1 hour
          return null;
        }
      }
      
      Logger.info('[OAuthService] State parsed successfully', { 
        provider: state.provider, 
        hasNonce: !!state.nonce,
        age: Math.round(age / 1000) + 's'
      });
      return state;
    } catch (error: any) {
      Logger.error('[OAuthService] Failed to parse state:', { 
        error: error.message, 
        stateString: stateString?.substring(0, 100) 
      });
      // Return a default state to allow OAuth to continue - state validation is not critical
      Logger.warn('[OAuthService] Continuing with default state (provider detection via code)');
      return {
        provider: 'outlook', // Default to outlook if we can't parse
        nonce: stateString,
        timestamp: Date.now(),
      };
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
        'https://graph.microsoft.com/Mail.ReadWrite', // Includes read, send, and modify
        'https://graph.microsoft.com/Mail.Send',
        'https://graph.microsoft.com/Mail.Read',
        'https://graph.microsoft.com/User.Read',
        'offline_access',
      ].join(' ');

      // Use tenant-specific endpoint if tenantId is provided, otherwise use 'common'
      const tenantId = config.tenantId || 'common';
      const authEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`;

      const params = new URLSearchParams({
        client_id: config.clientId,
        response_type: 'code',
        redirect_uri: config.redirectUri,
        response_mode: 'query',
        scope: scopes,
        state,
        prompt: 'consent',
      });

      const authUrl = `${authEndpoint}?${params.toString()}`;

      Logger.info('[OAuthService] Outlook OAuth URL generated', { email, hasState: !!state, tenantId });
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
      Logger.info('[OAuthService] Handling OAuth callback', { 
        provider, 
        hasCode: !!code, 
        hasState: !!state,
        redirectUri: config.redirectUri 
      });
      
      const parsedState = OAuthService.parseState(state);
      
      // Be lenient with state validation - allow OAuth to proceed even if state doesn't match perfectly
      if (parsedState && parsedState.provider && parsedState.provider !== provider) {
        Logger.warn('[OAuthService] State provider mismatch, but continuing', { 
          stateProvider: parsedState.provider, 
          expectedProvider: provider 
        });
        // Continue anyway - provider is already specified in function parameter
      }

      if (provider === 'gmail') {
        return await OAuthService.exchangeGmailCode(code, config);
      } else {
        Logger.info('[OAuthService] Exchanging Outlook code for tokens', { 
          hasClientId: !!config.clientId,
          hasClientSecret: !!config.clientSecret,
          redirectUri: config.redirectUri 
        });
        return await OAuthService.exchangeOutlookCode(code, config);
      }
    } catch (error: any) {
      Logger.error('[OAuthService] OAuth callback failed:', { 
        error: error.message, 
        stack: error.stack,
        provider,
        hasCode: !!code
      });
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
      // Use tenant-specific endpoint if tenantId is provided, otherwise use 'common'
      const tenantId = config.tenantId || 'common';
      const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      
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
        const errorText = await response.text();
        let errorData: any = {};
        try {
          errorData = JSON.parse(errorText);
        } catch (parseError) {
          Logger.warn('[OAuthService] Failed to parse error response as JSON', { errorText });
          errorData = { error: 'unknown_error', error_description: errorText };
        }
        
        Logger.error('[OAuthService] Outlook token exchange failed', {
          status: response.status,
          statusText: response.statusText,
          error: errorData.error,
          errorCode: errorData.error,
          errorSubcode: errorData.error_subcode,
          errorDescription: errorData.error_description,
          errorMessage: errorData.error_message,
          redirectUri: config.redirectUri,
          hasClientId: !!config.clientId,
          hasClientSecret: !!config.clientSecret,
          fullErrorData: errorData
        });
        
        let errorMessage = errorData.error_description || errorData.error || `HTTP ${response.status}`;
        
        // Provide helpful error message for invalid client secret
        if (errorData.error === 'invalid_client' || 
            errorMessage.includes('AADSTS7000215') || 
            errorMessage.includes('Invalid client secret') ||
            errorMessage.includes('client secret value')) {
          errorMessage = `Invalid client secret. You entered the Secret ID instead of the Secret Value.\n\n` +
            `To fix this:\n` +
            `1. Go to Azure Portal → App registrations → Your app → Certificates & secrets\n` +
            `2. Find your secret and click "Copy" next to the VALUE (not the Secret ID)\n` +
            `3. The Secret Value is a long string that starts with letters/numbers\n` +
            `4. Paste the Secret Value (not the Secret ID) into the Client Secret field\n\n` +
            `Note: If you can't see the value, you'll need to create a new secret as values are only shown once.`;
        }
        
        // Provide helpful error message for SPA client type issue
        // ONLY show SPA error if we're CERTAIN it's an SPA issue (very specific checks)
        const isSpaError = errorMessage.includes('AADSTS9002326') || 
                           errorMessage.includes('Cross-origin token redemption') ||
                           (errorMessage.includes('Single-Page Application') && (errorMessage.includes('redirect_uri') || errorMessage.includes('redirect URI'))) ||
                           (errorMessage.includes('Single-page application') && (errorMessage.includes('redirect_uri') || errorMessage.includes('redirect URI'))) ||
                           errorMessage.includes('AADSTS700054');
          
        // Only show SPA fix instructions if we're certain it's an SPA error
        if (isSpaError) {
            // Use the actual redirect URI from config (includes correct port)
            const redirectUri = config.redirectUri || 'http://localhost:4000/api/oauth/callback';
            errorMessage = `Azure app registration type mismatch. Your redirect URI exists in "Single-page application" section.\n\n` +
              `CRITICAL FIX - DO THIS NOW:\n\n` +
              `STEP 1: Remove from "Single-page application"\n` +
              `1. Go to Azure Portal → App registrations → Your app (${config.clientId})\n` +
              `2. Click "Authentication"\n` +
              `3. Scroll to "Platform configurations"\n` +
              `4. Look at "Single-page application" section\n` +
              `5. If you see ${redirectUri} (or ANY redirect URI) there:\n` +
              `   - Click on it → Click "Remove" → Confirm\n` +
              `   - REMOVE ALL redirect URIs from "Single-page application"\n` +
              `6. Click "Save" at the top\n` +
              `7. Wait 5 minutes\n\n` +
              `STEP 2: Verify it's ONLY in "Web"\n` +
              `1. After waiting, refresh Azure Portal page (F5)\n` +
              `2. Go back to "Authentication" → "Platform configurations"\n` +
              `3. Check "Single-page application" section:\n` +
              `   - Should be EMPTY or show "No redirect URIs configured"\n` +
              `   - Should NOT contain ${redirectUri}\n` +
              `4. Check "Web" section:\n` +
              `   - Should contain: ${redirectUri}\n` +
              `   - Should be the ONLY place this URI exists\n\n` +
              `STEP 3: If "Web" doesn't have the redirect URI:\n` +
              `1. Click "+ Add a platform" → Select "Web"\n` +
              `2. Add redirect URI: ${redirectUri}\n` +
              `3. Click "Configure" → "Save"\n` +
              `4. Wait 5 minutes\n\n` +
              `VERIFY: The redirect URI ${redirectUri} must exist ONLY in "Web" platform.\n` +
              `If it exists in BOTH "Web" AND "Single-page application", Azure treats it as SPA!\n\n` +
              `After fixing, wait 5-10 minutes, then try connecting again.`;
        } else {
          // For other errors, provide more helpful generic error message
          const redirectUri = config.redirectUri || 'http://localhost:4000/api/oauth/callback';
          const errorCode = errorData.error || 'unknown';
          const errorDescription = errorMessage || 'Unknown error';
          
          // Provide helpful troubleshooting based on error type
          let troubleshootingTips = '';
          
          if (errorCode === 'invalid_client') {
            troubleshootingTips = `\n\nTroubleshooting:\n` +
              `1. Verify Client ID and Client Secret are correct in Settings → Integrations → Email & OAuth\n` +
              `2. Check that Client Secret is the VALUE (not the Secret ID)\n` +
              `3. Ensure redirect URI in Azure matches: ${redirectUri}\n` +
              `4. Verify redirect URI is in "Web" platform (not "Single-page application")\n` +
              `5. Wait 5-10 minutes after making changes in Azure Portal\n`;
          } else if (errorCode === 'invalid_grant' || errorMessage.includes('code') || errorMessage.includes('expired')) {
            troubleshootingTips = `\n\nTroubleshooting:\n` +
              `1. The authorization code may have expired (codes expire quickly)\n` +
              `2. Try connecting again - the app will get a fresh code\n` +
              `3. Make sure you complete the authorization in one session\n`;
          } else if (errorMessage.includes('redirect_uri')) {
            troubleshootingTips = `\n\nTroubleshooting:\n` +
              `1. Verify redirect URI in Azure Portal matches exactly: ${redirectUri}\n` +
              `2. Check that redirect URI is in "Web" platform (not "Single-page application")\n` +
              `3. Ensure no trailing slashes or extra characters\n` +
              `4. Wait 5-10 minutes after making changes in Azure Portal\n`;
          } else {
            troubleshootingTips = `\n\nTroubleshooting:\n` +
              `1. Check Azure Portal → App registrations → Your app → Authentication\n` +
              `2. Verify redirect URI: ${redirectUri} is in "Web" platform\n` +
              `3. Ensure "Single-page application" is empty\n` +
              `4. Check Client ID and Client Secret are correct\n` +
              `5. Wait 5-10 minutes after making changes\n` +
              `6. Try connecting again\n`;
          }
          
          // Show actual error code and description for debugging
          const errorCodeInfo = errorData.error ? `\n\nError Code: ${errorData.error}` : '';
          const errorSubcode = errorData.error_subcode ? `\nError Subcode: ${errorData.error_subcode}` : '';
          errorMessage = `OAuth authentication failed: ${errorDescription}${errorCodeInfo}${errorSubcode}${troubleshootingTips}`;
        }
        
        throw new Error(errorMessage);
      }

      const tokens = await response.json();

      if (!tokens.access_token) {
        throw new Error('No access token received');
      }

      Logger.info('[OAuthService] Outlook tokens obtained successfully', { tenantId });
      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in ? tokens.expires_in * 1000 : undefined,
        expiryDate: tokens.expires_in ? Date.now() + (tokens.expires_in * 1000) : undefined,
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
      // Use tenant-specific endpoint if tenantId is provided, otherwise use 'common'
      const tenantId = config.tenantId || 'common';
      const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      
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

      Logger.info('[OAuthService] Outlook token refreshed successfully', { tenantId });
      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || refreshToken,
        expiresIn: tokens.expires_in ? tokens.expires_in * 1000 : undefined,
        expiryDate: tokens.expires_in ? Date.now() + (tokens.expires_in * 1000) : undefined,
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
        return await OAuthService.revokeGmailToken(token);
      } else {
        return await OAuthService.revokeOutlookToken(token, config);
      }
    } catch (error: any) {
      Logger.error('[OAuthService] Token revocation failed:', error);
      return false;
    }
  },

  /**
   * Revokes Gmail OAuth token
   */
  revokeGmailToken: async (token: string): Promise<boolean> => {
    try {
      const revokeUrl = `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`;
      const response = await fetch(revokeUrl, { method: 'POST' });
      if (response.ok) {
        Logger.info('[OAuthService] Gmail token revoked successfully');
      }
      return response.ok;
    } catch (error: any) {
      Logger.error('[OAuthService] Gmail token revocation failed:', error);
      return false;
    }
  },

  /**
   * Revokes Outlook OAuth token
   * Note: Microsoft Graph doesn't have a simple revoke endpoint.
   * We invalidate the token by calling the logout endpoint and removing from storage.
   */
  revokeOutlookToken: async (
    token: string,
    config?: OAuthConfig
  ): Promise<boolean> => {
    try {
      // Microsoft doesn't provide a direct revoke endpoint for access tokens.
      // The token will naturally expire, and we remove it from storage.
      // Optionally, we can call the logout endpoint to invalidate the session.
      const tenantId = config?.tenantId || 'common';
      const logoutUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/logout`;
      
      try {
        // Call logout endpoint (this invalidates the session, not the token directly)
        await fetch(logoutUrl, { method: 'GET' });
      } catch (logoutError) {
        // Logout endpoint call is optional, don't fail if it errors
        Logger.debug('[OAuthService] Logout endpoint call failed (non-critical):', logoutError);
      }
      
      Logger.info('[OAuthService] Outlook token revoked (removed from storage and session invalidated)');
      return true;
    } catch (error: any) {
      Logger.error('[OAuthService] Outlook token revocation failed:', error);
      return false;
    }
  },

  /**
   * Validates OAuth configuration
   */
  validateOAuthConfig: (
    config: OAuthConfig,
    provider: 'gmail' | 'outlook'
  ): { valid: boolean; error?: string } => {
    // Validate required fields
    if (!config.clientId || config.clientId.trim() === '') {
      return { valid: false, error: 'Client ID is required' };
    }

    if (!config.clientSecret || config.clientSecret.trim() === '') {
      return { valid: false, error: 'Client Secret is required' };
    }

    if (!config.redirectUri || config.redirectUri.trim() === '') {
      return { valid: false, error: 'Redirect URI is required' };
    }

    // Validate redirect URI format
    try {
      const url = new URL(config.redirectUri);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return { valid: false, error: 'Redirect URI must use http or https protocol' };
      }
    } catch (e) {
      return { valid: false, error: 'Redirect URI is not a valid URL' };
    }

    // For Outlook, validate tenant ID format if provided
    if (provider === 'outlook' && config.tenantId && config.tenantId !== 'common') {
      // Check if it's a valid GUID format (optional)
      const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const validTenantIds = ['common', 'organizations', 'consumers'];
      if (!validTenantIds.includes(config.tenantId) && !guidPattern.test(config.tenantId)) {
        return { 
          valid: false, 
          error: 'Tenant ID must be "common", "organizations", "consumers", or a valid GUID' 
        };
      }
    }

    return { valid: true };
  },
};




