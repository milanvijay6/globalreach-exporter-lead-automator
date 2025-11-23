import { ApiKeyUsage, ApiKeyProvider, KeyStatistics, UsageStats, PerformanceMetrics } from '../types';
import { PlatformService } from './platformService';
import { Logger } from './loggerService';

const STORAGE_KEY_API_KEY_USAGE = 'globalreach_api_key_usage';
const USAGE_RETENTION_DAYS = 90; // Keep usage data for 90 days

/**
 * API Key Monitoring Service
 * Tracks usage, performance metrics, and provides analytics
 */

/**
 * Loads usage data from storage
 */
export const loadUsageData = async (): Promise<ApiKeyUsage[]> => {
  try {
    const stored = await PlatformService.secureLoad(STORAGE_KEY_API_KEY_USAGE);
    if (!stored) return [];
    return JSON.parse(stored) as ApiKeyUsage[];
  } catch (error) {
    console.error('[ApiKeyMonitoringService] Failed to load usage data:', error);
    return [];
  }
};

/**
 * Saves usage data to storage
 */
const saveUsageData = async (usage: ApiKeyUsage[]): Promise<void> => {
  // Auto-purge old data
  const cutoffDate = Date.now() - (USAGE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const filteredUsage = usage.filter(u => u.timestamp >= cutoffDate);
  
  await PlatformService.secureSave(STORAGE_KEY_API_KEY_USAGE, JSON.stringify(filteredUsage));
};

/**
 * Tracks usage for an API key
 */
export const trackUsage = async (keyId: string, usage: ApiKeyUsage): Promise<void> => {
  try {
    const usageData = await loadUsageData();
    
    const usageEntry: ApiKeyUsage = {
      keyId,
      timestamp: Date.now(),
      provider: usage.provider,
      action: usage.action,
      success: usage.success,
      responseTime: usage.responseTime,
      errorCode: usage.errorCode,
      errorMessage: usage.errorMessage,
      cost: usage.cost,
    };
    
    usageData.push(usageEntry);
    await saveUsageData(usageData);
    
    console.log(`[ApiKeyMonitoringService] Tracked usage for key ${keyId}: ${usage.action} (${usage.success ? 'success' : 'failed'})`);
  } catch (error) {
    console.error('[ApiKeyMonitoringService] Failed to track usage:', error);
  }
};

/**
 * Gets usage statistics for a specific key over a timeframe
 */
export const getKeyStatistics = async (
  keyId: string,
  timeframe: '24h' | '7d' | '30d'
): Promise<KeyStatistics> => {
  try {
    const usageData = await loadUsageData();
    const now = Date.now();
    
    let startTime: number;
    switch (timeframe) {
      case '24h':
        startTime = now - (24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = now - (7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = now - (30 * 24 * 60 * 60 * 1000);
        break;
    }
    
    const relevantUsage = usageData.filter(
      u => u.keyId === keyId && u.timestamp >= startTime
    );
    
    const totalRequests = relevantUsage.length;
    const successfulRequests = relevantUsage.filter(u => u.success).length;
    const failedRequests = totalRequests - successfulRequests;
    
    const responseTimes = relevantUsage
      .filter(u => u.responseTime !== undefined)
      .map(u => u.responseTime!);
    
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;
    
    const errorRate = totalRequests > 0 ? failedRequests / totalRequests : 0;
    
    // Calculate total cost if available
    const totalCost = relevantUsage
      .filter(u => u.cost !== undefined)
      .reduce((sum, u) => sum + (u.cost || 0), 0);
    
    // Group by hour for requestsByHour
    const requestsByHour: Array<{ hour: number; count: number }> = [];
    for (let i = 0; i < 24; i++) {
      const hourStart = startTime + (i * 60 * 60 * 1000);
      const hourEnd = hourStart + (60 * 60 * 1000);
      const hourCount = relevantUsage.filter(
        u => u.timestamp >= hourStart && u.timestamp < hourEnd
      ).length;
      requestsByHour.push({ hour: i, count: hourCount });
    }
    
    return {
      keyId,
      timeframe,
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      errorRate,
      cost: totalCost > 0 ? totalCost : undefined,
      requestsByHour,
    };
  } catch (error) {
    console.error('[ApiKeyMonitoringService] Failed to get key statistics:', error);
    return {
      keyId,
      timeframe,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      errorRate: 0,
    };
  }
};

/**
 * Gets overall usage statistics
 */
export const getUsageStats = async (
  provider?: ApiKeyProvider,
  timeframeMs: number = 30 * 24 * 60 * 60 * 1000
): Promise<UsageStats> => {
  try {
    const usageData = await loadUsageData();
    const now = Date.now();
    const startTime = now - timeframeMs;
    
    let relevantUsage = usageData.filter(u => u.timestamp >= startTime);
    
    if (provider) {
      relevantUsage = relevantUsage.filter(u => u.provider === provider);
    }
    
    const totalRequests = relevantUsage.length;
    const successfulRequests = relevantUsage.filter(u => u.success).length;
    const successRate = totalRequests > 0 ? successfulRequests / totalRequests : 0;
    
    const responseTimes = relevantUsage
      .filter(u => u.responseTime !== undefined)
      .map(u => u.responseTime!);
    
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;
    
    const totalCost = relevantUsage
      .filter(u => u.cost !== undefined)
      .reduce((sum, u) => sum + (u.cost || 0), 0);
    
    // Count unique keys used
    const uniqueKeys = new Set(relevantUsage.map(u => u.keyId));
    
    return {
      provider,
      timeframe: `${Math.floor(timeframeMs / (24 * 60 * 60 * 1000))}d`,
      totalRequests,
      successRate,
      averageResponseTime,
      totalCost: totalCost > 0 ? totalCost : undefined,
      keysUsed: uniqueKeys.size,
    };
  } catch (error) {
    console.error('[ApiKeyMonitoringService] Failed to get usage stats:', error);
    return {
      provider,
      timeframe: '0d',
      totalRequests: 0,
      successRate: 0,
      averageResponseTime: 0,
      keysUsed: 0,
    };
  }
};

/**
 * Gets performance metrics for a key
 */
export const getPerformanceMetrics = async (keyId: string): Promise<PerformanceMetrics> => {
  try {
    const stats = await getKeyStatistics(keyId, '24h');
    
    const usageData = await loadUsageData();
    const now = Date.now();
    const last24h = now - (24 * 60 * 60 * 1000);
    
    const recentUsage = usageData.filter(
      u => u.keyId === keyId && u.timestamp >= last24h
    );
    
    const responseTimes = recentUsage
      .filter(u => u.responseTime !== undefined)
      .map(u => u.responseTime!)
      .sort((a, b) => a - b);
    
    const p95Index = Math.floor(responseTimes.length * 0.95);
    const p99Index = Math.floor(responseTimes.length * 0.99);
    
    const p95ResponseTime = responseTimes[p95Index] || 0;
    const p99ResponseTime = responseTimes[p99Index] || 0;
    
    // Calculate throughput (requests per minute)
    const requestsInLastHour = recentUsage.filter(
      u => u.timestamp >= (now - 60 * 60 * 1000)
    ).length;
    const throughput = requestsInLastHour; // requests per hour, can convert to per minute if needed
    
    return {
      keyId,
      averageResponseTime: stats.averageResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      errorRate: stats.errorRate,
      throughput,
    };
  } catch (error) {
    console.error('[ApiKeyMonitoringService] Failed to get performance metrics:', error);
    return {
      keyId,
      averageResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      errorRate: 0,
      throughput: 0,
    };
  }
};

/**
 * Checks rate limits and returns alerts
 */
export const checkRateLimits = async (): Promise<Array<{ keyId: string; message: string; severity: 'warning' | 'critical' }>> => {
  try {
    const { getApiKeys } = await import('./apiKeyService');
    const allKeys = await getApiKeys();
    const alerts: Array<{ keyId: string; message: string; severity: 'warning' | 'critical' }> = [];
    
    for (const key of allKeys) {
      if (!key.metadata.isActive) continue;
      
      const stats = await getKeyStatistics(key.id, '24h');
      
      // Check daily limit
      if (key.limits?.dailyLimit) {
        const usageRatio = stats.totalRequests / key.limits.dailyLimit;
        if (usageRatio >= 0.9) {
          alerts.push({
            keyId: key.id,
            message: `Daily limit nearly reached: ${stats.totalRequests}/${key.limits.dailyLimit} (${(usageRatio * 100).toFixed(1)}%)`,
            severity: usageRatio >= 1 ? 'critical' : 'warning',
          });
        }
      }
      
      // Check monthly limit
      if (key.limits?.monthlyLimit) {
        const monthlyStats = await getKeyStatistics(key.id, '30d');
        const usageRatio = monthlyStats.totalRequests / key.limits.monthlyLimit;
        if (usageRatio >= 0.9) {
          alerts.push({
            keyId: key.id,
            message: `Monthly limit nearly reached: ${monthlyStats.totalRequests}/${key.limits.monthlyLimit} (${(usageRatio * 100).toFixed(1)}%)`,
            severity: usageRatio >= 1 ? 'critical' : 'warning',
          });
        }
      }
      
      // Check error rate
      if (stats.errorRate > 0.1) {
        alerts.push({
          keyId: key.id,
          message: `High error rate: ${(stats.errorRate * 100).toFixed(1)}%`,
          severity: stats.errorRate > 0.3 ? 'critical' : 'warning',
        });
      }
    }
    
    return alerts;
  } catch (error) {
    console.error('[ApiKeyMonitoringService] Failed to check rate limits:', error);
    return [];
  }
};

