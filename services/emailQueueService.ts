import { Logger } from './loggerService';
import { EmailMessage } from './outlookEmailService';
import { OutlookEmailCredentials } from '../types';

export interface QueuedEmail {
  id: string;
  message: EmailMessage;
  credentials: OutlookEmailCredentials;
  clientId?: string;
  clientSecret?: string;
  tenantId?: string;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  lastAttemptAt?: number;
  nextRetryAt: number;
  error?: string;
  priority: 'high' | 'normal' | 'low';
}

const MAX_ATTEMPTS = 3;
const INITIAL_RETRY_DELAY_MS = 1000; // 1 second
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000; // 5 minutes
const QUEUE_STORAGE_KEY = 'globalreach_email_queue';

/**
 * Email Queue Service
 * Handles offline queue, retry logic, and rate limiting for email sends
 */
export const EmailQueueService = {
  /**
   * Loads queued emails from storage
   */
  loadQueue: (): QueuedEmail[] => {
    try {
      const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (!stored) return [];
      
      const queue = JSON.parse(stored) as QueuedEmail[];
      // Filter out expired items (older than 24 hours)
      const now = Date.now();
      const validQueue = queue.filter(item => (now - item.createdAt) < 24 * 60 * 60 * 1000);
      
      if (validQueue.length !== queue.length) {
        EmailQueueService.saveQueue(validQueue);
      }
      
      return validQueue;
    } catch (error) {
      Logger.error('[EmailQueueService] Failed to load queue:', error);
      return [];
    }
  },

  /**
   * Saves queued emails to storage
   */
  saveQueue: (queue: QueuedEmail[]): void => {
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    } catch (error) {
      Logger.error('[EmailQueueService] Failed to save queue:', error);
    }
  },

  /**
   * Adds an email to the queue
   */
  enqueue: (
    message: EmailMessage,
    credentials: OutlookEmailCredentials,
    options?: {
      clientId?: string;
      clientSecret?: string;
      tenantId?: string;
      priority?: 'high' | 'normal' | 'low';
      maxAttempts?: number;
    }
  ): string => {
    const queue = EmailQueueService.loadQueue();
    const id = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const queuedEmail: QueuedEmail = {
      id,
      message,
      credentials,
      clientId: options?.clientId,
      clientSecret: options?.clientSecret,
      tenantId: options?.tenantId,
      attempts: 0,
      maxAttempts: options?.maxAttempts || MAX_ATTEMPTS,
      createdAt: Date.now(),
      nextRetryAt: Date.now(),
      priority: options?.priority || 'normal',
    };

    queue.push(queuedEmail);
    EmailQueueService.saveQueue(queue);
    
    Logger.info('[EmailQueueService] Email queued', { id, priority: queuedEmail.priority });
    return id;
  },

  /**
   * Removes an email from the queue
   */
  dequeue: (id: string): boolean => {
    const queue = EmailQueueService.loadQueue();
    const index = queue.findIndex(item => item.id === id);
    
    if (index === -1) return false;
    
    queue.splice(index, 1);
    EmailQueueService.saveQueue(queue);
    
    Logger.info('[EmailQueueService] Email dequeued', { id });
    return true;
  },

  /**
   * Gets emails ready for retry
   */
  getReadyForRetry: (): QueuedEmail[] => {
    const queue = EmailQueueService.loadQueue();
    const now = Date.now();
    
    return queue.filter(item => {
      // Check if it's time to retry
      if (item.nextRetryAt > now) return false;
      
      // Check if max attempts reached
      if (item.attempts >= item.maxAttempts) return false;
      
      return true;
    }).sort((a, b) => {
      // Sort by priority first, then by nextRetryAt
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.nextRetryAt - b.nextRetryAt;
    });
  },

  /**
   * Calculates next retry delay using exponential backoff
   */
  calculateNextRetryDelay: (attempts: number): number => {
    const delay = Math.min(
      INITIAL_RETRY_DELAY_MS * Math.pow(2, attempts),
      MAX_RETRY_DELAY_MS
    );
    // Add some jitter to avoid thundering herd
    const jitter = Math.random() * 0.3 * delay; // Up to 30% jitter
    return delay + jitter;
  },

  /**
   * Updates a queued email after an attempt
   */
  updateAfterAttempt: (
    id: string,
    success: boolean,
    error?: string
  ): void => {
    const queue = EmailQueueService.loadQueue();
    const item = queue.find(q => q.id === id);
    
    if (!item) return;
    
    item.attempts += 1;
    item.lastAttemptAt = Date.now();
    
    if (success) {
      // Remove from queue on success
      EmailQueueService.dequeue(id);
      Logger.info('[EmailQueueService] Email sent successfully, removed from queue', { id });
    } else {
      // Calculate next retry time
      if (item.attempts < item.maxAttempts) {
        item.nextRetryAt = Date.now() + EmailQueueService.calculateNextRetryDelay(item.attempts);
        item.error = error;
        EmailQueueService.saveQueue(queue);
        Logger.warn('[EmailQueueService] Email send failed, scheduled retry', {
          id,
          attempts: item.attempts,
          nextRetryAt: new Date(item.nextRetryAt).toISOString(),
        });
      } else {
        // Max attempts reached, keep in queue but mark as failed
        item.error = error || 'Max attempts reached';
        EmailQueueService.saveQueue(queue);
        Logger.error('[EmailQueueService] Email send failed after max attempts', {
          id,
          attempts: item.attempts,
          error: item.error,
        });
      }
    }
  },

  /**
   * Gets failed emails (reached max attempts)
   */
  getFailedEmails: (): QueuedEmail[] => {
    const queue = EmailQueueService.loadQueue();
    return queue.filter(item => item.attempts >= item.maxAttempts);
  },

  /**
   * Clears failed emails from queue
   */
  clearFailed: (): number => {
    const queue = EmailQueueService.loadQueue();
    const failed = queue.filter(item => item.attempts >= item.maxAttempts);
    const remaining = queue.filter(item => item.attempts < item.maxAttempts);
    
    EmailQueueService.saveQueue(remaining);
    
    Logger.info('[EmailQueueService] Cleared failed emails', { count: failed.length });
    return failed.length;
  },

  /**
   * Gets queue statistics
   */
  getQueueStats: (): {
    total: number;
    pending: number;
    failed: number;
    byPriority: { high: number; normal: number; low: number };
  } => {
    const queue = EmailQueueService.loadQueue();
    const now = Date.now();
    
    const pending = queue.filter(item => 
      item.attempts < item.maxAttempts && item.nextRetryAt <= now
    );
    const failed = queue.filter(item => item.attempts >= item.maxAttempts);
    
    const byPriority = {
      high: queue.filter(item => item.priority === 'high').length,
      normal: queue.filter(item => item.priority === 'normal').length,
      low: queue.filter(item => item.priority === 'low').length,
    };
    
    return {
      total: queue.length,
      pending: pending.length,
      failed: failed.length,
      byPriority,
    };
  },
};

