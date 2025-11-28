/**
 * WhatsApp Web Rate Limiter
 * Enforces strict rate limiting to prevent account bans
 */

interface RateLimitState {
  dailyCount: number;
  hourlyCount: number;
  perContactCount: Map<string, { count: number; resetTime: number }>;
  lastMessageTime: number;
  messageQueue: Array<{ to: string; content: string; timestamp: number }>;
  isPaused: boolean;
  pauseUntil?: number;
}

interface RateLimitConfig {
  dailyLimit: number;
  hourlyLimit: number;
  perContactLimit: number;
  perContactWindowMs: number;
  minDelaySeconds: number;
  maxDelaySeconds: number;
  burstWindowMs: number;
  burstLimit: number;
  nightModeStart: number; // Hour (0-23)
  nightModeEnd: number; // Hour (0-23)
  businessHoursStart: number; // Hour (0-23)
  businessHoursEnd: number; // Hour (0-23)
  weekendReduction: boolean;
  conservativeMode: boolean;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  dailyLimit: 20,
  hourlyLimit: 5,
  perContactLimit: 3,
  perContactWindowMs: 24 * 60 * 60 * 1000, // 24 hours
  minDelaySeconds: 30,
  maxDelaySeconds: 60,
  burstWindowMs: 5 * 60 * 1000, // 5 minutes
  burstLimit: 2,
  nightModeStart: 22, // 10 PM
  nightModeEnd: 8, // 8 AM
  businessHoursStart: 9, // 9 AM
  businessHoursEnd: 18, // 6 PM
  weekendReduction: true,
  conservativeMode: false,
};

class WhatsAppWebRateLimiterClass {
  private state: RateLimitState;
  private config: RateLimitConfig;
  private dailyResetTime: number;
  private hourlyResetTime: number;
  private burstMessages: Array<{ timestamp: number }> = [];

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    if (this.config.conservativeMode) {
      this.config.dailyLimit = 10;
      this.config.hourlyLimit = 2;
      this.config.minDelaySeconds = 60;
      this.config.maxDelaySeconds = 120;
    }

    this.state = {
      dailyCount: 0,
      hourlyCount: 0,
      perContactCount: new Map(),
      lastMessageTime: 0,
      messageQueue: [],
      isPaused: false,
    };

    // Set reset times
    const now = new Date();
    this.dailyResetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
    this.hourlyResetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0).getTime();

    // Load persisted state (async, don't wait)
    this.loadState().catch(err => console.error('[WhatsAppWebRateLimiter] Failed to load state:', err));
  }

  /**
   * Check if a message can be sent
   */
  async canSend(to: string): Promise<{ allowed: boolean; reason?: string; waitTimeMs?: number }> {
    const now = Date.now();

    // Check if paused
    if (this.state.isPaused) {
      if (this.state.pauseUntil && now < this.state.pauseUntil) {
        return {
          allowed: false,
          reason: 'Rate limiter is paused',
          waitTimeMs: this.state.pauseUntil - now,
        };
      } else {
        // Pause expired, resume
        this.state.isPaused = false;
        delete this.state.pauseUntil;
      }
    }

    // Reset counters if needed
    this.resetCountersIfNeeded(now);

    // Check night mode
    const hour = new Date(now).getHours();
    if (this.isNightMode(hour)) {
      return {
        allowed: false,
        reason: 'Night mode: Messages blocked between 10 PM - 8 AM',
        waitTimeMs: this.getTimeUntilNextAllowedHour(now),
      };
    }

    // Check business hours (if enabled)
    if (!this.isBusinessHours(hour)) {
      return {
        allowed: false,
        reason: 'Outside business hours (9 AM - 6 PM)',
        waitTimeMs: this.getTimeUntilBusinessHours(now),
      };
    }

    // Check weekend reduction
    if (this.config.weekendReduction && this.isWeekend(now)) {
      // Apply 50% reduction on weekends
      const effectiveDailyLimit = Math.floor(this.config.dailyLimit * 0.5);
      const effectiveHourlyLimit = Math.floor(this.config.hourlyLimit * 0.5);
      
      if (this.state.dailyCount >= effectiveDailyLimit) {
        return {
          allowed: false,
          reason: `Weekend daily limit reached (${effectiveDailyLimit} messages)`,
          waitTimeMs: this.dailyResetTime - now,
        };
      }

      if (this.state.hourlyCount >= effectiveHourlyLimit) {
        return {
          allowed: false,
          reason: `Weekend hourly limit reached (${effectiveHourlyLimit} messages)`,
          waitTimeMs: this.hourlyResetTime - now,
        };
      }
    } else {
      // Check daily limit
      if (this.state.dailyCount >= this.config.dailyLimit) {
        return {
          allowed: false,
          reason: `Daily limit reached (${this.config.dailyLimit} messages)`,
          waitTimeMs: this.dailyResetTime - now,
        };
      }

      // Check hourly limit
      if (this.state.hourlyCount >= this.config.hourlyLimit) {
        return {
          allowed: false,
          reason: `Hourly limit reached (${this.config.hourlyLimit} messages)`,
          waitTimeMs: this.hourlyResetTime - now,
        };
      }
    }

    // Check per-contact limit
    const contactState = this.state.perContactCount.get(to);
    if (contactState) {
      if (now < contactState.resetTime) {
        if (contactState.count >= this.config.perContactLimit) {
          return {
            allowed: false,
            reason: `Per-contact limit reached (${this.config.perContactLimit} messages per 24h)`,
            waitTimeMs: contactState.resetTime - now,
          };
        }
      } else {
        // Reset expired contact limit
        this.state.perContactCount.delete(to);
      }
    }

    // Check burst protection
    const recentBursts = this.burstMessages.filter(m => now - m.timestamp < this.config.burstWindowMs);
    if (recentBursts.length >= this.config.burstLimit) {
      const oldestBurst = recentBursts[0];
      const waitTime = this.config.burstWindowMs - (now - oldestBurst.timestamp);
      return {
        allowed: false,
        reason: `Burst limit reached (${this.config.burstLimit} messages in ${this.config.burstWindowMs / 1000}s)`,
        waitTimeMs: waitTime,
      };
    }

    // Check minimum delay since last message
    if (this.state.lastMessageTime > 0) {
      const timeSinceLastMessage = now - this.state.lastMessageTime;
      const minDelayMs = this.config.minDelaySeconds * 1000;
      if (timeSinceLastMessage < minDelayMs) {
        return {
          allowed: false,
          reason: `Minimum delay not met (${this.config.minDelaySeconds}s between messages)`,
          waitTimeMs: minDelayMs - timeSinceLastMessage,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Record a message send and calculate delay for next message
   */
  async recordSend(to: string): Promise<{ delayMs: number }> {
    const now = Date.now();

    // Update counters
    this.state.dailyCount++;
    this.state.hourlyCount++;
    this.state.lastMessageTime = now;

    // Update per-contact count
    const contactState = this.state.perContactCount.get(to);
    if (contactState && now < contactState.resetTime) {
      contactState.count++;
    } else {
      this.state.perContactCount.set(to, {
        count: 1,
        resetTime: now + this.config.perContactWindowMs,
      });
    }

    // Record burst
    this.burstMessages.push({ timestamp: now });
    // Clean old bursts
    this.burstMessages = this.burstMessages.filter(m => now - m.timestamp < this.config.burstWindowMs * 2);

    // Calculate delay with random jitter
    const baseDelay = this.config.minDelaySeconds * 1000;
    const jitterRange = (this.config.maxDelaySeconds - this.config.minDelaySeconds) * 1000;
    const jitter = Math.floor(Math.random() * jitterRange);
    const delayMs = baseDelay + jitter;

    // Save state (async, don't wait)
    this.saveState().catch(err => console.error('[WhatsAppWebRateLimiter] Failed to save state:', err));

    return { delayMs };
  }

  /**
   * Get current usage statistics
   */
  getUsage(): {
    dailyCount: number;
    dailyLimit: number;
    hourlyCount: number;
    hourlyLimit: number;
    nextAllowedTime?: number;
    isPaused: boolean;
  } {
    const now = Date.now();
    this.resetCountersIfNeeded(now);

    const effectiveDailyLimit = this.config.weekendReduction && this.isWeekend(now)
      ? Math.floor(this.config.dailyLimit * 0.5)
      : this.config.dailyLimit;

    const effectiveHourlyLimit = this.config.weekendReduction && this.isWeekend(now)
      ? Math.floor(this.config.hourlyLimit * 0.5)
      : this.config.hourlyLimit;

    return {
      dailyCount: this.state.dailyCount,
      dailyLimit: effectiveDailyLimit,
      hourlyCount: this.state.hourlyCount,
      hourlyLimit: effectiveHourlyLimit,
      nextAllowedTime: this.state.lastMessageTime > 0
        ? this.state.lastMessageTime + (this.config.minDelaySeconds * 1000)
        : undefined,
      isPaused: this.state.isPaused,
    };
  }

  /**
   * Pause sending (emergency stop)
   */
  pause(durationMs?: number): void {
    this.state.isPaused = true;
    if (durationMs) {
      this.state.pauseUntil = Date.now() + durationMs;
    }
    this.saveState().catch(err => console.error('[WhatsAppWebRateLimiter] Failed to save state:', err));
  }

  /**
   * Resume sending
   */
  resume(): void {
    this.state.isPaused = false;
    delete this.state.pauseUntil;
    this.saveState().catch(err => console.error('[WhatsAppWebRateLimiter] Failed to save state:', err));
  }

  /**
   * Reset all counters (for testing or manual reset)
   */
  reset(): void {
    this.state.dailyCount = 0;
    this.state.hourlyCount = 0;
    this.state.perContactCount.clear();
    this.state.lastMessageTime = 0;
    this.burstMessages = [];
    this.saveState().catch(err => console.error('[WhatsAppWebRateLimiter] Failed to save state:', err));
  }

  private resetCountersIfNeeded(now: number): void {
    // Reset daily counter
    if (now >= this.dailyResetTime) {
      this.state.dailyCount = 0;
      const nextDay = new Date(now);
      nextDay.setDate(nextDay.getDate() + 1);
      nextDay.setHours(0, 0, 0, 0);
      this.dailyResetTime = nextDay.getTime();
    }

    // Reset hourly counter
    if (now >= this.hourlyResetTime) {
      this.state.hourlyCount = 0;
      const nextHour = new Date(now);
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
      this.hourlyResetTime = nextHour.getTime();
    }

    // Clean expired per-contact limits
    for (const [contact, state] of this.state.perContactCount.entries()) {
      if (now >= state.resetTime) {
        this.state.perContactCount.delete(contact);
      }
    }
  }

  private isNightMode(hour: number): boolean {
    if (this.config.nightModeStart > this.config.nightModeEnd) {
      // Spans midnight
      return hour >= this.config.nightModeStart || hour < this.config.nightModeEnd;
    }
    return hour >= this.config.nightModeStart && hour < this.config.nightModeEnd;
  }

  private isBusinessHours(hour: number): boolean {
    return hour >= this.config.businessHoursStart && hour < this.config.businessHoursEnd;
  }

  private isWeekend(timestamp: number): boolean {
    const day = new Date(timestamp).getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  }

  private getTimeUntilNextAllowedHour(now: number): number {
    const date = new Date(now);
    const hour = date.getHours();
    
    if (hour >= this.config.nightModeStart || hour < this.config.nightModeEnd) {
      // Currently in night mode, wait until end
      if (hour >= this.config.nightModeStart) {
        // After start, wait until next day's end time
        date.setDate(date.getDate() + 1);
        date.setHours(this.config.nightModeEnd, 0, 0, 0);
      } else {
        // Before end, wait until end time today
        date.setHours(this.config.nightModeEnd, 0, 0, 0);
      }
      return date.getTime() - now;
    }
    return 0;
  }

  private getTimeUntilBusinessHours(now: number): number {
    const date = new Date(now);
    const hour = date.getHours();
    
    if (hour < this.config.businessHoursStart) {
      // Before business hours, wait until start
      date.setHours(this.config.businessHoursStart, 0, 0, 0);
      return date.getTime() - now;
    } else if (hour >= this.config.businessHoursEnd) {
      // After business hours, wait until next day's start
      date.setDate(date.getDate() + 1);
      date.setHours(this.config.businessHoursStart, 0, 0, 0);
      return date.getTime() - now;
    }
    return 0;
  }

  private async loadState(): Promise<void> {
    try {
      // Load from platform service if available
      const { PlatformService } = await import('./platformService');
      const saved = await PlatformService.getAppConfig('whatsappWebRateLimitState', null);
      if (saved && typeof saved === 'string') {
        const parsed = JSON.parse(saved);
        this.state.dailyCount = parsed.dailyCount || 0;
        this.state.hourlyCount = parsed.hourlyCount || 0;
        this.state.lastMessageTime = parsed.lastMessageTime || 0;
        this.state.isPaused = parsed.isPaused || false;
        this.state.pauseUntil = parsed.pauseUntil;
        
        // Restore per-contact map
        if (parsed.perContactCount) {
          this.state.perContactCount = new Map(parsed.perContactCount);
        }
      }
    } catch (error) {
      console.error('[WhatsAppWebRateLimiter] Failed to load state:', error);
    }
  }

  private async saveState(): Promise<void> {
    try {
      const { PlatformService } = await import('./platformService');
      const stateToSave = {
        dailyCount: this.state.dailyCount,
        hourlyCount: this.state.hourlyCount,
        lastMessageTime: this.state.lastMessageTime,
        isPaused: this.state.isPaused,
        pauseUntil: this.state.pauseUntil,
        perContactCount: Array.from(this.state.perContactCount.entries()),
      };
      await PlatformService.setAppConfig('whatsappWebRateLimitState', JSON.stringify(stateToSave));
    } catch (error) {
      console.error('[WhatsAppWebRateLimiter] Failed to save state:', error);
    }
  }
}

// Singleton instance
let rateLimiterInstance: WhatsAppWebRateLimiterClass | null = null;

export const WhatsAppWebRateLimiter = {
  /**
   * Get or create rate limiter instance
   */
  getInstance: (config?: Partial<RateLimitConfig>): WhatsAppWebRateLimiterClass => {
    if (!rateLimiterInstance) {
      rateLimiterInstance = new WhatsAppWebRateLimiterClass(config);
    }
    return rateLimiterInstance;
  },

  /**
   * Reset instance (for testing)
   */
  resetInstance: (): void => {
    rateLimiterInstance = null;
  },
};

export type { RateLimitConfig, RateLimitState };

