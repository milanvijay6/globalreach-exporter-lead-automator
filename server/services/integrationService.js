const Integration = require('../models/Integration');
const Config = require('../models/Config');
const crypto = require('crypto');

// Use node-fetch for Node.js (Node 18+ has built-in fetch, but node-fetch is more reliable)
let fetch;
try {
  // Try built-in fetch first (Node 18+)
  if (typeof globalThis !== 'undefined' && globalThis.fetch) {
    fetch = globalThis.fetch;
  } else {
    fetch = require('node-fetch');
  }
} catch (e) {
  // Fallback to node-fetch if built-in not available
  fetch = require('node-fetch');
}

/**
 * Integration Service - Handles OAuth and integration management
 */
class IntegrationService {
  static async getOAuthUrl(service, userId = null) {
    try {
      const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
      
      if (service === 'outlook') {
        const clientId = await Config.get('outlookClientId', '');
        const tenantId = await Config.get('outlookTenantId', 'common');
        const redirectUri = `${baseUrl}/api/oauth/callback`;
        
        if (!clientId) {
          throw new Error('Outlook Client ID not configured');
        }
        
        const scopes = encodeURIComponent('https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/User.Read https://graph.microsoft.com/offline_access');
        const state = Buffer.from(JSON.stringify({ provider: 'outlook', timestamp: Date.now() })).toString('base64url');
        
        return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&response_mode=query&scope=${scopes}&state=${state}`;
      }
      
      // Add other services (WhatsApp, WeChat) as needed
      throw new Error(`OAuth not implemented for service: ${service}`);
    } catch (error) {
      console.error('[IntegrationService] Error getting OAuth URL:', error);
      throw error;
    }
  }

  static async exchangeCode(service, code, state, userId = null) {
    try {
      if (service === 'outlook') {
        return await this.exchangeOutlookCode(code, state, userId);
      }
      
      throw new Error(`Code exchange not implemented for service: ${service}`);
    } catch (error) {
      console.error('[IntegrationService] Error exchanging code:', error);
      throw error;
    }
  }

  static async exchangeOutlookCode(code, state, userId = null) {
    try {
      const clientId = await Config.get('outlookClientId', '');
      const clientSecret = await Config.get('outlookClientSecret', '');
      const tenantId = await Config.get('outlookTenantId', 'common');
      const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
      const redirectUri = `${baseUrl}/api/oauth/callback`;
      
      if (!clientId || !clientSecret) {
        throw new Error('Outlook credentials not configured');
      }
      
      const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error_description || 'Failed to exchange code');
      }
      
      const tokens = await response.json();
      
      // Save tokens to Integration model
      await Integration.set('outlook', {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in,
        expiryDate: Date.now() + (tokens.expires_in * 1000),
        tokenType: tokens.token_type,
      }, userId);
      
      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in,
        expiryDate: Date.now() + (tokens.expires_in * 1000),
      };
    } catch (error) {
      console.error('[IntegrationService] Error exchanging Outlook code:', error);
      throw error;
    }
  }

  static async refreshToken(service, refreshToken, userId = null) {
    try {
      if (service === 'outlook') {
        return await this.refreshOutlookToken(refreshToken, userId);
      }
      
      throw new Error(`Token refresh not implemented for service: ${service}`);
    } catch (error) {
      console.error('[IntegrationService] Error refreshing token:', error);
      throw error;
    }
  }

  static async refreshOutlookToken(refreshToken, userId = null) {
    try {
      const clientId = await Config.get('outlookClientId', '');
      const clientSecret = await Config.get('outlookClientSecret', '');
      const tenantId = await Config.get('outlookTenantId', 'common');
      const baseUrl = process.env.BASE_URL || 'http://localhost:4000';
      const redirectUri = `${baseUrl}/api/oauth/callback`;
      
      const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          redirect_uri: redirectUri,
          grant_type: 'refresh_token',
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error_description || 'Failed to refresh token');
      }
      
      const tokens = await response.json();
      
      // Update tokens in Integration model
      await Integration.set('outlook', {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || refreshToken,
        expiresIn: tokens.expires_in,
        expiryDate: Date.now() + (tokens.expires_in * 1000),
        tokenType: tokens.token_type,
      }, userId);
      
      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || refreshToken,
        expiresIn: tokens.expires_in,
        expiryDate: Date.now() + (tokens.expires_in * 1000),
      };
    } catch (error) {
      console.error('[IntegrationService] Error refreshing Outlook token:', error);
      throw error;
    }
  }

  static async disconnect(service, userId = null) {
    try {
      await Integration.delete(service, userId);
      return true;
    } catch (error) {
      console.error('[IntegrationService] Error disconnecting:', error);
      throw error;
    }
  }

  static async getStatus(userId = null) {
    try {
      const integrations = await Integration.getAll(userId);
      const status = {};
      
      for (const integration of integrations) {
        status[integration.service] = {
          isConnected: true,
          account: integration.account || 'Unknown',
          lastSync: integration.lastSync || null,
          healthStatus: integration.healthStatus || 'healthy',
          tokenExpiry: integration.expiryDate || null,
        };
      }
      
      return status;
    } catch (error) {
      console.error('[IntegrationService] Error getting status:', error);
      throw error;
    }
  }
}

module.exports = IntegrationService;

