/**
 * WhatsApp Web Service
 * Handles WhatsApp Web automation using whatsapp-web.js library
 */

interface WhatsAppWebConfig {
  enabled: boolean;
  useAsFallback: boolean;
  sessionPath?: string;
}

class WhatsAppWebServiceClass {
  private client: any = null;
  private isInitialized: boolean = false;
  private isReady: boolean = false;
  private qrCode: string | null = null;
  private config: WhatsAppWebConfig;

  constructor(config?: Partial<WhatsAppWebConfig>) {
    this.config = {
      enabled: false,
      useAsFallback: true,
      ...config,
    };
  }

  /**
   * Initialize WhatsApp Web client
   */
  async initialize(): Promise<{ success: boolean; qrCode?: string; error?: string }> {
    if (this.isInitialized) {
      return { success: true, qrCode: this.qrCode || undefined };
    }

    // Use Electron IPC if available (main process handles the actual client)
    if (typeof window !== 'undefined' && (window as any).electronAPI?.whatsappWebInit) {
      try {
        const result = await (window as any).electronAPI.whatsappWebInit(this.config);
        if (result.success) {
          this.isInitialized = true;
          this.qrCode = result.qrCode || null;
          this.isReady = result.ready || false;
        }
        return result;
      } catch (error: any) {
        console.error('[WhatsAppWebService] IPC initialization failed:', error);
        return {
          success: false,
          error: error.message || 'Failed to initialize WhatsApp Web via IPC',
        };
      }
    }

    // Note: Direct initialization removed - WhatsApp Web must be used via Electron IPC
    // The main process handles whatsapp-web.js initialization
    return {
      success: false,
      error: 'WhatsApp Web requires Electron environment. Please use Electron IPC.',
    };
  }

  /**
   * Send a message
   */
  async sendMessage(to: string, content: string): Promise<{ success: boolean; error?: string }> {
    // Use Electron IPC if available
    if (typeof window !== 'undefined' && (window as any).electronAPI?.whatsappWebSend) {
      try {
        const result = await (window as any).electronAPI.whatsappWebSend(to, content);
        return result;
      } catch (error: any) {
        console.error('[WhatsAppWebService] IPC send failed:', error);
        return {
          success: false,
          error: error.message || 'Failed to send message via IPC',
        };
      }
    }

    // Note: Direct send removed - WhatsApp Web must be used via Electron IPC
    return {
      success: false,
      error: 'WhatsApp Web requires Electron environment. Please use Electron IPC.',
    };
  }

  /**
   * Get connection status
   */
  async getStatus(): Promise<{
    initialized: boolean;
    ready: boolean;
    qrCode: string | null;
  }> {
    // Use Electron IPC if available
    if (typeof window !== 'undefined' && (window as any).electronAPI?.whatsappWebGetStatus) {
      try {
        const status = await (window as any).electronAPI.whatsappWebGetStatus();
        this.isInitialized = status.initialized;
        this.isReady = status.ready;
        this.qrCode = status.qrCode;
        return status;
      } catch (error) {
        console.error('[WhatsAppWebService] Failed to get status via IPC:', error);
      }
    }

    return {
      initialized: this.isInitialized,
      ready: this.isReady,
      qrCode: this.qrCode,
    };
  }

  /**
   * Disconnect client
   */
  async disconnect(): Promise<void> {
    // Use Electron IPC if available
    if (typeof window !== 'undefined' && (window as any).electronAPI?.whatsappWebDisconnect) {
      await (window as any).electronAPI.whatsappWebDisconnect();
    }
    
    this.client = null;
    this.isInitialized = false;
    this.isReady = false;
    this.qrCode = null;
  }

  // Event handlers are set up in Electron main process
  // This method is kept for compatibility but does nothing in renderer
  private setupEventHandlers(): void {
    // Event handlers are managed by Electron main process via IPC
  }

  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // If doesn't start with country code, assume it's missing
    // This is a simple implementation - may need enhancement
    if (cleaned.length < 10) {
      // Invalid phone number
      throw new Error('Invalid phone number format');
    }
    
    return cleaned;
  }

  private async getDefaultSessionPath(): Promise<string> {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.getPath) {
      const userDataPath = await (window as any).electronAPI.getPath('userData');
      return `${userDataPath}/whatsapp-web-session`;
    }
    return './whatsapp-web-session';
  }
}

// Import types
import { Channel } from '../types';

// Import listener (will be set by MessagingService)
let incomingListener: ((importerId: string | null, contactDetail: string, content: string, channel: Channel) => void) | null = null;

// Singleton instance
let whatsappWebServiceInstance: WhatsAppWebServiceClass | null = null;

export const WhatsAppWebService = {
  /**
   * Get or create service instance
   */
  getInstance: (config?: Partial<WhatsAppWebConfig>): WhatsAppWebServiceClass => {
    if (!whatsappWebServiceInstance) {
      whatsappWebServiceInstance = new WhatsAppWebServiceClass(config);
    }
    return whatsappWebServiceInstance;
  },

  /**
   * Initialize service
   */
  initialize: async (config?: Partial<WhatsAppWebConfig>): Promise<{ success: boolean; qrCode?: string; error?: string }> => {
    const instance = WhatsAppWebService.getInstance(config);
    return await instance.initialize();
  },

  /**
   * Send message
   */
  sendMessage: async (to: string, content: string): Promise<{ success: boolean; error?: string }> => {
    const instance = WhatsAppWebService.getInstance();
    return await instance.sendMessage(to, content);
  },

  /**
   * Get status
   */
  getStatus: async (): Promise<{ initialized: boolean; ready: boolean; qrCode: string | null }> => {
    const instance = WhatsAppWebService.getInstance();
    return await instance.getStatus();
  },

  /**
   * Disconnect
   */
  disconnect: async (): Promise<void> => {
    const instance = WhatsAppWebService.getInstance();
    await instance.disconnect();
    whatsappWebServiceInstance = null;
  },

  /**
   * Set incoming message listener (called by MessagingService)
   */
  setIncomingListener: (listener: (importerId: string | null, contactDetail: string, content: string, channel: Channel) => void): void => {
    incomingListener = listener;
  },
};

export type { WhatsAppWebConfig };

