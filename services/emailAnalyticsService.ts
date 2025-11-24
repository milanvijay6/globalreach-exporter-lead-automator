
import type { EmailMessage } from './emailTypes';
import { PlatformService } from './platformService';

export interface EmailMetrics {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
  unsubscribed: number;
}

export interface EmailAnalytics {
  period: { start: Date; end: Date };
  metrics: EmailMetrics;
  openRate: number;
  clickRate: number;
  replyRate: number;
  bounceRate: number;
  conversionRate: number;
}

export interface EmailLog {
  id: string;
  messageId?: string;
  to: string;
  subject: string;
  action: 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied' | 'bounced' | 'unsubscribed';
  timestamp: number;
  metadata?: Record<string, any>;
}

// In-memory email logs (in production, use database)
const emailLogs: EmailLog[] = [];

/**
 * Email Analytics Service
 * Tracks email metrics and provides analytics
 */
export const EmailAnalyticsService = {
  /**
   * Logs an email action
   */
  logAction: (log: EmailLog): void => {
    emailLogs.push(log);
    
    // Keep only last 10000 logs (in production, use database)
    if (emailLogs.length > 10000) {
      emailLogs.shift();
    }
  },

  /**
   * Gets analytics for a time period
   */
  getAnalytics: (startDate: Date, endDate: Date): EmailAnalytics => {
    const periodLogs = emailLogs.filter(
      log => log.timestamp >= startDate.getTime() && log.timestamp <= endDate.getTime()
    );

    const metrics: EmailMetrics = {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      replied: 0,
      bounced: 0,
      unsubscribed: 0,
    };

    for (const log of periodLogs) {
      switch (log.action) {
        case 'sent':
          metrics.sent++;
          break;
        case 'delivered':
          metrics.delivered++;
          break;
        case 'opened':
          metrics.opened++;
          break;
        case 'clicked':
          metrics.clicked++;
          break;
        case 'replied':
          metrics.replied++;
          break;
        case 'bounced':
          metrics.bounced++;
          break;
        case 'unsubscribed':
          metrics.unsubscribed++;
          break;
      }
    }

    const openRate = metrics.delivered > 0 ? metrics.opened / metrics.delivered : 0;
    const clickRate = metrics.delivered > 0 ? metrics.clicked / metrics.delivered : 0;
    const replyRate = metrics.delivered > 0 ? metrics.replied / metrics.delivered : 0;
    const bounceRate = metrics.sent > 0 ? metrics.bounced / metrics.sent : 0;
    const conversionRate = metrics.delivered > 0 ? metrics.replied / metrics.delivered : 0;

    return {
      period: { start: startDate, end: endDate },
      metrics,
      openRate,
      clickRate,
      replyRate,
      bounceRate,
      conversionRate,
    };
  },

  /**
   * Gets recent email logs
   */
  getRecentLogs: (limit: number = 100): EmailLog[] => {
    return emailLogs
      .slice(-limit)
      .sort((a, b) => b.timestamp - a.timestamp);
  },

  /**
   * Analyzes subject line performance (for A/B testing)
   */
  analyzeSubjectLines: (subjectLines: string[]): {
    bestPerforming: string;
    averageOpenRate: number;
    recommendations: string[];
  } => {
    // Group logs by subject line
    const subjectMetrics = new Map<string, { sent: number; opened: number }>();

    for (const log of emailLogs) {
      if (log.action === 'sent') {
        const current = subjectMetrics.get(log.subject) || { sent: 0, opened: 0 };
        current.sent++;
        subjectMetrics.set(log.subject, current);
      } else if (log.action === 'opened') {
        const current = subjectMetrics.get(log.subject) || { sent: 0, opened: 0 };
        current.opened++;
        subjectMetrics.set(log.subject, current);
      }
    }

    // Find best performing
    let bestSubject = '';
    let bestRate = 0;
    let totalRate = 0;
    let count = 0;

    for (const [subject, metrics] of subjectMetrics.entries()) {
      const rate = metrics.sent > 0 ? metrics.opened / metrics.sent : 0;
      totalRate += rate;
      count++;
      
      if (rate > bestRate) {
        bestRate = rate;
        bestSubject = subject;
      }
    }

    const averageOpenRate = count > 0 ? totalRate / count : 0;

    // Generate recommendations
    const recommendations: string[] = [];
    if (bestSubject) {
      recommendations.push(`Best performing subject: "${bestSubject}" (${(bestRate * 100).toFixed(1)}% open rate)`);
    }
    if (averageOpenRate < 0.2) {
      recommendations.push('Consider personalizing subject lines with recipient names');
    }
    if (averageOpenRate < 0.15) {
      recommendations.push('Try shorter subject lines (under 50 characters)');
    }

    return {
      bestPerforming: bestSubject,
      averageOpenRate,
      recommendations,
    };
  },

  /**
   * Optimizes send timing (analyzes when emails get best response)
   */
  optimizeSendTiming: (): {
    bestHour: number;
    bestDay: number;
    recommendations: string[];
  } => {
    // Analyze reply times by hour/day
    const hourStats = new Map<number, { sent: number; replied: number }>();
    const dayStats = new Map<number, { sent: number; replied: number }>();

    for (const log of emailLogs) {
      if (log.action === 'sent') {
        const date = new Date(log.timestamp);
        const hour = date.getHours();
        const day = date.getDay();

        const hourStat = hourStats.get(hour) || { sent: 0, replied: 0 };
        hourStat.sent++;
        hourStats.set(hour, hourStat);

        const dayStat = dayStats.get(day) || { sent: 0, replied: 0 };
        dayStat.sent++;
        dayStats.set(day, dayStat);
      } else if (log.action === 'replied') {
        const date = new Date(log.timestamp);
        const hour = date.getHours();
        const day = date.getDay();

        const hourStat = hourStats.get(hour) || { sent: 0, replied: 0 };
        hourStat.replied++;
        hourStats.set(hour, hourStat);

        const dayStat = dayStats.get(day) || { sent: 0, replied: 0 };
        dayStat.replied++;
        dayStats.set(day, dayStat);
      }
    }

    // Find best hour
    let bestHour = 9; // Default 9 AM
    let bestHourRate = 0;
    for (const [hour, stats] of hourStats.entries()) {
      const rate = stats.sent > 0 ? stats.replied / stats.sent : 0;
      if (rate > bestHourRate) {
        bestHourRate = rate;
        bestHour = hour;
      }
    }

    // Find best day (0 = Sunday, 1 = Monday, etc.)
    let bestDay = 1; // Default Monday
    let bestDayRate = 0;
    for (const [day, stats] of dayStats.entries()) {
      const rate = stats.sent > 0 ? stats.replied / stats.sent : 0;
      if (rate > bestDayRate) {
        bestDayRate = rate;
        bestDay = day;
      }
    }

    const recommendations: string[] = [];
    recommendations.push(`Best send time: ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][bestDay]} at ${bestHour}:00`);
    if (bestHour < 9 || bestHour > 17) {
      recommendations.push('Consider sending during business hours for better response rates');
    }

    return {
      bestHour,
      bestDay,
      recommendations,
    };
  },

  /**
   * Clears analytics data (for testing)
   */
  clearLogs: (): void => {
    emailLogs.length = 0;
  },
};

