import { Logger } from './loggerService';
import { getSystemCapabilities, SystemCapabilities } from './resourceManager';

// Safe OS module access (only in Node.js/Electron main process)
const getOS = () => {
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    // In Electron renderer, we'll need to use IPC
    return null;
  }
  try {
    return require('os');
  } catch {
    return null;
  }
};

/**
 * System Monitor
 * Monitors system resources and performance metrics
 */

export interface SystemMetrics {
  timestamp: number;
  cpu: {
    usage: number; // Percentage
    cores: number;
    loadAverage: number[];
  };
  memory: {
    total: number; // MB
    free: number; // MB
    used: number; // MB
    usage: number; // Percentage
  };
  disk?: {
    total: number; // MB
    free: number; // MB
    used: number; // MB
    usage: number; // Percentage
  };
  network?: {
    interfaces: Array<{
      name: string;
      address: string;
      bytesReceived: number;
      bytesSent: number;
    }>;
  };
  uptime: number; // seconds
}

let metricsHistory: SystemMetrics[] = [];
const MAX_HISTORY = 100; // Keep last 100 measurements

/**
 * Gets current system metrics
 */
export const getSystemMetrics = async (): Promise<SystemMetrics> => {
  const capabilities = await getSystemCapabilities();
  const os = getOS();
  
  let loadAvg = [0, 0, 0];
  let uptime = 0;
  
  if (os) {
    loadAvg = os.loadavg();
    uptime = os.uptime();
  } else {
    // Browser fallback - use performance API if available
    uptime = performance.now() / 1000; // Convert to seconds
  }
  
  const metrics: SystemMetrics = {
    timestamp: Date.now(),
    cpu: {
      usage: capabilities.cpuUsage,
      cores: capabilities.cpuCores,
      loadAverage: loadAvg,
    },
    memory: {
      total: capabilities.totalMemory,
      free: capabilities.freeMemory,
      used: capabilities.totalMemory - capabilities.freeMemory,
      usage: capabilities.memoryUsage,
    },
    uptime,
  };
  
  // Add to history
  metricsHistory.push(metrics);
  if (metricsHistory.length > MAX_HISTORY) {
    metricsHistory.shift();
  }
  
  return metrics;
};

/**
 * Gets metrics history
 */
export const getMetricsHistory = (limit: number = 50): SystemMetrics[] => {
  return metricsHistory.slice(-limit);
};

/**
 * Gets average metrics over time period
 */
export const getAverageMetrics = (minutes: number = 5): Partial<SystemMetrics> => {
  const cutoff = Date.now() - (minutes * 60 * 1000);
  const recent = metricsHistory.filter(m => m.timestamp >= cutoff);
  
  if (recent.length === 0) {
    return {};
  }
  
  const avgCpu = recent.reduce((sum, m) => sum + m.cpu.usage, 0) / recent.length;
  const avgMemory = recent.reduce((sum, m) => sum + m.memory.usage, 0) / recent.length;
  
  return {
    cpu: {
      usage: avgCpu,
      cores: recent[0].cpu.cores,
      loadAverage: recent[0].cpu.loadAverage,
    },
    memory: {
      total: recent[0].memory.total,
      free: recent[0].memory.free,
      used: recent[0].memory.used,
      usage: avgMemory,
    },
  };
};

/**
 * Checks if system is under stress
 */
export const isSystemUnderStress = async (): Promise<boolean> => {
  const metrics = await getSystemMetrics();
  return metrics.cpu.usage > 80 || metrics.memory.usage > 85;
};

/**
 * Gets system health status
 */
export const getSystemHealth = async (): Promise<{
  status: 'healthy' | 'warning' | 'critical';
  issues: string[];
}> => {
  const metrics = await getSystemMetrics();
  const issues: string[] = [];
  
  if (metrics.cpu.usage > 90) {
    issues.push('CPU usage critically high');
  } else if (metrics.cpu.usage > 75) {
    issues.push('CPU usage high');
  }
  
  if (metrics.memory.usage > 90) {
    issues.push('Memory usage critically high');
  } else if (metrics.memory.usage > 80) {
    issues.push('Memory usage high');
  }
  
  if (metrics.memory.free < 100) {
    issues.push('Low free memory');
  }
  
  let status: 'healthy' | 'warning' | 'critical' = 'healthy';
  if (issues.some(i => i.includes('critically'))) {
    status = 'critical';
  } else if (issues.length > 0) {
    status = 'warning';
  }
  
  return { status, issues };
};

/**
 * Starts monitoring (call periodically)
 */
export const startMonitoring = (intervalMs: number = 5000): NodeJS.Timeout => {
  return setInterval(async () => {
    try {
      await getSystemMetrics();
    } catch (error) {
      Logger.error('[SystemMonitor] Failed to collect metrics:', error);
    }
  }, intervalMs);
};

