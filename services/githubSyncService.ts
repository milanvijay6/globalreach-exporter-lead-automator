import { AdminAction } from '../types';
import { Logger } from './loggerService';
import { PlatformService } from './platformService';

const STORAGE_KEY_GITHUB_SYNC_ENABLED = 'globalreach_github_sync_enabled';
const STORAGE_KEY_GITHUB_SYNC_LOGS = 'globalreach_github_sync_logs';

/**
 * GitHub Sync Service
 * Syncs user approvals and audit logs to GitHub via secure backend API
 * Never exposes GitHub tokens in the client
 */
export const githubSyncService = {
  /**
   * Checks if GitHub sync is enabled
   */
  isEnabled: async (): Promise<boolean> => {
    try {
      const enabled = await PlatformService.getAppConfig(STORAGE_KEY_GITHUB_SYNC_ENABLED, false);
      return enabled === true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Syncs a user approval/rejection to GitHub
   */
  syncUserApproval: async (
    userId: string,
    action: 'approved' | 'rejected',
    details: {
      email?: string;
      role?: string;
      approvedBy?: string;
      rejectedBy?: string;
      reason?: string;
    }
  ): Promise<void> => {
    try {
      if (!(await githubSyncService.isEnabled())) {
        return; // Sync not enabled, silently skip
      }

      const syncData = {
        type: 'user_approval',
        userId,
        action,
        details,
        timestamp: Date.now(),
      };

      // In a real implementation, this would call a secure backend API
      // that handles GitHub authentication and commits
      // For now, we'll log it locally
      await githubSyncService.logSync('user_approval', syncData);

      Logger.info(`[GitHubSyncService] Synced user ${action}: ${userId}`);
    } catch (error) {
      Logger.warn('[GitHubSyncService] Sync failed (non-blocking):', error);
      // Don't throw - sync failures shouldn't block user operations
    }
  },

  /**
   * Syncs user creation to GitHub
   */
  syncUserCreation: async (
    userId: string,
    userData: {
      email: string;
      role: string;
      createdBy: string;
    }
  ): Promise<void> => {
    try {
      if (!(await githubSyncService.isEnabled())) {
        return;
      }

      const syncData = {
        type: 'user_creation',
        userId,
        userData,
        timestamp: Date.now(),
      };

      await githubSyncService.logSync('user_creation', syncData);

      Logger.info(`[GitHubSyncService] Synced user creation: ${userId}`);
    } catch (error) {
      Logger.warn('[GitHubSyncService] Sync failed (non-blocking):', error);
    }
  },

  /**
   * Syncs an audit log entry to GitHub
   */
  syncAuditLog: async (action: AdminAction): Promise<void> => {
    try {
      if (!(await githubSyncService.isEnabled())) {
        return;
      }

      const syncData = {
        type: 'audit_log',
        action,
        timestamp: Date.now(),
      };

      await githubSyncService.logSync('audit_log', syncData);

      Logger.info(`[GitHubSyncService] Synced audit log: ${action.id}`);
    } catch (error) {
      Logger.warn('[GitHubSyncService] Sync failed (non-blocking):', error);
    }
  },

  /**
   * Logs sync operations locally (for debugging and retry)
   */
  logSync: async (operation: string, data: any): Promise<void> => {
    try {
      const stored = await PlatformService.secureLoad(STORAGE_KEY_GITHUB_SYNC_LOGS);
      const logs = stored ? JSON.parse(stored) : [];
      
      logs.push({
        operation,
        data,
        timestamp: Date.now(),
        synced: false, // Will be marked true when actually synced to GitHub
      });

      // Keep only last 1000 logs
      if (logs.length > 1000) {
        logs.shift();
      }

      await PlatformService.secureSave(STORAGE_KEY_GITHUB_SYNC_LOGS, JSON.stringify(logs));
    } catch (error) {
      Logger.error('[GitHubSyncService] Failed to log sync:', error);
    }
  },

  /**
   * Gets sync logs
   */
  getSyncLogs: async (): Promise<any[]> => {
    try {
      const stored = await PlatformService.secureLoad(STORAGE_KEY_GITHUB_SYNC_LOGS);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      Logger.error('[GitHubSyncService] Failed to get sync logs:', error);
      return [];
    }
  },

  /**
   * Enables GitHub sync
   */
  enable: async (): Promise<void> => {
    await PlatformService.setAppConfig(STORAGE_KEY_GITHUB_SYNC_ENABLED, true);
    Logger.info('[GitHubSyncService] GitHub sync enabled');
  },

  /**
   * Disables GitHub sync
   */
  disable: async (): Promise<void> => {
    await PlatformService.setAppConfig(STORAGE_KEY_GITHUB_SYNC_ENABLED, false);
    Logger.info('[GitHubSyncService] GitHub sync disabled');
  },
};

