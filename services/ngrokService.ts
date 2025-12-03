import { PlatformService } from './platformService';

/**
 * Ngrok Service - Automatically starts ngrok tunnel for webhooks
 */

let ngrokInstance: any = null;
let ngrokUrl: string | null = null;
let isStarting = false;

export const NgrokService = {
  /**
   * Starts ngrok tunnel automatically
   */
  start: async (port: number = 4000): Promise<string | null> => {
    if (isStarting) {
      console.log('[NgrokService] Already starting, waiting...');
      // Wait for existing start to complete
      let attempts = 0;
      while (isStarting && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }
      return ngrokUrl;
    }

    // If already started, return existing URL
    if (ngrokInstance && ngrokUrl) {
      console.log('[NgrokService] Ngrok already running:', ngrokUrl);
      return ngrokUrl;
    }

    isStarting = true;

    try {
      // Check if auto-start is enabled
      const autoStartNgrok = await PlatformService.getAppConfig('autoStartNgrok', true);
      
      if (!autoStartNgrok) {
        console.log('[NgrokService] Auto-start disabled in settings');
        isStarting = false;
        return null;
      }

      console.log('[NgrokService] Starting ngrok tunnel on port', port);

      // Dynamically import @ngrok/ngrok
      const ngrok = await import('@ngrok/ngrok');

      // Start ngrok tunnel
      const listener = await ngrok.forward({
        addr: port,
        authtoken_from_env: false, // We'll handle auth separately if needed
      });

      ngrokInstance = listener;
      ngrokUrl = listener.url();

      console.log('[NgrokService] ✅ Ngrok tunnel started:', ngrokUrl);

      // Save to config
      await PlatformService.setAppConfig('ngrokUrl', ngrokUrl);
      await PlatformService.setAppConfig('webhookUrl', `${ngrokUrl}/webhooks/whatsapp`);

      // Notify renderer if possible
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        try {
          (window as any).electronAPI.logMessage('info', 'Ngrok started', { url: ngrokUrl });
        } catch (e) {
          // Ignore if not available
        }
      }

      isStarting = false;
      return ngrokUrl;
    } catch (error: any) {
      isStarting = false;
      console.error('[NgrokService] Failed to start ngrok:', error);
      
      // If ngrok package fails, try spawning ngrok process as fallback
      if (error.message?.includes('ngrok') || error.code === 'MODULE_NOT_FOUND') {
        console.log('[NgrokService] Attempting fallback: spawn ngrok process');
        return await NgrokService.startFallback(port);
      }

      return null;
    }
  },

  /**
   * Fallback: Start ngrok using child process
   */
  startFallback: async (port: number): Promise<string | null> => {
    return new Promise((resolve) => {
      // This will be implemented in main.js using child_process
      // For now, return null and let main.js handle it
      resolve(null);
    });
  },

  /**
   * Stops ngrok tunnel
   */
  stop: async (): Promise<void> => {
    if (ngrokInstance) {
      try {
        await ngrokInstance.close();
        console.log('[NgrokService] Ngrok tunnel stopped');
      } catch (error: any) {
        console.error('[NgrokService] Error stopping ngrok:', error);
      }
      ngrokInstance = null;
      ngrokUrl = null;
    }
  },

  /**
   * Gets current ngrok URL
   */
  getUrl: (): string | null => {
    return ngrokUrl;
  },

  /**
   * Gets webhook URL
   */
  getWebhookUrl: (): string | null => {
    if (ngrokUrl) {
      return `${ngrokUrl}/webhooks/whatsapp`;
    }
    return null;
  },

  /**
   * Checks if ngrok is running
   */
  isRunning: (): boolean => {
    return ngrokInstance !== null && ngrokUrl !== null;
  },
};








