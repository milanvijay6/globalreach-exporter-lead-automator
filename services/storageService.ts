
import { Importer } from '../types';
import { loadUserSession } from './securityService';

// Helper to get storage key for user-specific importers
const getStorageKey = (userId: string): string => `globalreach_data_encrypted_${userId}`;
const GLOBAL_STORAGE_KEY = 'globalreach_data_encrypted';

// Simple mock encryption/decryption to demonstrate secure storage intent
// In a production app, this would use Web Crypto API or server-side encryption
const encrypt = (data: string): string => {
  try {
    // Mock encryption: Base64 encode
    return btoa(encodeURIComponent(data));
  } catch (e) {
    console.error("Encryption failed", e);
    return data;
  }
};

const decrypt = (data: string): string => {
  try {
    // Mock decryption
    return decodeURIComponent(atob(data));
  } catch (e) {
    console.error("Decryption failed", e);
    return "[]";
  }
};

// Helper to get current user ID
const getCurrentUserId = async (): Promise<string | null> => {
  try {
    const user = await loadUserSession();
    return user?.id || null;
  } catch (error) {
    console.error('[StorageService] Failed to get current user:', error);
    return null;
  }
};

// Migrate global importers to user-specific storage
const migrateGlobalImporters = async (userId: string): Promise<void> => {
  try {
    // Check if user already has importers (migration already done)
    const userKey = getStorageKey(userId);
    const userData = localStorage.getItem(userKey);
    if (userData) {
      return; // Already migrated
    }

    // Check for global importers
    const globalData = localStorage.getItem(GLOBAL_STORAGE_KEY);
    if (globalData) {
      console.log(`[StorageService] Migrating global importers to user ${userId}`);
      // Copy global importers to user-specific storage
      localStorage.setItem(userKey, globalData);
      console.log('[StorageService] Migration completed');
    }
  } catch (error) {
    console.error('[StorageService] Migration failed:', error);
  }
};

export const StorageService = {
  saveImporters: async (importers: Importer[], userId?: string) => {
    try {
      const currentUserId = userId || await getCurrentUserId();
      if (!currentUserId) {
        console.warn('[StorageService] No user ID available, saving to global storage');
        // Fallback to global storage if no user ID
        const json = JSON.stringify(importers);
        const encrypted = encrypt(json);
        localStorage.setItem(GLOBAL_STORAGE_KEY, encrypted);
        console.log(`[StorageService] Saved ${importers.length} records to global storage.`);
        return;
      }

      const storageKey = getStorageKey(currentUserId);
      const json = JSON.stringify(importers);
      const encrypted = encrypt(json);
      localStorage.setItem(storageKey, encrypted);
      console.log(`[StorageService] Saved ${importers.length} records for user ${currentUserId}.`);
    } catch (e) {
      console.error("Failed to save importers", e);
    }
  },

  loadImporters: async (userId?: string): Promise<Importer[] | null> => {
    try {
      const currentUserId = userId || await getCurrentUserId();
      
      if (currentUserId) {
        // Migrate global data if needed
        await migrateGlobalImporters(currentUserId);
        
        const storageKey = getStorageKey(currentUserId);
        const encrypted = localStorage.getItem(storageKey);
        if (!encrypted) return null;
        
        try {
          const json = decrypt(encrypted);
          return JSON.parse(json);
        } catch (e) {
          console.error("Failed to load importers", e);
          return null;
        }
      } else {
        // Fallback to global storage if no user ID
        const encrypted = localStorage.getItem(GLOBAL_STORAGE_KEY);
        if (!encrypted) return null;
        
        try {
          const json = decrypt(encrypted);
          return JSON.parse(json);
        } catch (e) {
          console.error("Failed to load importers", e);
          return null;
        }
      }
    } catch (e) {
      console.error("Failed to load importers", e);
      return null;
    }
  },

  clearStorage: async (userId?: string) => {
    try {
      const currentUserId = userId || await getCurrentUserId();
      if (currentUserId) {
        const storageKey = getStorageKey(currentUserId);
        localStorage.removeItem(storageKey);
        console.log(`[StorageService] Cleared storage for user ${currentUserId}`);
      } else {
        localStorage.removeItem(GLOBAL_STORAGE_KEY);
        console.log('[StorageService] Cleared global storage');
      }
    } catch (e) {
      console.error("Failed to clear storage", e);
    }
  }
};
