import { ApiKey, ApiKeyProvider, ApiKeyUsage, KeyStatistics } from '../types';
import { getApiKeys, getPrimaryKey } from './apiKeyService';
import { getKeyStatistics } from './apiKeyMonitoringService';
import { Logger } from './loggerService';
import { PlatformService } from './platformService';

// Note: Usage storage is handled by apiKeyMonitoringService
const THROTTLING_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ERRORS_IN_WINDOW = 5; // Consider throttled if 5+ errors in 5 minutes

/**
 * API Key Optimizer Service
 * Handles intelligent key selection and load balancing based on usage statistics
 */

/**
 * Selects the best API key for a provider based on optimization criteria
 */
export const selectBestKey = async (
  provider: ApiKeyProvider,
  context?: {
    priority?: 'performance' | 'cost' | 'reliability';
  }
): Promise<ApiKey | null> => {
  try {
    const priority = context?.priority || 'reliability';
    
    // Get all active keys for this provider
    const allKeys = await getApiKeys(provider);
    const activeKeys = allKeys.filter(key => key.metadata.isActive);
    
    if (activeKeys.length === 0) {
      Logger.warn(`[ApiKeyOptimizer] No active keys found for provider ${provider}`);
      return null;
    }
    
    // Filter out throttled keys
    const healthyKeys = [];
    for (const key of activeKeys) {
      const isThrottled = await detectThrottling(key.id);
      if (!isThrottled) {
        healthyKeys.push(key);
      }
    }
    
    // If no healthy keys, fall back to primary or first available
    if (healthyKeys.length === 0) {
      Logger.warn(`[ApiKeyOptimizer] All keys throttled for provider ${provider}, using primary`);
      const primary = await getPrimaryKey(provider);
      return primary || activeKeys[0] || null;
    }
    
    // Get statistics for each healthy key
    const keyScores = await Promise.all(
      healthyKeys.map(async (key) => {
        const stats = await getKeyStatistics(key.id, '24h');
        const score = calculateKeyScore(key, stats, priority);
        return { key, score, stats };
      })
    );
    
    // Sort by score (highest first)
    keyScores.sort((a, b) => b.score - a.score);
    
    const bestKey = keyScores[0].key;
    Logger.debug(`[ApiKeyOptimizer] Selected key ${bestKey.id} for provider ${provider} (score: ${keyScores[0].score.toFixed(2)})`);
    
      return bestKey;
  } catch (error) {
    Logger.error('[ApiKeyOptimizer] Failed to select best key:', error);
    // Fallback to primary key
    return await getPrimaryKey(provider);
  }
};

/**
 * Calculates a score for a key based on priority criteria
 */
const calculateKeyScore = (
  key: ApiKey,
  stats: KeyStatistics,
  priority: 'performance' | 'cost' | 'reliability'
): number => {
  let score = 100; // Base score
  
  // Reliability factors (always considered)
  const errorRate = stats.errorRate;
  const successRate = stats.totalRequests > 0 
    ? stats.successfulRequests / stats.totalRequests 
    : 1.0;
  
  // Deduct points for errors
  score -= errorRate * 50; // Up to 50 points deducted for error rate
  score -= (1 - successRate) * 30; // Up to 30 points deducted for low success rate
  
  // Check usage limits
  if (key.limits) {
    const usageRatio = key.metadata.usageCount / (key.limits.dailyLimit || Infinity);
    if (usageRatio > 0.9) {
      score -= 20; // Penalize keys near limit
    }
  }
  
  // Priority-specific adjustments
  if (priority === 'performance') {
    // Prefer keys with lower response times
    const avgResponseTime = stats.averageResponseTime;
    if (avgResponseTime < 200) {
      score += 20; // Bonus for fast keys
    } else if (avgResponseTime > 1000) {
      score -= 15; // Penalty for slow keys
    }
  } else if (priority === 'cost') {
    // Prefer keys with lower usage (for cost optimization)
    const usageCount = key.metadata.usageCount;
    if (usageCount < 100) {
      score += 15; // Bonus for low usage
    } else if (usageCount > 10000) {
      score -= 10; // Penalty for high usage
    }
  } else if (priority === 'reliability') {
    // Prefer keys with best success rates and lowest error rates
    if (successRate > 0.95 && errorRate < 0.01) {
      score += 25; // Bonus for highly reliable keys
    }
  }
  
  // Bonus for primary key (slight preference)
  if (key.metadata.isPrimary) {
    score += 5;
  }
  
  return Math.max(0, Math.min(100, score)); // Clamp between 0 and 100
};

/**
 * Records usage for an API key
 */
export const recordUsage = async (keyId: string, usage: ApiKeyUsage): Promise<void> => {
  try {
    // Use the monitoring service to track usage
    const { trackUsage } = await import('./apiKeyMonitoringService');
    await trackUsage(keyId, usage);
    
    // Update key metadata
    const { updateApiKey, getApiKey } = await import('./apiKeyService');
    const key = await getApiKey(keyId);
    if (key) {
      // Get statistics to update metadata
      const stats = await getKeyStatistics(keyId, '24h');
    
      await updateApiKey(
        keyId,
        {
        metadata: {
          ...key.metadata,
          lastUsed: Date.now(),
            usageCount: stats.totalRequests,
            errorCount: stats.failedRequests,
        },
        },
        { id: 'system', name: 'System', role: 'Admin' as any } // System user for automated updates
      );
    }
  } catch (error) {
    Logger.error('[ApiKeyOptimizer] Failed to record usage:', error);
  }
};

/**
 * Checks the health of an API key
 */
export const checkKeyHealth = async (keyId: string): Promise<{ healthy: boolean; issues: string[] }> => {
  try {
  const issues: string[] = [];
    const key = await (await import('./apiKeyService')).getApiKey(keyId);
  
    if (!key) {
      return { healthy: false, issues: ['Key not found'] };
    }
    
    if (!key.metadata.isActive) {
      issues.push('Key is inactive');
    }
    
    // Check for throttling
    const isThrottled = await detectThrottling(keyId);
    if (isThrottled) {
      issues.push('Key appears to be throttled (high error rate)');
    }
    
    // Check usage limits
    if (key.limits) {
      if (key.limits.dailyLimit && key.metadata.usageCount >= key.limits.dailyLimit) {
        issues.push('Daily limit reached');
      }
      if (key.limits.monthlyLimit) {
        // Would need to calculate monthly usage
        // For now, skip this check
      }
    }
    
    // Check error rate
    const stats = await getKeyStatistics(keyId, '24h');
    if (stats.errorRate > 0.1) {
      issues.push(`High error rate: ${(stats.errorRate * 100).toFixed(1)}%`);
    }
    
    return {
      healthy: issues.length === 0,
      issues,
    };
  } catch (error) {
    Logger.error('[ApiKeyOptimizer] Failed to check key health:', error);
    return { healthy: false, issues: ['Health check failed'] };
  }
};

/**
 * Detects if a key is being throttled based on recent error patterns
 */
export const detectThrottling = async (keyId: string): Promise<boolean> => {
  try {
    // Use monitoring service to get usage data
    const { loadUsageData } = await import('./apiKeyMonitoringService');
    const usageRecords = await loadUsageData();
    
    const now = Date.now();
    const windowStart = now - THROTTLING_WINDOW_MS;
    
    // Get recent usage for this key
    const recentUsage = usageRecords.filter(
      record => record.keyId === keyId && record.timestamp >= windowStart
    );
    
    // Count errors in the window
    const errorCount = recentUsage.filter(record => !record.success).length;
    
    return errorCount >= MAX_ERRORS_IN_WINDOW;
  } catch (error) {
    Logger.error('[ApiKeyOptimizer] Failed to detect throttling:', error);
  return false;
  }
};

/**
 * Gets key statistics for a specific timeframe
 * This is a helper that will be implemented in apiKeyMonitoringService
 */
// Note: This function will be imported from apiKeyMonitoringService
// For now, we'll create a placeholder that the monitoring service will implement
