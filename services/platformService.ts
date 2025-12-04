
// Type definition for the window object extension
declare global {
  interface Window {
    electronAPI?: {
      secureSave: (key: string, value: string) => Promise<boolean>;
      secureLoad: (key: string) => Promise<string | null>;
      getConfig: (key: string) => Promise<any>;
      setConfig: (key: string, value: any) => Promise<boolean>;
      resetApp: () => Promise<boolean>;
      getAppVersion: () => Promise<string>;
      installUpdate: () => Promise<void>;
      onUpdateAvailable: (callback: () => void) => void;
      onUpdateReady: (callback: () => void) => void;
      onWebhookPayload: (callback: (event: any, data: {channel: string, payload: any, timestamp: number}) => void) => void;
      backupData: (data: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      restoreData: () => Promise<{ success: boolean; data?: string; error?: string }>;
      logMessage: (level: string, message: string, data?: any) => void;
      getLogPath: () => Promise<string>;
      platform: string;
    };
  }
}

export const isDesktop = (): boolean => {
  return !!window.electronAPI;
};

export const PlatformService = {
  /**
   * Securely saves a value. 
   * On Desktop: Uses OS Keychain via Electron safeStorage.
   * On Web: Uses localStorage (Base64 encoded only, not truly secure).
   */
  secureSave: async (key: string, value: string): Promise<void> => {
    if (window.electronAPI) {
      await window.electronAPI.secureSave(key, value);
    } else {
      // Web Fallback
      localStorage.setItem(`web_secure_${key}`, btoa(value));
    }
  },

  secureLoad: async (key: string): Promise<string | null> => {
    if (window.electronAPI) {
      return await window.electronAPI.secureLoad(key);
    } else {
      // Web Fallback
      const val = localStorage.getItem(`web_secure_${key}`);
      return val ? atob(val) : null;
    }
  },

  getAppConfig: async (key: string, defaultValue: any): Promise<any> => {
    if (window.electronAPI) {
      const val = await window.electronAPI.getConfig(key);
      return val !== undefined ? val : defaultValue;
    }
    // Web: Use API service
    try {
      const { apiService } = await import('./apiService');
      const response = await apiService.get<{ success: boolean; value: any; userId?: string | null }>(`/api/config/${key}?default=${encodeURIComponent(JSON.stringify(defaultValue))}`);
      if (response.success) {
        // Also save to localStorage as backup
        const storageKey = response.userId ? `config_${response.userId}_${key}` : `config_${key}`;
        try {
          localStorage.setItem(storageKey, JSON.stringify(response.value));
        } catch (e) {
          // Ignore localStorage errors
        }
        return response.value;
      }
      return defaultValue;
    } catch (error) {
      console.warn('[PlatformService] Failed to get config from API, using localStorage fallback:', error);
      // Fallback to localStorage - try user-specific first, then global (with migration)
      let userId: string | null = null;
      try {
        const sessionData = localStorage.getItem('web_secure_globalreach_user_session');
        if (sessionData) {
          const parsed = JSON.parse(atob(sessionData));
          if (parsed && parsed.user && parsed.user.id) {
            userId = parsed.user.id;
          }
        }
      } catch (e) {
        // Ignore errors
      }

      // Try user-specific config first
      if (userId) {
        const userKey = `config_${userId}_${key}`;
        const userVal = localStorage.getItem(userKey);
        if (userVal !== null) {
          try {
            return JSON.parse(userVal);
          } catch (e) {
            // If not JSON, treat as string
            if (userVal === 'true') return true;
            if (userVal === 'false') return false;
            return userVal;
          }
        }
        
        // Migration: Check for global config and migrate to user-specific
        const globalKey = `config_${key}`;
        const globalVal = localStorage.getItem(globalKey);
        if (globalVal !== null) {
          console.log(`[PlatformService] Migrating global config '${key}' to user-specific for user ${userId}`);
          try {
            let migratedValue: any;
            try {
              migratedValue = JSON.parse(globalVal);
            } catch (e) {
              // If not JSON, treat as string
              if (globalVal === 'true') migratedValue = true;
              else if (globalVal === 'false') migratedValue = false;
              else migratedValue = globalVal;
            }
            // Save to user-specific storage
            localStorage.setItem(userKey, JSON.stringify(migratedValue));
            return migratedValue;
          } catch (e) {
            console.error(`[PlatformService] Failed to migrate config '${key}':`, e);
          }
        }
      }

      // Fallback to global config (for backward compatibility)
      const val = localStorage.getItem(`config_${key}`);
      if (val === null) return defaultValue;
      try {
        return JSON.parse(val);
      } catch (e) {
        // If not JSON, treat as string
        if (val === 'true') return true;
        if (val === 'false') return false;
        return val;
      }
    }
  },

  setAppConfig: async (key: string, value: any): Promise<void> => {
    if (window.electronAPI) {
      await window.electronAPI.setConfig(key, value);
    } else {
      // Web: Use API service
      try {
        const { apiService } = await import('./apiService');
        const response = await apiService.post<{ success: boolean; userId?: string | null }>(`/api/config/${key}`, { value });
        // Also save to localStorage as backup
        if (response.success) {
          const userId = response.userId;
          const storageKey = userId ? `config_${userId}_${key}` : `config_${key}`;
          try {
            localStorage.setItem(storageKey, JSON.stringify(value));
          } catch (e) {
            // Ignore localStorage errors
          }
        }
      } catch (error) {
        console.warn('[PlatformService] Failed to set config via API, using localStorage fallback:', error);
        // Fallback to localStorage - save as user-specific if userId available
        let userId: string | null = null;
        try {
          const sessionData = localStorage.getItem('web_secure_globalreach_user_session');
          if (sessionData) {
            const parsed = JSON.parse(atob(sessionData));
            if (parsed && parsed.user && parsed.user.id) {
              userId = parsed.user.id;
            }
          }
        } catch (e) {
          // Ignore errors
        }

        const storageKey = userId ? `config_${userId}_${key}` : `config_${key}`;
        try {
          localStorage.setItem(storageKey, JSON.stringify(value));
        } catch (e) {
          console.error('[PlatformService] Failed to save to localStorage:', e);
        }
      }
    }
  },

  getVersion: async (): Promise<string> => {
    if (window.electronAPI) {
      return await window.electronAPI.getAppVersion();
    }
    return "1.0.0 (Web)";
  },

  installUpdate: async () => {
    if (window.electronAPI) {
      await window.electronAPI.installUpdate();
    }
  },

  /**
   * Creates an encrypted backup.
   * Desktop: Dialog Save + AES.
   * Web: JSON Download.
   */
  backupData: async (data: string): Promise<{ success: boolean; path?: string; error?: string }> => {
    if (window.electronAPI) {
      return await window.electronAPI.backupData(data);
    } else {
      try {
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `GlobalReach_Backup_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return { success: true };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }
  },

  /**
   * Restores data.
   * Desktop: Dialog Open + AES Decrypt.
   * Web: File Input Upload + JSON Parse.
   */
  restoreData: async (): Promise<{ success: boolean; data?: string; error?: string }> => {
    if (window.electronAPI) {
      return await window.electronAPI.restoreData();
    } else {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e: any) => {
          const file = e.target.files[0];
          if (!file) {
            resolve({ success: false, error: "No file selected" });
            return;
          }
          const reader = new FileReader();
          reader.onload = (evt) => {
            resolve({ success: true, data: evt.target?.result as string });
          };
          reader.readAsText(file);
        };
        input.click();
      });
    }
  },

  /**
   * Resets the application configuration, triggering the Setup Wizard on next load.
   */
  resetConfiguration: async (): Promise<void> => {
    if (window.electronAPI) {
        await window.electronAPI.resetApp();
    } else {
        localStorage.removeItem('config_setupComplete');
        localStorage.removeItem('config_webhookToken');
        localStorage.removeItem('config_tunnelUrl');
        localStorage.removeItem('web_secure_user_provided_api_key');
        localStorage.removeItem('web_secure_globalreach_platforms');
        localStorage.removeItem('web_secure_globalreach_user_session');
    }
    // Reload to trigger the wizard
    window.location.reload();
  }
};
        console.warn('[PlatformService] Failed to set config via API, using localStorage fallback:', error);
        // Fallback to localStorage - save as user-specific if userId available
        let userId: string | null = null;
        try {
          const sessionData = localStorage.getItem('web_secure_globalreach_user_session');
          if (sessionData) {
            const parsed = JSON.parse(atob(sessionData));
            if (parsed && parsed.user && parsed.user.id) {
              userId = parsed.user.id;
            }
          }
        } catch (e) {
          // Ignore errors
        }

        const storageKey = userId ? `config_${userId}_${key}` : `config_${key}`;
        try {
          localStorage.setItem(storageKey, JSON.stringify(value));
        } catch (e) {
          console.error('[PlatformService] Failed to save to localStorage:', e);
        }
      }
    }
  },

  getVersion: async (): Promise<string> => {
    if (window.electronAPI) {
      return await window.electronAPI.getAppVersion();
    }
    return "1.0.0 (Web)";
  },

  installUpdate: async () => {
    if (window.electronAPI) {
      await window.electronAPI.installUpdate();
    }
  },

  /**
   * Creates an encrypted backup.
   * Desktop: Dialog Save + AES.
   * Web: JSON Download.
   */
  backupData: async (data: string): Promise<{ success: boolean; path?: string; error?: string }> => {
    if (window.electronAPI) {
      return await window.electronAPI.backupData(data);
    } else {
      try {
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `GlobalReach_Backup_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return { success: true };
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }
  },

  /**
   * Restores data.
   * Desktop: Dialog Open + AES Decrypt.
   * Web: File Input Upload + JSON Parse.
   */
  restoreData: async (): Promise<{ success: boolean; data?: string; error?: string }> => {
    if (window.electronAPI) {
      return await window.electronAPI.restoreData();
    } else {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e: any) => {
          const file = e.target.files[0];
          if (!file) {
            resolve({ success: false, error: "No file selected" });
            return;
          }
          const reader = new FileReader();
          reader.onload = (evt) => {
            resolve({ success: true, data: evt.target?.result as string });
          };
          reader.readAsText(file);
        };
        input.click();
      });
    }
  },

  /**
   * Resets the application configuration, triggering the Setup Wizard on next load.
   */
  resetConfiguration: async (): Promise<void> => {
    if (window.electronAPI) {
        await window.electronAPI.resetApp();
    } else {
        localStorage.removeItem('config_setupComplete');
        localStorage.removeItem('config_webhookToken');
        localStorage.removeItem('config_tunnelUrl');
        localStorage.removeItem('web_secure_user_provided_api_key');
        localStorage.removeItem('web_secure_globalreach_platforms');
        localStorage.removeItem('web_secure_globalreach_user_session');
    }
    // Reload to trigger the wizard
    window.location.reload();
  }
};