import { Logger } from './loggerService';
import { PlatformService } from './platformService';

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
 * Resource Manager
 * Manages CPU, memory, and concurrency limits based on resource mode
 */

const STORAGE_KEY_RESOURCE_CONFIG = 'globalreach_resource_config';

export type ResourceMode = 'low' | 'medium' | 'high' | 'auto';

export interface ResourceConfig {
  mode: ResourceMode;
  cpuLimit?: number; // Percentage (0-100)
  memoryLimit?: number; // MB
  concurrencyLimit?: number; // Max concurrent requests
  backgroundTaskInterval?: number; // ms between background tasks
}

export interface SystemCapabilities {
  cpuCores: number;
  totalMemory: number; // MB
  freeMemory: number; // MB
  cpuUsage: number; // Percentage
  memoryUsage: number; // Percentage
}

// Resource mode presets
const RESOURCE_PRESETS: Record<ResourceMode, Omit<ResourceConfig, 'mode'>> = {
  low: {
    cpuLimit: 25,
    memoryLimit: 512,
    concurrencyLimit: 5,
    backgroundTaskInterval: 10000, // 10 seconds
  },
  medium: {
    cpuLimit: 50,
    memoryLimit: 1024,
    concurrencyLimit: 10,
    backgroundTaskInterval: 5000, // 5 seconds
  },
  high: {
    cpuLimit: 80,
    memoryLimit: 2048,
    concurrencyLimit: 20,
    backgroundTaskInterval: 2000, // 2 seconds
  },
  auto: {
    // Will be calculated dynamically
    cpuLimit: undefined,
    memoryLimit: undefined,
    concurrencyLimit: undefined,
    backgroundTaskInterval: undefined,
  },
};

/**
 * Gets resource configuration
 */
export const getResourceConfig = async (): Promise<ResourceConfig> => {
  const stored = await PlatformService.secureLoad(STORAGE_KEY_RESOURCE_CONFIG);
  if (stored) {
    return JSON.parse(stored);
  }
  
  return {
    mode: 'auto',
  };
};

/**
 * Saves resource configuration
 */
export const saveResourceConfig = async (config: ResourceConfig): Promise<void> => {
  await PlatformService.secureSave(STORAGE_KEY_RESOURCE_CONFIG, JSON.stringify(config));
  Logger.info('[ResourceManager] Resource configuration saved');
};

/**
 * Gets system capabilities
 */
export const getSystemCapabilities = async (): Promise<SystemCapabilities> => {
  const os = getOS();
  
  // Default values for browser context
  let cpuCores = 4;
  let totalMemory = 4096;
  let freeMemory = 2048;
  let cpuUsage = 0;
  
  if (os) {
    cpuCores = os.cpus().length;
    totalMemory = Math.round(os.totalmem() / (1024 * 1024)); // MB
    freeMemory = Math.round(os.freemem() / (1024 * 1024)); // MB
    cpuUsage = await getCPUUsage();
  } else if (typeof window !== 'undefined' && (window as any).electronAPI) {
    // In Electron renderer, try to get via IPC (would need IPC handler)
    // For now, use defaults
    cpuCores = navigator.hardwareConcurrency || 4;
    // @ts-ignore - performance.memory is Chrome-specific
    if (performance.memory) {
      // @ts-ignore
      totalMemory = Math.round(performance.memory.jsHeapSizeLimit / (1024 * 1024));
      // @ts-ignore
      freeMemory = Math.round((performance.memory.jsHeapSizeLimit - performance.memory.usedJSHeapSize) / (1024 * 1024));
    }
  } else {
    // Browser fallback
    cpuCores = navigator.hardwareConcurrency || 4;
    // @ts-ignore
    if (performance.memory) {
      // @ts-ignore
      totalMemory = Math.round(performance.memory.jsHeapSizeLimit / (1024 * 1024));
      // @ts-ignore
      freeMemory = Math.round((performance.memory.jsHeapSizeLimit - performance.memory.usedJSHeapSize) / (1024 * 1024));
    }
  }
  
  const memoryUsage = totalMemory > 0 ? ((totalMemory - freeMemory) / totalMemory) * 100 : 0;
  
  return {
    cpuCores,
    totalMemory,
    freeMemory,
    cpuUsage,
    memoryUsage,
  };
};

/**
 * Gets CPU usage (simplified)
 */
const getCPUUsage = async (): Promise<number> => {
  return new Promise((resolve) => {
    const os = getOS();
    if (!os) {
      resolve(0); // Can't get CPU usage in browser
      return;
    }
    
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });
    
    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~((idle / total) * 100);
    
    resolve(Math.max(0, Math.min(100, usage)));
  });
};

/**
 * Calculates auto mode configuration based on system capabilities
 */
export const calculateAutoConfig = async (): Promise<Omit<ResourceConfig, 'mode'>> => {
  const capabilities = await getSystemCapabilities();
  
  // Determine mode based on system resources
  let effectiveMode: 'low' | 'medium' | 'high';
  
  if (capabilities.totalMemory < 2048 || capabilities.cpuCores < 2) {
    // Low-end system
    effectiveMode = 'low';
  } else if (capabilities.totalMemory < 4096 || capabilities.cpuCores < 4) {
    // Mid-range system
    effectiveMode = 'medium';
  } else {
    // High-end system
    effectiveMode = 'high';
  }
  
  // Adjust based on current usage
  if (capabilities.cpuUsage > 70 || capabilities.memoryUsage > 80) {
    // System under load, reduce limits
    if (effectiveMode === 'high') effectiveMode = 'medium';
    else if (effectiveMode === 'medium') effectiveMode = 'low';
  }
  
  const preset = RESOURCE_PRESETS[effectiveMode];
  
  // Scale based on available resources
  const memoryLimit = Math.min(
    preset.memoryLimit || 1024,
    Math.round(capabilities.freeMemory * 0.5) // Use 50% of free memory
  );
  
  const concurrencyLimit = Math.min(
    preset.concurrencyLimit || 10,
    Math.max(2, capabilities.cpuCores * 2) // 2x CPU cores
  );
  
  return {
    cpuLimit: preset.cpuLimit,
    memoryLimit,
    concurrencyLimit,
    backgroundTaskInterval: preset.backgroundTaskInterval,
  };
};

/**
 * Gets effective resource configuration (resolves auto mode)
 */
export const getEffectiveConfig = async (): Promise<Omit<ResourceConfig, 'mode'> & { mode: ResourceMode }> => {
  const config = await getResourceConfig();
  
  if (config.mode === 'auto') {
    const autoConfig = await calculateAutoConfig();
    return {
      mode: 'auto',
      ...autoConfig,
    };
  }
  
  const preset = RESOURCE_PRESETS[config.mode];
  return {
    mode: config.mode,
    cpuLimit: config.cpuLimit ?? preset.cpuLimit,
    memoryLimit: config.memoryLimit ?? preset.memoryLimit,
    concurrencyLimit: config.concurrencyLimit ?? preset.concurrencyLimit,
    backgroundTaskInterval: config.backgroundTaskInterval ?? preset.backgroundTaskInterval,
  };
};

/**
 * Request queue for concurrency limiting
 */
class RequestQueue {
  private queue: Array<() => Promise<any>> = [];
  private running = 0;
  private concurrencyLimit: number;
  
  constructor(concurrencyLimit: number) {
    this.concurrencyLimit = concurrencyLimit;
  }
  
  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.process();
    });
  }
  
  private async process() {
    if (this.running >= this.concurrencyLimit || this.queue.length === 0) {
      return;
    }
    
    this.running++;
    const task = this.queue.shift();
    if (task) {
      await task();
      this.running--;
      this.process();
    } else {
      this.running--;
    }
  }
  
  setConcurrencyLimit(limit: number) {
    this.concurrencyLimit = limit;
  }
}

let requestQueue: RequestQueue | null = null;

/**
 * Gets or creates request queue
 */
export const getRequestQueue = async (): Promise<RequestQueue> => {
  if (!requestQueue) {
    const config = await getEffectiveConfig();
    requestQueue = new RequestQueue(config.concurrencyLimit || 10);
  }
  return requestQueue;
};

/**
 * Updates request queue limits
 */
export const updateResourceLimits = async (): Promise<void> => {
  const config = await getEffectiveConfig();
  if (requestQueue) {
    requestQueue.setConcurrencyLimit(config.concurrencyLimit || 10);
  }
};

