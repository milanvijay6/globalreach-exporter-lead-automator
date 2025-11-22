
import { PlatformService } from './platformService';
import { isDesktop } from './platformService';

/**
 * Tunnel Service for managing webhook URLs
 * Supports both local development (with tunnel) and production environments
 */
export const TunnelService = {
  /**
   * Gets the current webhook URL (either tunnel URL or production URL)
   */
  getWebhookUrl: async (): Promise<string> => {
    const tunnelUrl = await PlatformService.getAppConfig('tunnelUrl', '');
    const productionUrl = await PlatformService.getAppConfig('productionWebhookUrl', '');
    
    // Prefer production URL if set, otherwise use tunnel URL
    if (productionUrl) {
      return productionUrl;
    }
    
    if (tunnelUrl) {
      return tunnelUrl;
    }
    
    // Fallback: construct local URL (for Electron)
    if (isDesktop()) {
      const port = await PlatformService.getAppConfig('serverPort', 4000);
      return `http://localhost:${port}`;
    }
    
    // Web fallback (not recommended for production)
    return window.location.origin;
  },

  /**
   * Sets the tunnel URL (for local development)
   */
  setTunnelUrl: async (url: string): Promise<void> => {
    await PlatformService.setAppConfig('tunnelUrl', url);
  },

  /**
   * Sets the production webhook URL
   */
  setProductionUrl: async (url: string): Promise<void> => {
    await PlatformService.setAppConfig('productionWebhookUrl', url);
  },

  /**
   * Gets the full webhook endpoint URL
   */
  getWebhookEndpoint: async (): Promise<string> => {
    const baseUrl = await TunnelService.getWebhookUrl();
    return `${baseUrl}/webhooks/whatsapp`;
  },

  /**
   * Detects if we're in a local development environment
   */
  isLocalDevelopment: (): boolean => {
    if (typeof window === 'undefined') return false;
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1' ||
           isDesktop();
  },

  /**
   * Gets instructions for setting up a local tunnel
   */
  getTunnelInstructions: (): { service: string; instructions: string[] }[] => {
    return [
      {
        service: 'ngrok',
        instructions: [
          'Install ngrok: https://ngrok.com/download',
          'Run: ngrok http 4000',
          'Copy the HTTPS URL (e.g., https://abc123.ngrok.io)',
          'Paste it in the Tunnel URL field below'
        ]
      },
      {
        service: 'localtunnel',
        instructions: [
          'Install: npm install -g localtunnel',
          'Run: lt --port 4000',
          'Copy the HTTPS URL provided',
          'Paste it in the Tunnel URL field below'
        ]
      },
      {
        service: 'Cloudflare Tunnel',
        instructions: [
          'Install cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/',
          'Run: cloudflared tunnel --url http://localhost:4000',
          'Copy the HTTPS URL provided',
          'Paste it in the Tunnel URL field below'
        ]
      }
    ];
  },

  /**
   * Validates a webhook URL format
   */
  validateWebhookUrl: (url: string): { valid: boolean; error?: string } => {
    if (!url.trim()) {
      return { valid: false, error: 'URL cannot be empty' };
    }

    try {
      const parsed = new URL(url);
      
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return { valid: false, error: 'URL must use http:// or https://' };
      }

      // For production, HTTPS is required
      if (!TunnelService.isLocalDevelopment() && parsed.protocol !== 'https:') {
        return { valid: false, error: 'Production webhooks must use HTTPS' };
      }

      return { valid: true };
    } catch (e) {
      return { valid: false, error: 'Invalid URL format' };
    }
  }
};

