/**
 * Mobile Storage Service
 * Wrapper around Capacitor Preferences API for offline-first persistence
 * Falls back to localStorage for web platform
 */

import { Preferences } from '@capacitor/preferences';
import { bridgeBatchService } from './bridgeBatchService';

/**
 * Check if running on mobile (Capacitor)
 */
function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).Capacitor;
}

/**
 * Mobile Storage Service
 * Uses Capacitor Preferences on mobile, localStorage on web
 */
export const MobileStorageService = {
  /**
   * Get a value from storage
   * Uses batching on mobile to reduce bridge calls
   */
  async get(key: string, useBatch: boolean = true): Promise<string | null> {
    try {
      if (isMobile() && useBatch) {
        // Use batched service for mobile
        return await bridgeBatchService.get(key);
      } else if (isMobile()) {
        // Direct call (for immediate needs)
        const result = await Preferences.get({ key });
        return result.value;
      } else {
        // Web fallback to localStorage
        return localStorage.getItem(key);
      }
    } catch (error) {
      console.error(`[MobileStorage] Error getting key "${key}":`, error);
      // Fallback to localStorage on error
      try {
        return localStorage.getItem(key);
      } catch (e) {
        return null;
      }
    }
  },

  /**
   * Set a value in storage
   * Uses batching on mobile to reduce bridge calls
   */
  async set(key: string, value: string, useBatch: boolean = true): Promise<void> {
    try {
      if (isMobile() && useBatch) {
        // Use batched service for mobile
        await bridgeBatchService.set(key, value);
      } else if (isMobile()) {
        // Direct call (for immediate needs)
        await Preferences.set({ key, value });
      } else {
        // Web fallback to localStorage
        localStorage.setItem(key, value);
      }
    } catch (error) {
      console.error(`[MobileStorage] Error setting key "${key}":`, error);
      // Fallback to localStorage on error
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        console.error(`[MobileStorage] Failed to set key "${key}" in localStorage:`, e);
      }
    }
  },

  /**
   * Remove a value from storage
   */
  async remove(key: string): Promise<void> {
    try {
      if (isMobile()) {
        await Preferences.remove({ key });
      } else {
        // Web fallback to localStorage
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.error(`[MobileStorage] Error removing key "${key}":`, error);
      // Fallback to localStorage on error
      try {
        localStorage.removeItem(key);
      } catch (e) {
        // Ignore errors
      }
    }
  },

  /**
   * Get all keys
   */
  async keys(): Promise<string[]> {
    try {
      if (isMobile()) {
        const result = await Preferences.keys();
        return result.keys;
      } else {
        // Web fallback - get all localStorage keys
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) keys.push(key);
        }
        return keys;
      }
    } catch (error) {
      console.error('[MobileStorage] Error getting keys:', error);
      return [];
    }
  },

  /**
   * Clear all storage
   */
  async clear(): Promise<void> {
    try {
      if (isMobile()) {
        await Preferences.clear();
      } else {
        // Web fallback to localStorage
        localStorage.clear();
      }
    } catch (error) {
      console.error('[MobileStorage] Error clearing storage:', error);
      // Fallback to localStorage on error
      try {
        localStorage.clear();
      } catch (e) {
        // Ignore errors
      }
    }
  },

  /**
   * Get multiple values at once (batch operation)
   */
  async getMultiple(keys: string[]): Promise<Record<string, string | null>> {
    try {
      if (isMobile()) {
        const result = await Preferences.getMultiple({ keys });
        const values: Record<string, string | null> = {};
        result.results.forEach(({ key, value }) => {
          values[key] = value;
        });
        return values;
      } else {
        // Web fallback - get from localStorage
        const values: Record<string, string | null> = {};
        keys.forEach(key => {
          values[key] = localStorage.getItem(key);
        });
        return values;
      }
    } catch (error) {
      console.error('[MobileStorage] Error getting multiple keys:', error);
      // Fallback to localStorage
      const values: Record<string, string | null> = {};
      keys.forEach(key => {
        try {
          values[key] = localStorage.getItem(key);
        } catch (e) {
          values[key] = null;
        }
      });
      return values;
    }
  },

  /**
   * Set multiple values at once (batch operation)
   */
  async setMultiple(items: Record<string, string>): Promise<void> {
    try {
      if (isMobile()) {
        const entries = Object.entries(items).map(([key, value]) => ({ key, value }));
        await Preferences.setMultiple({ items: entries });
      } else {
        // Web fallback - set in localStorage
        Object.entries(items).forEach(([key, value]) => {
          localStorage.setItem(key, value);
        });
      }
    } catch (error) {
      console.error('[MobileStorage] Error setting multiple keys:', error);
      // Fallback to localStorage
      Object.entries(items).forEach(([key, value]) => {
        try {
          localStorage.setItem(key, value);
        } catch (e) {
          console.error(`[MobileStorage] Failed to set key "${key}":`, e);
        }
      });
    }
  },
};

