import { PlatformService } from './platformService';

export interface PanelSizes {
  importerListWidth: number;
}

export interface UserPreferences {
  panelSizes: PanelSizes;
}

const DEFAULT_PANEL_SIZES: PanelSizes = {
  importerListWidth: 384, // Default width in pixels (matches md:w-96 = 384px)
};

const PREFERENCES_KEY = 'userPreferences';

/**
 * Loads user preferences from storage
 * @param userId - Optional user ID for user-specific preferences (not used directly, handled by PlatformService)
 * @returns User preferences with defaults
 */
export const loadUserPreferences = async (userId?: string | null): Promise<UserPreferences> => {
  try {
    const stored = await PlatformService.getAppConfig(PREFERENCES_KEY, null);
    if (stored && typeof stored === 'object') {
      return {
        panelSizes: {
          importerListWidth: stored.panelSizes?.importerListWidth ?? DEFAULT_PANEL_SIZES.importerListWidth,
        },
      };
    }
  } catch (error) {
    console.warn('[UserPreferencesService] Failed to load preferences:', error);
  }
  
  return {
    panelSizes: { ...DEFAULT_PANEL_SIZES },
  };
};

/**
 * Saves user preferences to storage
 * @param preferences - Preferences to save
 * @param userId - Optional user ID (not used directly, handled by PlatformService)
 */
export const saveUserPreferences = async (
  preferences: UserPreferences,
  userId?: string | null
): Promise<boolean> => {
  try {
    await PlatformService.setAppConfig(PREFERENCES_KEY, preferences);
    return true;
  } catch (error) {
    console.error('[UserPreferencesService] Failed to save preferences:', error);
    return false;
  }
};

/**
 * Loads panel sizes for the current user
 * @param userId - Optional user ID
 * @returns Panel sizes with defaults
 */
export const loadPanelSizes = async (userId?: string | null): Promise<PanelSizes> => {
  const preferences = await loadUserPreferences(userId);
  return preferences.panelSizes;
};

/**
 * Saves panel sizes for the current user
 * @param sizes - Panel sizes to save
 * @param userId - Optional user ID
 */
export const savePanelSizes = async (
  sizes: PanelSizes,
  userId?: string | null
): Promise<boolean> => {
  const preferences = await loadUserPreferences(userId);
  preferences.panelSizes = sizes;
  return await saveUserPreferences(preferences, userId);
};

export const UserPreferencesService = {
  loadUserPreferences,
  saveUserPreferences,
  loadPanelSizes,
  savePanelSizes,
  DEFAULT_PANEL_SIZES,
};

