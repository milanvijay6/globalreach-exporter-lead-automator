/**
 * Auto-Save Service
 * Provides debounced auto-save functionality for form data
 */

type SaveFunction = () => Promise<void> | void;
type SaveCallback = (data: any) => Promise<void> | void;

interface AutoSaveOptions {
  debounceMs?: number;
  saveOnBlur?: boolean;
  saveOnUnload?: boolean;
  storageKey?: string;
}

export class AutoSaveService {
  private saveTimeout: NodeJS.Timeout | null = null;
  private lastSavedData: string = '';
  private options: Required<AutoSaveOptions>;

  constructor(
    private saveCallback: SaveCallback,
    options: AutoSaveOptions = {}
  ) {
    this.options = {
      debounceMs: options.debounceMs || 30000, // 30 seconds default
      saveOnBlur: options.saveOnBlur ?? true,
      saveOnUnload: options.saveOnUnload ?? true,
      storageKey: options.storageKey || 'autosave_draft',
    };

    // Save before page unload
    if (this.options.saveOnUnload && typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
    }
  }

  /**
   * Triggers a debounced save
   */
  triggerSave(data: any): void {
    // Clear existing timeout
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // Serialize data for comparison
    const serializedData = JSON.stringify(data);
    
    // Only save if data has changed
    if (serializedData === this.lastSavedData) {
      return;
    }

    // Set new timeout
    this.saveTimeout = setTimeout(async () => {
      try {
        await this.saveCallback(data);
        this.lastSavedData = serializedData;
        console.log('[AutoSave] Data auto-saved successfully');
      } catch (error) {
        console.error('[AutoSave] Auto-save failed:', error);
      } finally {
        this.saveTimeout = null;
      }
    }, this.options.debounceMs);
  }

  /**
   * Saves immediately (bypasses debounce)
   */
  async saveImmediately(data: any): Promise<void> {
    // Clear any pending saves
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    try {
      await this.saveCallback(data);
      this.lastSavedData = JSON.stringify(data);
      console.log('[AutoSave] Data saved immediately');
    } catch (error) {
      console.error('[AutoSave] Immediate save failed:', error);
      throw error;
    }
  }

  /**
   * Handles beforeunload event
   */
  private handleBeforeUnload(): void {
    // This is a best-effort save - browser may not wait for async operations
    if (this.saveTimeout) {
      // Try to save synchronously if possible
      clearTimeout(this.saveTimeout);
    }
  }

  /**
   * Clears the auto-save service
   */
  destroy(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }

    if (typeof window !== 'undefined' && this.options.saveOnUnload) {
      window.removeEventListener('beforeunload', this.handleBeforeUnload.bind(this));
    }
  }

  /**
   * Saves draft to localStorage
   */
  static saveDraft(key: string, data: any, userId?: string): void {
    try {
      const storageKey = userId ? `${key}_${userId}` : key;
      const serialized = JSON.stringify({
        data,
        timestamp: Date.now(),
      });
      localStorage.setItem(storageKey, serialized);
    } catch (error) {
      console.error('[AutoSave] Failed to save draft:', error);
    }
  }

  /**
   * Loads draft from localStorage
   */
  static loadDraft(key: string, userId?: string): any | null {
    try {
      const storageKey = userId ? `${key}_${userId}` : key;
      const stored = localStorage.getItem(storageKey);
      if (!stored) return null;

      const parsed = JSON.parse(stored);
      // Check if draft is not too old (7 days max)
      const maxAge = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - parsed.timestamp > maxAge) {
        localStorage.removeItem(storageKey);
        return null;
      }

      return parsed.data;
    } catch (error) {
      console.error('[AutoSave] Failed to load draft:', error);
      return null;
    }
  }

  /**
   * Clears draft from localStorage
   */
  static clearDraft(key: string, userId?: string): void {
    try {
      const storageKey = userId ? `${key}_${userId}` : key;
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error('[AutoSave] Failed to clear draft:', error);
    }
  }
}

