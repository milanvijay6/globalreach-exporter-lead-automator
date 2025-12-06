/**
 * Performance Monitor Service
 * Tracks Core Web Vitals, bundle sizes, API response times, memory usage, and FPS
 */

interface PerformanceMetrics {
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  bundleSize?: number; // Bundle size in KB
  apiResponseTime?: number; // Average API response time
  memoryUsage?: number; // Memory usage in MB
  fps?: number; // Frames per second
  offlineStatus?: boolean;
  timestamp: number;
}

interface WebVital {
  name: string;
  value: number;
  delta: number;
  id: string;
  rating: 'good' | 'needs-improvement' | 'poor';
}

const metricsHistory: PerformanceMetrics[] = [];
const MAX_HISTORY = 100;

/**
 * Get performance rating
 */
function getRating(value: number, thresholds: { good: number; poor: number }): 'good' | 'needs-improvement' | 'poor' {
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Track Largest Contentful Paint (LCP)
 */
export function trackLCP(): void {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as any;
      const lcp = lastEntry.renderTime || lastEntry.loadTime;

      if (lcp) {
        recordMetric({ lcp });
      }
    });

    observer.observe({ entryTypes: ['largest-contentful-paint'] });
  } catch (error) {
    console.warn('[PerformanceMonitor] Failed to track LCP:', error);
  }
}

/**
 * Track First Input Delay (FID)
 */
export function trackFID(): void {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        const fid = entry.processingStart - entry.startTime;
        if (fid > 0) {
          recordMetric({ fid });
        }
      });
    });

    observer.observe({ entryTypes: ['first-input'] });
  } catch (error) {
    console.warn('[PerformanceMonitor] Failed to track FID:', error);
  }
}

/**
 * Track Cumulative Layout Shift (CLS)
 */
export function trackCLS(): void {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

  try {
    let clsValue = 0;
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      });
      recordMetric({ cls: clsValue });
    });

    observer.observe({ entryTypes: ['layout-shift'] });
  } catch (error) {
    console.warn('[PerformanceMonitor] Failed to track CLS:', error);
  }
}

/**
 * Track bundle size
 */
export function trackBundleSize(): void {
  if (typeof window === 'undefined' || !('performance' in window)) return;

  try {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const jsResources = resources.filter(r => r.name.endsWith('.js'));
    const totalSize = jsResources.reduce((sum, r) => {
      const size = (r as any).transferSize || (r as any).encodedBodySize || 0;
      return sum + size;
    }, 0);

    const bundleSizeKB = totalSize / 1024;
    recordMetric({ bundleSize: bundleSizeKB });
  } catch (error) {
    console.warn('[PerformanceMonitor] Failed to track bundle size:', error);
  }
}

/**
 * Track API response time
 */
let apiCallTimes: number[] = [];
const MAX_API_CALLS = 50;

export function trackAPICall(duration: number): void {
  apiCallTimes.push(duration);
  if (apiCallTimes.length > MAX_API_CALLS) {
    apiCallTimes.shift();
  }

  const avgResponseTime = apiCallTimes.reduce((sum, time) => sum + time, 0) / apiCallTimes.length;
  recordMetric({ apiResponseTime: avgResponseTime });
}

/**
 * Track memory usage
 */
export function trackMemory(): void {
  if (typeof window === 'undefined') return;

  try {
    const memory = (performance as any).memory;
    if (memory) {
      const usedMB = memory.usedJSHeapSize / 1024 / 1024;
      recordMetric({ memoryUsage: usedMB });
    }
  } catch (error) {
    console.warn('[PerformanceMonitor] Failed to track memory:', error);
  }
}

/**
 * Track FPS
 */
let lastFrameTime = performance.now();
let frameCount = 0;
let fpsValue = 60;

export function trackFPS(): void {
  if (typeof window === 'undefined') return;

  frameCount++;
  const currentTime = performance.now();
  const delta = currentTime - lastFrameTime;

  if (delta >= 1000) {
    fpsValue = Math.round((frameCount * 1000) / delta);
    frameCount = 0;
    lastFrameTime = currentTime;
    recordMetric({ fps: fpsValue });
  }

  requestAnimationFrame(trackFPS);
}

/**
 * Track offline status
 */
export function trackOfflineStatus(): void {
  if (typeof window === 'undefined') return;

  const updateStatus = () => {
    recordMetric({ offlineStatus: !navigator.onLine });
  };

  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
  updateStatus();
}

/**
 * Record metric
 */
function recordMetric(metric: Partial<PerformanceMetrics>): void {
  const fullMetric: PerformanceMetrics = {
    ...metric,
    timestamp: Date.now()
  };

  metricsHistory.push(fullMetric);
  if (metricsHistory.length > MAX_HISTORY) {
    metricsHistory.shift();
  }

  // Log to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[PerformanceMonitor]', metric);
  }
}

/**
 * Get current metrics
 */
export function getCurrentMetrics(): PerformanceMetrics {
  if (metricsHistory.length === 0) {
    return { timestamp: Date.now() };
  }

  const latest = metricsHistory[metricsHistory.length - 1];
  return latest;
}

/**
 * Get metrics history
 */
export function getMetricsHistory(): PerformanceMetrics[] {
  return [...metricsHistory];
}

/**
 * Get Web Vitals
 */
export function getWebVitals(): WebVital[] {
  const metrics = getCurrentMetrics();
  const vitals: WebVital[] = [];

  if (metrics.lcp !== undefined) {
    vitals.push({
      name: 'LCP',
      value: metrics.lcp,
      delta: metrics.lcp,
      id: 'lcp',
      rating: getRating(metrics.lcp, { good: 2500, poor: 4000 })
    });
  }

  if (metrics.fid !== undefined) {
    vitals.push({
      name: 'FID',
      value: metrics.fid,
      delta: metrics.fid,
      id: 'fid',
      rating: getRating(metrics.fid, { good: 100, poor: 300 })
    });
  }

  if (metrics.cls !== undefined) {
    vitals.push({
      name: 'CLS',
      value: metrics.cls,
      delta: metrics.cls,
      id: 'cls',
      rating: getRating(metrics.cls, { good: 0.1, poor: 0.25 })
    });
  }

  return vitals;
}

/**
 * Initialize performance monitoring
 */
export function initPerformanceMonitoring(): void {
  if (typeof window === 'undefined') return;

  trackLCP();
  trackFID();
  trackCLS();
  trackBundleSize();
  trackMemory();
  trackOfflineStatus();
  
  // Start FPS tracking
  requestAnimationFrame(trackFPS);

  // Track memory periodically
  setInterval(trackMemory, 5000);

  console.log('[PerformanceMonitor] Initialized');
}

