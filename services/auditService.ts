import { AdminAction, User } from '../types';
import { PlatformService } from './platformService';
import { Logger } from './loggerService';

const STORAGE_KEY_AUDIT_LOGS = 'globalreach_audit_logs';
const AUDIT_LOG_RETENTION_DAYS = 90; // Configurable retention period

/**
 * Audit Service
 * Handles comprehensive audit logging of all admin actions for security and accountability
 */

/**
 * Logs an admin action to the audit trail
 */
export const logAdminAction = async (
  user: User,
  action: string,
  resource: string,
  details: Record<string, any> = {}
): Promise<void> => {
  try {
    const auditAction: AdminAction = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: user.id,
      userName: user.name,
      action,
      resource,
      details,
      timestamp: Date.now(),
      ipAddress: await getClientIpAddress(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    };

    // Load existing logs
    const existingLogs = await getAuditLogs();
    
    // Add new log
    const updatedLogs = [auditAction, ...existingLogs];
    
    // Auto-purge old logs (older than retention period)
    const cutoffDate = Date.now() - (AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const filteredLogs = updatedLogs.filter(log => log.timestamp >= cutoffDate);
    
    // Store encrypted audit logs
    await PlatformService.secureSave(STORAGE_KEY_AUDIT_LOGS, JSON.stringify(filteredLogs));
    
    // Also log to console/logger for immediate visibility
    Logger.info(`[AUDIT] ${user.name} (${user.id}) performed ${action} on ${resource}`, details);
  } catch (error) {
    Logger.error('[AuditService] Failed to log admin action:', error);
    // Don't throw - audit logging should not break the application
  }
};

/**
 * Gets audit logs with optional filters
 */
export const getAuditLogs = async (filters?: {
  userId?: string;
  action?: string;
  startDate?: number;
  endDate?: number;
  resource?: string;
}): Promise<AdminAction[]> => {
  try {
    const stored = await PlatformService.secureLoad(STORAGE_KEY_AUDIT_LOGS);
    if (!stored) return [];
    
    let logs: AdminAction[] = JSON.parse(stored);
    
    // Apply filters
    if (filters) {
      if (filters.userId) {
        logs = logs.filter(log => log.userId === filters.userId);
      }
      if (filters.action) {
        logs = logs.filter(log => log.action === filters.action);
      }
      if (filters.resource) {
        logs = logs.filter(log => log.resource.includes(filters.resource!));
      }
      if (filters.startDate) {
        logs = logs.filter(log => log.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        logs = logs.filter(log => log.timestamp <= filters.endDate!);
      }
    }
    
    // Sort by timestamp (newest first)
    return logs.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    Logger.error('[AuditService] Failed to get audit logs:', error);
    return [];
  }
};

/**
 * Exports audit logs in specified format
 */
export const exportAuditLogs = async (
  format: 'json' | 'csv',
  filters?: {
    userId?: string;
    action?: string;
    startDate?: number;
    endDate?: number;
    resource?: string;
  }
): Promise<string> => {
  const logs = await getAuditLogs(filters);
  
  if (format === 'json') {
    return JSON.stringify(logs, null, 2);
  } else if (format === 'csv') {
    // Convert to CSV format
    const headers = ['ID', 'User ID', 'User Name', 'Action', 'Resource', 'Timestamp', 'IP Address', 'Details'];
    const rows = logs.map(log => [
      log.id,
      log.userId,
      log.userName,
      log.action,
      log.resource,
      new Date(log.timestamp).toISOString(),
      log.ipAddress || '',
      JSON.stringify(log.details),
    ]);
    
    const csvRows = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ];
    
    return csvRows.join('\n');
  }
  
  return '';
};

/**
 * Gets client IP address (for Electron/web compatibility)
 */
const getClientIpAddress = async (): Promise<string | undefined> => {
  try {
    // In Electron, we might be able to get IP from the main process
    // For web, we'd need to get it from the server
    // For now, return undefined if not available
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      // Could add IPC call to get IP from Electron main process
      return undefined;
    }
    return undefined;
  } catch (error) {
    return undefined;
  }
};

/**
 * Purges audit logs older than retention period
 */
export const purgeOldAuditLogs = async (): Promise<number> => {
  try {
    const cutoffDate = Date.now() - (AUDIT_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const allLogs = await getAuditLogs();
    const filteredLogs = allLogs.filter(log => log.timestamp >= cutoffDate);
    const purgedCount = allLogs.length - filteredLogs.length;
    
    if (purgedCount > 0) {
      await PlatformService.secureSave(STORAGE_KEY_AUDIT_LOGS, JSON.stringify(filteredLogs));
      Logger.info(`[AuditService] Purged ${purgedCount} old audit logs`);
    }
    
    return purgedCount;
  } catch (error) {
    Logger.error('[AuditService] Failed to purge old audit logs:', error);
    return 0;
  }
};

/**
 * Gets audit statistics
 */
export const getAuditStatistics = async (timeframe: '24h' | '7d' | '30d' = '7d'): Promise<{
  totalActions: number;
  actionsByType: Record<string, number>;
  actionsByUser: Record<string, number>;
  recentActions: AdminAction[];
}> => {
  try {
    const now = Date.now();
    const timeframeMs = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    }[timeframe];
    
    const logs = await getAuditLogs({
      startDate: now - timeframeMs,
    });
    
    const actionsByType: Record<string, number> = {};
    const actionsByUser: Record<string, number> = {};
    
    logs.forEach(log => {
      actionsByType[log.action] = (actionsByType[log.action] || 0) + 1;
      actionsByUser[log.userName] = (actionsByUser[log.userName] || 0) + 1;
    });
    
    return {
      totalActions: logs.length,
      actionsByType,
      actionsByUser,
      recentActions: logs.slice(0, 10), // Last 10 actions
    };
  } catch (error) {
    Logger.error('[AuditService] Failed to get audit statistics:', error);
    return {
      totalActions: 0,
      actionsByType: {},
      actionsByUser: {},
      recentActions: [],
    };
  }
};
