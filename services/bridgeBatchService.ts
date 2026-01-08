/**
 * Bridge Batch Service
 * Batches multiple native/web bridge calls to reduce overhead
 * Queues operations and flushes in batches (max 10ms delay)
 */

const BRIDGE_BATCH_DELAY = parseInt(process.env.BRIDGE_BATCH_DELAY || '10', 10);
const MAX_BATCH_SIZE = 50;

interface BatchedOperation {
  type: 'get' | 'set' | 'remove' | 'clear';
  key?: string;
  value?: string;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

class BridgeBatchService {
  private queue: BatchedOperation[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  /**
   * Add operation to batch queue
   */
  private enqueue(operation: BatchedOperation): Promise<any> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        ...operation,
        resolve,
        reject,
      });

      // Flush if queue is full
      if (this.queue.length >= MAX_BATCH_SIZE) {
        this.flush();
      } else {
        // Schedule flush after delay
        this.scheduleFlush();
      }
    });
  }

  /**
   * Schedule flush after delay
   */
  private scheduleFlush() {
    if (this.flushTimer) {
      return; // Already scheduled
    }

    this.flushTimer = setTimeout(() => {
      this.flush();
    }, BRIDGE_BATCH_DELAY);
  }

  /**
   * Flush all queued operations
   */
  private async flush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const operations = this.queue.splice(0, MAX_BATCH_SIZE);
    this.isProcessing = false;

    try {
      const { MobileStorageService } = await import('./mobileStorageService');

      // Group operations by type
      const gets: BatchedOperation[] = [];
      const sets: BatchedOperation[] = [];
      const removes: BatchedOperation[] = [];
      const clears: BatchedOperation[] = [];

      operations.forEach(op => {
        if (op.type === 'get') gets.push(op);
        else if (op.type === 'set') sets.push(op);
        else if (op.type === 'remove') removes.push(op);
        else if (op.type === 'clear') clears.push(op);
      });

      // Execute gets in batch
      if (gets.length > 0) {
        const keys = gets.map(op => op.key!).filter(Boolean);
        const values = await MobileStorageService.getMultiple(keys);
        gets.forEach(op => {
          if (op.key) {
            op.resolve(values[op.key] || null);
          } else {
            op.reject(new Error('Missing key for get operation'));
          }
        });
      }

      // Execute sets in batch
      if (sets.length > 0) {
        const items: Record<string, string> = {};
        sets.forEach(op => {
          if (op.key && op.value !== undefined) {
            items[op.key] = op.value;
          }
        });
        await MobileStorageService.setMultiple(items);
        sets.forEach(op => op.resolve(undefined));
      }

      // Execute removes sequentially (if needed)
      if (removes.length > 0) {
        await Promise.all(
          removes.map(async (op) => {
            if (op.key) {
              await MobileStorageService.remove(op.key);
              op.resolve(undefined);
            } else {
              op.reject(new Error('Missing key for remove operation'));
            }
          })
        );
      }

      // Execute clears
      if (clears.length > 0) {
        await MobileStorageService.clear();
        clears.forEach(op => op.resolve(undefined));
      }
    } catch (error) {
      // Reject all operations on error
      operations.forEach(op => op.reject(error));
    }

    // Process remaining queue if any
    if (this.queue.length > 0) {
      this.scheduleFlush();
    }
  }

  /**
   * Get value (batched)
   */
  async get(key: string): Promise<string | null> {
    return this.enqueue({
      type: 'get',
      key,
      resolve: () => {},
      reject: () => {},
    });
  }

  /**
   * Set value (batched)
   */
  async set(key: string, value: string): Promise<void> {
    return this.enqueue({
      type: 'set',
      key,
      value,
      resolve: () => {},
      reject: () => {},
    });
  }

  /**
   * Remove value (batched)
   */
  async remove(key: string): Promise<void> {
    return this.enqueue({
      type: 'remove',
      key,
      resolve: () => {},
      reject: () => {},
    });
  }

  /**
   * Clear all (batched)
   */
  async clear(): Promise<void> {
    return this.enqueue({
      type: 'clear',
      resolve: () => {},
      reject: () => {},
    });
  }

  /**
   * Force flush (for immediate operations)
   */
  async forceFlush(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }
}

// Export singleton instance
export const bridgeBatchService = new BridgeBatchService();

