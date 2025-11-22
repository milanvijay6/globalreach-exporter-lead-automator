
import { EmailMessage, EmailClassification } from './emailClassificationService';
import { Importer, Channel, LeadStatus } from '../types';

export interface RoutingRule {
  id: string;
  name: string;
  condition: (message: EmailMessage, classification: EmailClassification) => boolean;
  action: 'sales' | 'support' | 'spam' | 'ignore' | 'priority';
  channel?: Channel; // Recommended channel for response
}

export interface RoutingDecision {
  route: 'sales' | 'support' | 'spam' | 'ignore' | 'priority';
  recommendedChannel?: Channel;
  reason: string;
  priority: number; // 1-10, higher = more urgent
}

/**
 * Email Routing Service
 * Intelligently routes emails and recommends response channels
 */
export const EmailRoutingService = {
  /**
   * Default routing rules
   */
  getDefaultRules: (): RoutingRule[] => {
    return [
      {
        id: 'sales-inquiry',
        name: 'Sales Inquiry',
        condition: (msg, cls) => cls.category === 'lead_inquiry' && cls.intent === 'purchase',
        action: 'sales',
        channel: Channel.EMAIL,
      },
      {
        id: 'support-request',
        name: 'Support Request',
        condition: (msg, cls) => cls.category === 'support_request' || cls.intent === 'support',
        action: 'support',
        channel: Channel.EMAIL,
      },
      {
        id: 'spam-detection',
        name: 'Spam Detection',
        condition: (msg, cls) => cls.category === 'spam',
        action: 'spam',
      },
      {
        id: 'high-value-lead',
        name: 'High-Value Lead',
        condition: (msg, cls) => cls.leadScore >= 80 && cls.urgency === 'high',
        action: 'priority',
        channel: Channel.WHATSAPP, // Prefer WhatsApp for high-value
      },
      {
        id: 'complaint',
        name: 'Complaint',
        condition: (msg, cls) => cls.intent === 'complaint' || cls.sentiment.label === 'Critical',
        action: 'support',
        channel: Channel.EMAIL,
      },
    ];
  },

  /**
   * Routes an email based on classification and rules
   */
  routeEmail: (
    message: EmailMessage,
    classification: EmailClassification,
    rules: RoutingRule[] = EmailRoutingService.getDefaultRules()
  ): RoutingDecision => {
    // Find matching rule
    for (const rule of rules) {
      if (rule.condition(message, classification)) {
        return {
          route: rule.action,
          recommendedChannel: rule.channel,
          reason: rule.name,
          priority: EmailRoutingService.calculatePriority(classification),
        };
      }
    }

    // Default routing
    if (classification.category === 'lead_inquiry') {
      return {
        route: 'sales',
        recommendedChannel: Channel.EMAIL,
        reason: 'Lead inquiry (default)',
        priority: EmailRoutingService.calculatePriority(classification),
      };
    }

    return {
      route: 'ignore',
      reason: 'No matching rule',
      priority: 1,
    };
  },

  /**
   * Calculates priority score (1-10)
   */
  calculatePriority: (classification: EmailClassification): number => {
    let priority = 5; // Base priority

    // Urgency boost
    const urgencyBoost: Record<string, number> = {
      critical: 4,
      high: 2,
      medium: 1,
      low: 0,
    };
    priority += urgencyBoost[classification.urgency] || 0;

    // Lead score boost
    if (classification.leadScore >= 80) {
      priority += 2;
    } else if (classification.leadScore >= 60) {
      priority += 1;
    }

    // Sentiment impact
    if (classification.sentiment.label === 'Critical') {
      priority += 2; // Critical issues need attention
    } else if (classification.sentiment.label === 'Positive') {
      priority += 1; // Positive leads are valuable
    }

    // Intent boost
    if (classification.intent === 'purchase') {
      priority += 1;
    }

    return Math.max(1, Math.min(10, priority));
  },

  /**
   * Recommends best channel for response based on historical data
   */
  recommendChannel: (
    importer: Importer,
    classification: EmailClassification,
    routingDecision: RoutingDecision
  ): Channel => {
    // If routing already recommends a channel, use it
    if (routingDecision.recommendedChannel) {
      return routingDecision.recommendedChannel;
    }

    // Check importer preferences
    if (importer.preferredChannel) {
      return importer.preferredChannel;
    }

    // Check validation results
    if (importer.validation.whatsappAvailable) {
      return Channel.WHATSAPP;
    }
    if (importer.validation.wechatAvailable) {
      return Channel.WECHAT;
    }

    // Default to email
    return Channel.EMAIL;
  },

  /**
   * Determines if email should be auto-initiated (high-value leads)
   */
  shouldAutoInitiate: (routingDecision: RoutingDecision, classification: EmailClassification): boolean => {
    return (
      routingDecision.route === 'sales' &&
      routingDecision.priority >= 8 &&
      classification.leadScore >= 70
    );
  },
};

