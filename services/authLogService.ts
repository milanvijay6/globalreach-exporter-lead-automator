import { Logger } from './loggerService';
import { PlatformService } from './platformService';

export interface LinkClickLog {
  timestamp: number;
  source: string; // 'email', 'browser', 'app'
  device?: string;
  url: string;
  type: 'magic-link' | 'oauth' | 'unknown';
  success: boolean;
  error?: string;
}

export interface LoginAttemptLog {
  timestamp: number;
  provider: 'gmail' | 'outlook' | 'custom';
  method: 'oauth' | 'magic-link' | 'imap' | 'smtp';
  email?: string;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  duration?: number; // milliseconds
}

export interface AuthErrorLog {
  timestamp: number;
  errorCode: string;
  errorMessage: string;
  provider?: 'gmail' | 'outlook' | 'custom';
  method?: 'oauth' | 'magic-link' | 'imap' | 'smtp';
  stackTrace?: string;
  context?: Record<string, any>;
}

const MAX_LOGS = 1000;
const LOG_STORAGE_KEY = 'globalreach_auth_logs';

// In-memory log storage
let linkClickLogs: LinkClickLog[] = [];
let loginAttemptLogs: LoginAttemptLog[] = [];
let authErrorLogs: AuthErrorLog[] = [];

// Load logs from storage on initialization
const loadLogsFromStorage = async () => {
  try {
    const stored = await PlatformService.secureLoad(LOG_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      linkClickLogs = parsed.linkClicks || [];
      loginAttemptLogs = parsed.loginAttempts || [];
      authErrorLogs = parsed.errors || [];
    }
  } catch (error) {
    Logger.warn('[AuthLogService] Failed to load logs from storage:', error);
  }
};

// Save logs to storage periodically
const saveLogsToStorage = async () => {
  try {
    const data = {
      linkClicks: linkClickLogs.slice(-500), // Keep last 500
      loginAttempts: loginAttemptLogs.slice(-500),
      errors: authErrorLogs.slice(-500),
    };
    await PlatformService.secureSave(LOG_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    Logger.warn('[AuthLogService] Failed to save logs to storage:', error);
  }
};

// Initialize
loadLogsFromStorage();

// Auto-save every 5 minutes
setInterval(saveLogsToStorage, 5 * 60 * 1000);

/**
 * Authentication Logging Service
 * Comprehensive logging for link clicks, login attempts, and errors
 */
export const AuthLogService = {
  /**
   * Logs a link click event
   */
  logLinkClick: (log: Omit<LinkClickLog, 'timestamp'>): void => {
    try {
      const fullLog: LinkClickLog = {
        ...log,
        timestamp: Date.now(),
      };

      linkClickLogs.push(fullLog);
      
      // Trim if too many logs
      if (linkClickLogs.length > MAX_LOGS) {
        linkClickLogs = linkClickLogs.slice(-MAX_LOGS);
      }

      Logger.info('[AuthLog] Link click', {
        source: fullLog.source,
        type: fullLog.type,
        success: fullLog.success,
      });

      // Auto-save periodically
      if (linkClickLogs.length % 10 === 0) {
        saveLogsToStorage();
      }
    } catch (error) {
      Logger.error('[AuthLogService] Failed to log link click:', error);
    }
  },

  /**
   * Logs a login attempt
   */
  logLoginAttempt: (log: Omit<LoginAttemptLog, 'timestamp'>): void => {
    try {
      const fullLog: LoginAttemptLog = {
        ...log,
        timestamp: Date.now(),
      };

      loginAttemptLogs.push(fullLog);
      
      // Trim if too many logs
      if (loginAttemptLogs.length > MAX_LOGS) {
        loginAttemptLogs = loginAttemptLogs.slice(-MAX_LOGS);
      }

      Logger.info('[AuthLog] Login attempt', {
        provider: fullLog.provider,
        method: fullLog.method,
        success: fullLog.success,
        duration: fullLog.duration,
      });

      // Auto-save periodically
      if (loginAttemptLogs.length % 10 === 0) {
        saveLogsToStorage();
      }
    } catch (error) {
      Logger.error('[AuthLogService] Failed to log login attempt:', error);
    }
  },

  /**
   * Logs an authentication error
   */
  logAuthError: (log: Omit<AuthErrorLog, 'timestamp'>): void => {
    try {
      const fullLog: AuthErrorLog = {
        ...log,
        timestamp: Date.now(),
      };

      authErrorLogs.push(fullLog);
      
      // Trim if too many logs
      if (authErrorLogs.length > MAX_LOGS) {
        authErrorLogs = authErrorLogs.slice(-MAX_LOGS);
      }

      Logger.error('[AuthLog] Auth error', {
        code: fullLog.errorCode,
        provider: fullLog.provider,
        method: fullLog.method,
      });

      // Auto-save on errors
      saveLogsToStorage();
    } catch (error) {
      Logger.error('[AuthLogService] Failed to log auth error:', error);
    }
  },

  /**
   * Gets link click logs
   */
  getLinkClickLogs: (limit: number = 100): LinkClickLog[] => {
    return linkClickLogs.slice(-limit).reverse();
  },

  /**
   * Gets login attempt logs
   */
  getLoginAttemptLogs: (limit: number = 100): LoginAttemptLog[] => {
    return loginAttemptLogs.slice(-limit).reverse();
  },

  /**
   * Gets authentication error logs
   */
  getAuthErrorLogs: (limit: number = 100): AuthErrorLog[] => {
    return authErrorLogs.slice(-limit).reverse();
  },

  /**
   * Gets all logs for diagnostics
   */
  getAllLogs: (): {
    linkClicks: LinkClickLog[];
    loginAttempts: LoginAttemptLog[];
    errors: AuthErrorLog[];
  } => {
    return {
      linkClicks: linkClickLogs.slice(-100).reverse(),
      loginAttempts: loginAttemptLogs.slice(-100).reverse(),
      errors: authErrorLogs.slice(-100).reverse(),
    };
  },

  /**
   * Exports logs for troubleshooting
   */
  exportLogs: (): string => {
    const logs = AuthLogService.getAllLogs();
    return JSON.stringify(logs, null, 2);
  },

  /**
   * Clears all logs
   */
  clearLogs: async (): Promise<void> => {
    linkClickLogs = [];
    loginAttemptLogs = [];
    authErrorLogs = [];
    await PlatformService.secureSave(LOG_STORAGE_KEY, '');
    Logger.info('[AuthLogService] All logs cleared');
  },

  /**
   * Gets statistics about authentication attempts
   */
  getStatistics: (): {
    totalLinkClicks: number;
    successfulLinkClicks: number;
    totalLoginAttempts: number;
    successfulLoginAttempts: number;
    totalErrors: number;
    errorsByCode: Record<string, number>;
    recentActivity: {
      last24Hours: number;
      last7Days: number;
    };
  } => {
    const now = Date.now();
    const last24Hours = now - 24 * 60 * 60 * 1000;
    const last7Days = now - 7 * 24 * 60 * 60 * 1000;

    const errorsByCode: Record<string, number> = {};
    authErrorLogs.forEach(log => {
      errorsByCode[log.errorCode] = (errorsByCode[log.errorCode] || 0) + 1;
    });

    return {
      totalLinkClicks: linkClickLogs.length,
      successfulLinkClicks: linkClickLogs.filter(l => l.success).length,
      totalLoginAttempts: loginAttemptLogs.length,
      successfulLoginAttempts: loginAttemptLogs.filter(l => l.success).length,
      totalErrors: authErrorLogs.length,
      errorsByCode,
      recentActivity: {
        last24Hours: loginAttemptLogs.filter(l => l.timestamp >= last24Hours).length,
        last7Days: loginAttemptLogs.filter(l => l.timestamp >= last7Days).length,
      },
    };
  },
};

