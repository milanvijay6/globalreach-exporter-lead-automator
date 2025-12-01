import { PlatformService } from './platformService';
import { Logger } from './loggerService';

export interface IntegrationAnalytics {
  messagesSent: number;
  deliveryRate: number;
  replyRate: number;
  dailyUsage: {
    used: number;
    total: number;
  };
}

export interface ChannelAnalytics {
  [service: string]: IntegrationAnalytics;
}

const ANALYTICS_PREFIX = 'analytics_';
const DAILY_LIMIT_PREFIX = 'daily_limit_';
const DAILY_USAGE_PREFIX = 'daily_usage_';

export const IntegrationAnalyticsService = {
  /**
   * Get analytics for a specific service
   */
  getAnalytics: async (service: 'outlook' | 'whatsapp' | 'wechat'): Promise<IntegrationAnalytics> => {
    try {
      const [messagesSent, deliveryRate, replyRate, dailyUsage] = await Promise.all([
        PlatformService.getAppConfig(`${ANALYTICS_PREFIX}${service}_sent`, 0),
        PlatformService.getAppConfig(`${ANALYTICS_PREFIX}${service}_delivery_rate`, 100),
        PlatformService.getAppConfig(`${ANALYTICS_PREFIX}${service}_reply_rate`, 0),
        IntegrationAnalyticsService.getDailyUsage(service),
      ]);

      return {
        messagesSent,
        deliveryRate,
        replyRate,
        dailyUsage,
      };
    } catch (error) {
      Logger.error(`[IntegrationAnalytics] Failed to get analytics for ${service}:`, error);
      return {
        messagesSent: 0,
        deliveryRate: 100,
        replyRate: 0,
        dailyUsage: { used: 0, total: 50 },
      };
    }
  },

  /**
   * Get daily usage for a service
   */
  getDailyUsage: async (service: 'outlook' | 'whatsapp' | 'wechat'): Promise<{ used: number; total: number }> => {
    try {
      const total = await PlatformService.getAppConfig(`${DAILY_LIMIT_PREFIX}${service}`, 50);
      const usageKey = `${DAILY_USAGE_PREFIX}${service}_${new Date().toISOString().split('T')[0]}`;
      const used = await PlatformService.getAppConfig(usageKey, 0);

      return { used, total };
    } catch (error) {
      Logger.error(`[IntegrationAnalytics] Failed to get daily usage for ${service}:`, error);
      return { used: 0, total: 50 };
    }
  },

  /**
   * Record a message sent
   */
  recordMessageSent: async (service: 'outlook' | 'whatsapp' | 'wechat'): Promise<void> => {
    try {
      const current = await PlatformService.getAppConfig(`${ANALYTICS_PREFIX}${service}_sent`, 0);
      await PlatformService.setAppConfig(`${ANALYTICS_PREFIX}${service}_sent`, current + 1);

      // Update daily usage
      const usageKey = `${DAILY_USAGE_PREFIX}${service}_${new Date().toISOString().split('T')[0]}`;
      const dailyUsed = await PlatformService.getAppConfig(usageKey, 0);
      await PlatformService.setAppConfig(usageKey, dailyUsed + 1);
    } catch (error) {
      Logger.error(`[IntegrationAnalytics] Failed to record message sent for ${service}:`, error);
    }
  },

  /**
   * Record a delivery
   */
  recordDelivery: async (service: 'outlook' | 'whatsapp' | 'wechat'): Promise<void> => {
    try {
      const sent = await PlatformService.getAppConfig(`${ANALYTICS_PREFIX}${service}_sent`, 0);
      const delivered = await PlatformService.getAppConfig(`${ANALYTICS_PREFIX}${service}_delivered`, 0);
      
      await PlatformService.setAppConfig(`${ANALYTICS_PREFIX}${service}_delivered`, delivered + 1);
      
      // Calculate delivery rate
      const deliveryRate = sent > 0 ? Math.round((delivered / sent) * 100) : 100;
      await PlatformService.setAppConfig(`${ANALYTICS_PREFIX}${service}_delivery_rate`, deliveryRate);
    } catch (error) {
      Logger.error(`[IntegrationAnalytics] Failed to record delivery for ${service}:`, error);
    }
  },

  /**
   * Record a reply
   */
  recordReply: async (service: 'outlook' | 'whatsapp' | 'wechat'): Promise<void> => {
    try {
      const sent = await PlatformService.getAppConfig(`${ANALYTICS_PREFIX}${service}_sent`, 0);
      const replied = await PlatformService.getAppConfig(`${ANALYTICS_PREFIX}${service}_replied`, 0);
      
      await PlatformService.setAppConfig(`${ANALYTICS_PREFIX}${service}_replied`, replied + 1);
      
      // Calculate reply rate
      const replyRate = sent > 0 ? Math.round((replied / sent) * 100) : 0;
      await PlatformService.setAppConfig(`${ANALYTICS_PREFIX}${service}_reply_rate`, replyRate);
    } catch (error) {
      Logger.error(`[IntegrationAnalytics] Failed to record reply for ${service}:`, error);
    }
  },

  /**
   * Set daily limit for a service
   */
  setDailyLimit: async (service: 'outlook' | 'whatsapp' | 'wechat', limit: number): Promise<void> => {
    try {
      await PlatformService.setAppConfig(`${DAILY_LIMIT_PREFIX}${service}`, limit);
    } catch (error) {
      Logger.error(`[IntegrationAnalytics] Failed to set daily limit for ${service}:`, error);
    }
  },

  /**
   * Get all services analytics
   */
  getAllAnalytics: async (): Promise<ChannelAnalytics> => {
    try {
      const [outlook, whatsapp, wechat] = await Promise.all([
        IntegrationAnalyticsService.getAnalytics('outlook'),
        IntegrationAnalyticsService.getAnalytics('whatsapp'),
        IntegrationAnalyticsService.getAnalytics('wechat'),
      ]);

      return {
        outlook,
        whatsapp,
        wechat,
      };
    } catch (error) {
      Logger.error('[IntegrationAnalytics] Failed to get all analytics:', error);
      return {
        outlook: { messagesSent: 0, deliveryRate: 100, replyRate: 0, dailyUsage: { used: 0, total: 50 } },
        whatsapp: { messagesSent: 0, deliveryRate: 100, replyRate: 0, dailyUsage: { used: 0, total: 50 } },
        wechat: { messagesSent: 0, deliveryRate: 100, replyRate: 0, dailyUsage: { used: 0, total: 50 } },
      };
    }
  },
};


