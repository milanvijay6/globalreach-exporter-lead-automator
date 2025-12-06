
import { Importer } from '../types';
import { loadUserSession } from './securityService';
import { IndexedDBService } from './indexedDBService';

// Helper to get storage key for user-specific importers
const getStorageKey = (userId: string): string => `globalreach_data_encrypted_${userId}`;
const GLOBAL_STORAGE_KEY = 'globalreach_data_encrypted';

// Migration flag
let migrationDone = false;

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

// Migrate from localStorage to IndexedDB (one-time)
const migrateToIndexedDB = async (userId: string): Promise<void> => {
  if (migrationDone) return;

  try {
    // Initialize IndexedDB
    await IndexedDBService.init();

    // Check if already migrated
    const existing = await IndexedDBService.getAll<Importer>('importers', 'userId', userId);
    if (existing.length > 0) {
      migrationDone = true;
      return;
    }

    // Try to load from localStorage first
    const storageKey = getStorageKey(userId);
    let importers: Importer[] | null = null;

    // Try user-specific storage
    const userData = localStorage.getItem(storageKey);
    if (userData) {
      try {
        const json = decrypt(userData);
        importers = JSON.parse(json);
      } catch (e) {
        console.warn('[StorageService] Failed to parse user storage:', e);
      }
    }

    // Try global storage if no user data
    if (!importers || importers.length === 0) {
      const globalData = localStorage.getItem(GLOBAL_STORAGE_KEY);
      if (globalData) {
        try {
          const json = decrypt(globalData);
          importers = JSON.parse(json);
        } catch (e) {
          console.warn('[StorageService] Failed to parse global storage:', e);
        }
      }
    }

    // Migrate to IndexedDB
    if (importers && importers.length > 0) {
      console.log(`[StorageService] Migrating ${importers.length} importers from localStorage to IndexedDB`);
      
      // Add userId to each importer
      const importersWithUserId = importers.map(imp => ({
        ...imp,
        userId
      }));

      await IndexedDBService.put('importers', importersWithUserId);
      console.log('[StorageService] Migration to IndexedDB completed');
    }

    migrationDone = true;
  } catch (error) {
    console.error('[StorageService] Migration to IndexedDB failed:', error);
    // Continue with localStorage fallback
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

      // Ensure migration is done
      await migrateToIndexedDB(currentUserId);

      try {
        // Try IndexedDB first
        await IndexedDBService.init();
        const importersWithUserId = importers.map(imp => ({
          ...imp,
          userId: currentUserId
        }));
        await IndexedDBService.put('importers', importersWithUserId);
        console.log(`[StorageService] Saved ${importers.length} records to IndexedDB for user ${currentUserId}.`);
      } catch (indexedDBError) {
        // Fallback to localStorage
        console.warn('[StorageService] IndexedDB save failed, falling back to localStorage:', indexedDBError);
        const storageKey = getStorageKey(currentUserId);
        const json = JSON.stringify(importers);
        const encrypted = encrypt(json);
        localStorage.setItem(storageKey, encrypted);
        console.log(`[StorageService] Saved ${importers.length} records to localStorage for user ${currentUserId}.`);
      }
    } catch (e) {
      console.error("Failed to save importers", e);
    }
  },

  loadImporters: async (userId?: string): Promise<Importer[] | null> => {
    try {
      const currentUserId = userId || await getCurrentUserId();
      
      if (currentUserId) {
        // Ensure migration is done
        await migrateToIndexedDB(currentUserId);

        try {
          // Try IndexedDB first
          await IndexedDBService.init();
          const importers = await IndexedDBService.getAll<Importer>('importers', 'userId', currentUserId);
          if (importers && importers.length > 0) {
            // Remove userId from importer objects before returning
            const cleaned = importers.map(({ userId, ...imp }) => imp);
            console.log(`[StorageService] Loaded ${cleaned.length} records from IndexedDB for user ${currentUserId}.`);
            return cleaned;
          }
        } catch (indexedDBError) {
          console.warn('[StorageService] IndexedDB load failed, falling back to localStorage:', indexedDBError);
        }

        // Fallback to localStorage
        const storageKey = getStorageKey(currentUserId);
        const encrypted = localStorage.getItem(storageKey);
        if (!encrypted) return null;
        
        try {
          const json = decrypt(encrypted);
          const importers = JSON.parse(json);
          console.log(`[StorageService] Loaded ${importers.length} records from localStorage for user ${currentUserId}.`);
          return importers;
        } catch (e) {
          console.error("Failed to load importers from localStorage", e);
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
        try {
          // Clear IndexedDB
          await IndexedDBService.init();
          const importers = await IndexedDBService.getAll<Importer>('importers', 'userId', currentUserId);
          if (importers.length > 0) {
            await IndexedDBService.remove('importers', importers.map(i => i.id));
            console.log(`[StorageService] Cleared ${importers.length} records from IndexedDB for user ${currentUserId}`);
          }
        } catch (indexedDBError) {
          console.warn('[StorageService] IndexedDB clear failed, clearing localStorage:', indexedDBError);
        }

        // Also clear localStorage
        const storageKey = getStorageKey(currentUserId);
        localStorage.removeItem(storageKey);
        console.log(`[StorageService] Cleared localStorage for user ${currentUserId}`);
      } else {
        localStorage.removeItem(GLOBAL_STORAGE_KEY);
        console.log('[StorageService] Cleared global storage');
      }
    } catch (e) {
      console.error("Failed to clear storage", e);
    }
  }
};
