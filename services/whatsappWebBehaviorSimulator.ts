/**
 * WhatsApp Web Behavior Simulator
 * Simulates human-like behavior to avoid automation detection
 */

interface BehaviorConfig {
  typingSpeedWPM: number; // Words per minute (50-200 typical human range)
  minTypingDelayMs: number;
  maxTypingDelayMs: number;
  minPauseBetweenBatchesMs: number;
  maxPauseBetweenBatchesMs: number;
  businessHoursStart: number; // Hour (0-23)
  businessHoursEnd: number; // Hour (0-23)
  weekendReduction: boolean;
  breakAfterMessages: number; // Take break after N messages
  breakDurationMinMs: number;
  breakDurationMaxMs: number;
}

const DEFAULT_CONFIG: BehaviorConfig = {
  typingSpeedWPM: 100, // Average typing speed
  minTypingDelayMs: 2000, // 2 seconds minimum
  maxTypingDelayMs: 5000, // 5 seconds maximum
  minPauseBetweenBatchesMs: 30 * 1000, // 30 seconds
  maxPauseBetweenBatchesMs: 5 * 60 * 1000, // 5 minutes
  businessHoursStart: 9, // 9 AM
  businessHoursEnd: 18, // 6 PM
  weekendReduction: true,
  breakAfterMessages: 10,
  breakDurationMinMs: 60 * 60 * 1000, // 1 hour
  breakDurationMaxMs: 2 * 60 * 60 * 1000, // 2 hours
};

class WhatsAppWebBehaviorSimulatorClass {
  private config: BehaviorConfig;
  private messageCountSinceBreak: number = 0;
  private lastBreakTime: number = 0;
  private lastBatchEndTime: number = 0;

  constructor(config?: Partial<BehaviorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Calculate typing delay based on message length
   */
  calculateTypingDelay(messageLength: number): number {
    // Estimate words (rough: 5 characters per word)
    const estimatedWords = messageLength / 5;
    
    // Calculate time to type at configured WPM
    const typingTimeMs = (estimatedWords / this.config.typingSpeedWPM) * 60 * 1000;
    
    // Add base delay and random jitter
    const baseDelay = Math.max(this.config.minTypingDelayMs, typingTimeMs);
    const jitter = Math.random() * (this.config.maxTypingDelayMs - this.config.minTypingDelayMs);
    
    return Math.min(baseDelay + jitter, this.config.maxTypingDelayMs);
  }

  /**
   * Get delay before sending message (typing simulation)
   */
  async simulateTyping(messageLength: number): Promise<void> {
    const delay = this.calculateTypingDelay(messageLength);
    await this.delay(delay);
  }

  /**
   * Get random pause between message batches
   */
  async simulateBatchPause(): Promise<void> {
    const now = Date.now();
    const timeSinceLastBatch = now - this.lastBatchEndTime;
    
    // If we just had a batch, add pause
    if (this.lastBatchEndTime > 0 && timeSinceLastBatch < this.config.minPauseBetweenBatchesMs) {
      const pauseNeeded = this.config.minPauseBetweenBatchesMs - timeSinceLastBatch;
      const randomPause = Math.random() * (this.config.maxPauseBetweenBatchesMs - this.config.minPauseBetweenBatchesMs);
      const totalPause = pauseNeeded + randomPause;
      
      await this.delay(totalPause);
    }
    
    this.lastBatchEndTime = Date.now();
  }

  /**
   * Check if we need a break and simulate it
   */
  async checkAndSimulateBreak(): Promise<boolean> {
    this.messageCountSinceBreak++;
    
    if (this.messageCountSinceBreak >= this.config.breakAfterMessages) {
      const breakDuration = this.config.breakDurationMinMs + 
        Math.random() * (this.config.breakDurationMaxMs - this.config.breakDurationMinMs);
      
      console.log(`[BehaviorSimulator] Taking human break for ${Math.round(breakDuration / 60000)} minutes after ${this.messageCountSinceBreak} messages`);
      
      await this.delay(breakDuration);
      
      this.messageCountSinceBreak = 0;
      this.lastBreakTime = Date.now();
      
      return true; // Break was taken
    }
    
    return false; // No break needed
  }

  /**
   * Check if current time is within business hours
   */
  isBusinessHours(timestamp?: number): boolean {
    const now = timestamp || Date.now();
    const hour = new Date(now).getHours();
    return hour >= this.config.businessHoursStart && hour < this.config.businessHoursEnd;
  }

  /**
   * Check if current time is weekend
   */
  isWeekend(timestamp?: number): boolean {
    const now = timestamp || Date.now();
    const day = new Date(now).getDay();
    return day === 0 || day === 6; // Sunday or Saturday
  }

  /**
   * Get time until business hours start
   */
  getTimeUntilBusinessHours(timestamp?: number): number {
    const now = timestamp || Date.now();
    const date = new Date(now);
    const hour = date.getHours();
    
    if (hour < this.config.businessHoursStart) {
      // Before business hours, wait until start today
      date.setHours(this.config.businessHoursStart, 0, 0, 0);
      return date.getTime() - now;
    } else if (hour >= this.config.businessHoursEnd) {
      // After business hours, wait until start tomorrow
      date.setDate(date.getDate() + 1);
      date.setHours(this.config.businessHoursStart, 0, 0, 0);
      return date.getTime() - now;
    }
    
    return 0; // Currently in business hours
  }

  /**
   * Generate random mouse movement coordinates (for Puppeteer)
   */
  generateRandomMouseMovement(): { x: number; y: number } {
    // Generate small random movements (human-like)
    const x = Math.floor(Math.random() * 100) - 50; // -50 to 50
    const y = Math.floor(Math.random() * 100) - 50; // -50 to 50
    return { x, y };
  }

  /**
   * Generate random scroll amount (for browser automation)
   */
  generateRandomScroll(): number {
    // Small scroll amounts (human-like)
    return Math.floor(Math.random() * 200) - 100; // -100 to 100 pixels
  }

  /**
   * Simulate human-like pause (exponential distribution)
   */
  async simulateHumanPause(): Promise<void> {
    // Exponential distribution for more natural pauses
    const lambda = 0.001; // Rate parameter
    const pause = -Math.log(Math.random()) / lambda;
    const clampedPause = Math.min(pause, this.config.maxPauseBetweenBatchesMs);
    
    await this.delay(clampedPause);
  }

  /**
   * Reset break counter (call when starting new session)
   */
  resetBreakCounter(): void {
    this.messageCountSinceBreak = 0;
    this.lastBreakTime = Date.now();
  }

  /**
   * Get current break status
   */
  getBreakStatus(): {
    messagesSinceBreak: number;
    messagesUntilBreak: number;
    lastBreakTime: number;
  } {
    return {
      messagesSinceBreak: this.messageCountSinceBreak,
      messagesUntilBreak: Math.max(0, this.config.breakAfterMessages - this.messageCountSinceBreak),
      lastBreakTime: this.lastBreakTime,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let behaviorSimulatorInstance: WhatsAppWebBehaviorSimulatorClass | null = null;

export const WhatsAppWebBehaviorSimulator = {
  /**
   * Get or create behavior simulator instance
   */
  getInstance: (config?: Partial<BehaviorConfig>): WhatsAppWebBehaviorSimulatorClass => {
    if (!behaviorSimulatorInstance) {
      behaviorSimulatorInstance = new WhatsAppWebBehaviorSimulatorClass(config);
    }
    return behaviorSimulatorInstance;
  },

  /**
   * Reset instance (for testing)
   */
  resetInstance: (): void => {
    behaviorSimulatorInstance = null;
  },
};

export type { BehaviorConfig };

