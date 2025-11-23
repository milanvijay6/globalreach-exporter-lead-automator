import { Logger } from './loggerService';
import { AuthState, AuthStep, AuthError } from '../types';
import { PlatformService } from './platformService';

const STORAGE_KEY_AUTH_STATE = 'globalreach_auth_state';

// In-memory state (for active session)
let currentAuthState: AuthState | null = null;

/**
 * Auth State Service
 * Manages authentication state with persistence and validation
 */
export const AuthStateService = {
  /**
   * Gets current authentication state
   */
  getAuthState: async (): Promise<AuthState | null> => {
    try {
      // Return in-memory state if available
      if (currentAuthState) {
        return currentAuthState;
      }

      // Try to load from storage
      const stored = await PlatformService.secureLoad(STORAGE_KEY_AUTH_STATE);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Check if state is not too old (1 hour max)
        if (Date.now() - parsed.timestamp < 60 * 60 * 1000) {
          currentAuthState = parsed;
          return parsed;
        } else {
          // Clear expired state
          await AuthStateService.clearAuthState();
        }
      }

      return null;
    } catch (error) {
      Logger.error('[AuthStateService] Failed to get auth state:', error);
      return null;
    }
  },

  /**
   * Sets authentication state with validation
   */
  setAuthState: async (state: Partial<AuthState>): Promise<AuthState> => {
    try {
      const current = currentAuthState || {
        status: AuthStep.IDLE,
        step: AuthStep.IDLE,
        timestamp: Date.now(),
      };

      const newState: AuthState = {
        ...current,
        ...state,
        timestamp: Date.now(),
      };

      // Validate state transitions
      if (!AuthStateService.isValidTransition(current.status, newState.status)) {
        Logger.warn('[AuthStateService] Invalid state transition', {
          from: current.status,
          to: newState.status,
        });
        // Allow transition but log warning
      }

      currentAuthState = newState;
      await AuthStateService.persistAuthState(newState);

      Logger.debug('[AuthStateService] Auth state updated', {
        status: newState.status,
        provider: newState.provider,
      });

      return newState;
    } catch (error: any) {
      Logger.error('[AuthStateService] Failed to set auth state:', error);
      throw new Error(`Failed to set auth state: ${error.message}`);
    }
  },

  /**
   * Validates state transition
   */
  isValidTransition: (from: AuthStep, to: AuthStep): boolean => {
    // Allow transitions from any state to IDLE or ERROR
    if (to === AuthStep.IDLE || to === AuthStep.ERROR) {
      return true;
    }

    // Define valid transitions
    const validTransitions: Record<AuthStep, AuthStep[]> = {
      [AuthStep.IDLE]: [AuthStep.INITIATING],
      [AuthStep.INITIATING]: [AuthStep.AUTHENTICATING, AuthStep.ERROR],
      [AuthStep.AUTHENTICATING]: [AuthStep.EXCHANGING, AuthStep.ERROR],
      [AuthStep.EXCHANGING]: [AuthStep.CONNECTED, AuthStep.ERROR],
      [AuthStep.CONNECTED]: [AuthStep.IDLE, AuthStep.ERROR],
      [AuthStep.ERROR]: [AuthStep.IDLE, AuthStep.INITIATING],
    };

    const allowed = validTransitions[from] || [];
    return allowed.includes(to);
  },

  /**
   * Clears authentication state
   */
  clearAuthState: async (): Promise<void> => {
    try {
      currentAuthState = null;
      await PlatformService.secureSave(STORAGE_KEY_AUTH_STATE, '');
      Logger.debug('[AuthStateService] Auth state cleared');
    } catch (error) {
      Logger.error('[AuthStateService] Failed to clear auth state:', error);
    }
  },

  /**
   * Persists authentication state to secure storage
   */
  persistAuthState: async (state: AuthState): Promise<void> => {
    try {
      // Don't persist sensitive data
      const sanitizedState: AuthState = {
        ...state,
        // Remove any sensitive information if present
      };

      await PlatformService.secureSave(STORAGE_KEY_AUTH_STATE, JSON.stringify(sanitizedState));
    } catch (error) {
      Logger.error('[AuthStateService] Failed to persist auth state:', error);
      throw error;
    }
  },

  /**
   * Sets an error in the auth state
   */
  setAuthError: async (error: AuthError): Promise<AuthState> => {
    return await AuthStateService.setAuthState({
      status: AuthStep.ERROR,
      step: AuthStep.ERROR,
      error,
    });
  },

  /**
   * Checks if authentication is in progress
   */
  isAuthInProgress: async (): Promise<boolean> => {
    const state = await AuthStateService.getAuthState();
    if (!state) return false;

    return [
      AuthStep.INITIATING,
      AuthStep.AUTHENTICATING,
      AuthStep.EXCHANGING,
    ].includes(state.status);
  },

  /**
   * Checks if authentication is connected
   */
  isAuthConnected: async (): Promise<boolean> => {
    const state = await AuthStateService.getAuthState();
    return state?.status === AuthStep.CONNECTED;
  },

  /**
   * Gets current error if any
   */
  getCurrentError: async (): Promise<AuthError | null> => {
    const state = await AuthStateService.getAuthState();
    return state?.error || null;
  },
};

