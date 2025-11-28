/**
 * WhatsApp Web Ban Monitor
 * Monitors for ban risks and warning signs
 */

interface BanRiskFactors {
  messageVolume: number; // 0-100 (percentage of daily limit used)
  messageSpeed: number; // 0-100 (speed vs recommended)
  contentUniqueness: number; // 0-100 (average uniqueness score)
  timingPatterns: number; // 0-100 (how human-like the timing is)
  recentWarnings: number; // 0-100 (based on number of warnings)
}

interface BanWarning {
  id: string;
  type: 'rate_limit' | 'spam_detection' | 'suspicious_activity' | 'account_warning' | 'connection_issue';
  message: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
}

interface RiskScore {
  overall: number; // 0-100
  factors: BanRiskFactors;
  level: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

class WhatsAppWebBanMonitorClass {
  private warnings: BanWarning[] = [];
  private readonly MAX_WARNINGS = 100;
  private isPaused: boolean = false;
  private pauseUntil?: number;
  private lastRiskCalculation: number = 0;
  private riskCalculationCache?: RiskScore;

  /**
   * Calculate ban risk score
   */
  calculateRiskScore(usage: {
    dailyCount: number;
    dailyLimit: number;
    hourlyCount: number;
    hourlyLimit: number;
    averageUniquenessScore?: number;
    lastMessageTime?: number;
  }): RiskScore {
    const now = Date.now();
    
    // Use cache if calculated recently (within 1 minute)
    if (this.riskCalculationCache && now - this.lastRiskCalculation < 60000) {
      return this.riskCalculationCache;
    }

    const factors: BanRiskFactors = {
      messageVolume: this.calculateVolumeRisk(usage.dailyCount, usage.dailyLimit),
      messageSpeed: this.calculateSpeedRisk(usage.hourlyCount, usage.hourlyLimit),
      contentUniqueness: usage.averageUniquenessScore || 100,
      timingPatterns: this.calculateTimingRisk(usage.lastMessageTime),
      recentWarnings: this.calculateWarningRisk(),
    };

    // Weighted average
    const overall = Math.round(
      factors.messageVolume * 0.3 +
      factors.messageSpeed * 0.25 +
      (100 - factors.contentUniqueness) * 0.2 +
      factors.timingPatterns * 0.15 +
      factors.recentWarnings * 0.1
    );

    const level = this.getRiskLevel(overall);
    const recommendations = this.generateRecommendations(factors, overall);

    const riskScore: RiskScore = {
      overall,
      factors,
      level,
      recommendations,
    };

    this.riskCalculationCache = riskScore;
    this.lastRiskCalculation = now;

    return riskScore;
  }

  /**
   * Record a warning
   */
  recordWarning(
    type: BanWarning['type'],
    message: string,
    severity: BanWarning['severity'] = 'medium'
  ): void {
    const warning: BanWarning = {
      id: `warning-${Date.now()}-${Math.random()}`,
      type,
      message,
      timestamp: Date.now(),
      severity,
      resolved: false,
    };

    this.warnings.push(warning);

    // Keep only recent warnings
    if (this.warnings.length > this.MAX_WARNINGS) {
      this.warnings = this.warnings.slice(-this.MAX_WARNINGS);
    }

    // Auto-pause on critical warnings
    if (severity === 'critical') {
      this.pause(24 * 60 * 60 * 1000); // 24 hours
    } else if (severity === 'high') {
      this.pause(12 * 60 * 60 * 1000); // 12 hours
    }

    // Clear risk cache to force recalculation
    this.riskCalculationCache = undefined;
  }

  /**
   * Check for warning messages in WhatsApp UI (for Puppeteer/DOM scraping)
   */
  async detectWarningInUI(page?: any): Promise<BanWarning | null> {
    if (!page) return null;

    try {
      // Common warning selectors in WhatsApp Web
      const warningSelectors = [
        '[data-testid="warning"]',
        '.warning',
        '[role="alert"]',
        '.error-message',
      ];

      for (const selector of warningSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            const text = await page.evaluate((el: any) => el.textContent, element);
            
            if (text) {
              const warningType = this.classifyWarning(text);
              if (warningType) {
                this.recordWarning(warningType, text, 'high');
                return this.warnings[this.warnings.length - 1];
              }
            }
          }
        } catch (error) {
          // Selector not found, continue
        }
      }
    } catch (error) {
      console.error('[BanMonitor] Failed to detect warning in UI:', error);
    }

    return null;
  }

  /**
   * Get all warnings
   */
  getWarnings(resolved?: boolean): BanWarning[] {
    if (resolved === undefined) {
      return [...this.warnings];
    }
    return this.warnings.filter(w => w.resolved === resolved);
  }

  /**
   * Mark warning as resolved
   */
  resolveWarning(warningId: string): void {
    const warning = this.warnings.find(w => w.id === warningId);
    if (warning) {
      warning.resolved = true;
      this.riskCalculationCache = undefined;
    }
  }

  /**
   * Pause monitoring (emergency stop)
   */
  pause(durationMs?: number): void {
    this.isPaused = true;
    if (durationMs) {
      this.pauseUntil = Date.now() + durationMs;
    }
    this.riskCalculationCache = undefined;
  }

  /**
   * Resume monitoring
   */
  resume(): void {
    this.isPaused = false;
    delete this.pauseUntil;
    this.riskCalculationCache = undefined;
  }

  /**
   * Check if monitoring is paused
   */
  isMonitoringPaused(): boolean {
    if (!this.isPaused) return false;
    
    if (this.pauseUntil && Date.now() >= this.pauseUntil) {
      this.resume();
      return false;
    }
    
    return true;
  }

  /**
   * Get current pause status
   */
  getPauseStatus(): { isPaused: boolean; pauseUntil?: number; timeRemaining?: number } {
    if (!this.isPaused) {
      return { isPaused: false };
    }

    const timeRemaining = this.pauseUntil ? Math.max(0, this.pauseUntil - Date.now()) : undefined;

    return {
      isPaused: true,
      pauseUntil: this.pauseUntil,
      timeRemaining,
    };
  }

  private calculateVolumeRisk(dailyCount: number, dailyLimit: number): number {
    if (dailyLimit === 0) return 0;
    const percentage = (dailyCount / dailyLimit) * 100;
    
    // Risk increases exponentially as we approach limit
    if (percentage >= 90) return 100;
    if (percentage >= 75) return 80;
    if (percentage >= 50) return 50;
    if (percentage >= 25) return 25;
    return 10;
  }

  private calculateSpeedRisk(hourlyCount: number, hourlyLimit: number): number {
    if (hourlyLimit === 0) return 0;
    const percentage = (hourlyCount / hourlyLimit) * 100;
    
    // High speed = high risk
    if (percentage >= 80) return 90;
    if (percentage >= 60) return 70;
    if (percentage >= 40) return 50;
    if (percentage >= 20) return 30;
    return 10;
  }

  private calculateTimingRisk(lastMessageTime?: number): number {
    if (!lastMessageTime) return 0;
    
    const now = Date.now();
    const timeSinceLastMessage = now - lastMessageTime;
    
    // Very fast messages = high risk
    if (timeSinceLastMessage < 10 * 1000) return 90; // Less than 10 seconds
    if (timeSinceLastMessage < 30 * 1000) return 70; // Less than 30 seconds
    if (timeSinceLastMessage < 60 * 1000) return 50; // Less than 1 minute
    if (timeSinceLastMessage < 5 * 60 * 1000) return 30; // Less than 5 minutes
    
    return 10; // Normal timing
  }

  private calculateWarningRisk(): number {
    const recentWarnings = this.warnings.filter(
      w => !w.resolved && Date.now() - w.timestamp < 24 * 60 * 60 * 1000
    );

    if (recentWarnings.length === 0) return 0;
    
    // Weight by severity
    let risk = 0;
    for (const warning of recentWarnings) {
      switch (warning.severity) {
        case 'critical':
          risk += 30;
          break;
        case 'high':
          risk += 20;
          break;
        case 'medium':
          risk += 10;
          break;
        case 'low':
          risk += 5;
          break;
      }
    }

    return Math.min(100, risk);
  }

  private getRiskLevel(score: number): RiskScore['level'] {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  private generateRecommendations(factors: BanRiskFactors, overall: number): string[] {
    const recommendations: string[] = [];

    if (factors.messageVolume > 70) {
      recommendations.push('Reduce daily message volume to stay within safe limits');
    }

    if (factors.messageSpeed > 70) {
      recommendations.push('Slow down message sending rate');
    }

    if (factors.contentUniqueness < 70) {
      recommendations.push('Improve message content uniqueness and personalization');
    }

    if (factors.timingPatterns > 70) {
      recommendations.push('Add more delays between messages to appear more human-like');
    }

    if (factors.recentWarnings > 50) {
      recommendations.push('Address recent warnings and consider pausing automation');
    }

    if (overall >= 70) {
      recommendations.push('Consider pausing automation temporarily to reduce ban risk');
    }

    if (recommendations.length === 0) {
      recommendations.push('Current usage patterns appear safe');
    }

    return recommendations;
  }

  private classifyWarning(text: string): BanWarning['type'] | null {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('rate limit') || lowerText.includes('too many')) {
      return 'rate_limit';
    }

    if (lowerText.includes('spam') || lowerText.includes('abuse')) {
      return 'spam_detection';
    }

    if (lowerText.includes('suspicious') || lowerText.includes('unusual activity')) {
      return 'suspicious_activity';
    }

    if (lowerText.includes('warning') || lowerText.includes('account')) {
      return 'account_warning';
    }

    if (lowerText.includes('connection') || lowerText.includes('disconnect')) {
      return 'connection_issue';
    }

    return null;
  }
}

// Singleton instance
let banMonitorInstance: WhatsAppWebBanMonitorClass | null = null;

export const WhatsAppWebBanMonitor = {
  /**
   * Get or create ban monitor instance
   */
  getInstance: (): WhatsAppWebBanMonitorClass => {
    if (!banMonitorInstance) {
      banMonitorInstance = new WhatsAppWebBanMonitorClass();
    }
    return banMonitorInstance;
  },

  /**
   * Reset instance (for testing)
   */
  resetInstance: (): void => {
    banMonitorInstance = null;
  },
};

export type { BanWarning, RiskScore, BanRiskFactors };

