import { Importer, Message, Channel } from '../types';
import { Logger } from './loggerService';
import { PlatformService } from './platformService';
import { generateLeadResearch } from './geminiService';

const STORAGE_KEY_LEAD_RESEARCH = 'globalreach_lead_research';

export interface LeadResearchData {
  leadId: string;
  timestamp: number;
  researchSummary: string;
  industry: string;
  companySize?: string;
  businessModel?: string;
  painPoints: string[];
  opportunities: string[];
  recommendedApproach: string;
  personalizationTips: string[];
  previousInteractions?: {
    channel: Channel;
    date: number;
    summary: string;
  }[];
  publicProfileData?: {
    website?: string;
    linkedin?: string;
    socialMedia?: string[];
  };
}

/**
 * Lead Research Service
 * Researches leads before contact to enable highly personalized messaging
 */
export const LeadResearchService = {
  /**
   * Researches a lead using available data sources
   */
  researchLead: async (importer: Importer): Promise<LeadResearchData> => {
    try {
      // Check if we have recent research (within 7 days)
      const existing = await LeadResearchService.getResearch(importer.id);
      if (existing && (Date.now() - existing.timestamp < 7 * 24 * 60 * 60 * 1000)) {
        Logger.info(`[LeadResearch] Using cached research for lead ${importer.id}`);
        return existing;
      }

      // Gather available data
      const conversationHistory = importer.chatHistory || [];
      const activityLog = importer.activityLog || [];
      const previousMessages = conversationHistory.map(msg => ({
        channel: msg.channel,
        date: msg.timestamp,
        summary: msg.content.substring(0, 200),
      }));

      // Build research context
      const researchContext = {
        name: importer.name,
        company: importer.companyName,
        country: importer.country,
        productsImported: importer.productsImported,
        quantity: importer.quantity,
        priceRange: importer.priceRange,
        status: importer.status,
        leadScore: importer.leadScore,
        satisfactionIndex: importer.satisfactionIndex,
        conversationSummary: importer.conversationSummary,
        interestShownIn: importer.interestShownIn,
        nextStep: importer.nextStep,
        previousMessages,
        activityLog: activityLog.slice(-10).map(log => ({
          type: log.type,
          description: log.description,
          timestamp: log.timestamp,
        })),
      };

      // Use AI to generate comprehensive research
      const research = await generateLeadResearch(researchContext);

      // Store research
      const researchData: LeadResearchData = {
        leadId: importer.id,
        timestamp: Date.now(),
        researchSummary: research.summary,
        industry: research.industry,
        companySize: research.companySize,
        businessModel: research.businessModel,
        painPoints: research.painPoints || [],
        opportunities: research.opportunities || [],
        recommendedApproach: research.recommendedApproach,
        personalizationTips: research.personalizationTips || [],
        previousInteractions: previousMessages,
      };

      await LeadResearchService.saveResearch(researchData);

      Logger.info(`[LeadResearch] Completed research for lead ${importer.id}`);
      return researchData;
    } catch (error) {
      Logger.error('[LeadResearch] Failed to research lead:', error);
      // Return basic research data
      return {
        leadId: importer.id,
        timestamp: Date.now(),
        researchSummary: `Basic research for ${importer.companyName} in ${importer.country}`,
        industry: 'Unknown',
        painPoints: [],
        opportunities: [],
        recommendedApproach: 'Standard outreach',
        personalizationTips: [],
      };
    }
  },

  /**
   * Gets stored research for a lead
   */
  getResearch: async (leadId: string): Promise<LeadResearchData | null> => {
    try {
      const stored = await PlatformService.secureLoad(STORAGE_KEY_LEAD_RESEARCH);
      if (!stored) return null;

      const allResearch: LeadResearchData[] = JSON.parse(stored);
      return allResearch.find(r => r.leadId === leadId) || null;
    } catch (error) {
      Logger.error('[LeadResearch] Failed to get research:', error);
      return null;
    }
  },

  /**
   * Saves research data
   */
  saveResearch: async (research: LeadResearchData): Promise<void> => {
    try {
      const stored = await PlatformService.secureLoad(STORAGE_KEY_LEAD_RESEARCH);
      let allResearch: LeadResearchData[] = stored ? JSON.parse(stored) : [];

      // Remove old research for this lead
      allResearch = allResearch.filter(r => r.leadId !== research.leadId);
      
      // Add new research
      allResearch.push(research);

      // Keep only last 1000 research records
      if (allResearch.length > 1000) {
        allResearch.sort((a, b) => b.timestamp - a.timestamp);
        allResearch = allResearch.slice(0, 1000);
      }

      await PlatformService.secureSave(STORAGE_KEY_LEAD_RESEARCH, JSON.stringify(allResearch));
    } catch (error) {
      Logger.error('[LeadResearch] Failed to save research:', error);
    }
  },

  /**
   * Gets research insights for multiple leads
   */
  getResearchInsights: async (leadIds: string[]): Promise<Record<string, LeadResearchData>> => {
    try {
      const stored = await PlatformService.secureLoad(STORAGE_KEY_LEAD_RESEARCH);
      if (!stored) return {};

      const allResearch: LeadResearchData[] = JSON.parse(stored);
      const insights: Record<string, LeadResearchData> = {};

      for (const leadId of leadIds) {
        const research = allResearch.find(r => r.leadId === leadId);
        if (research) {
          insights[leadId] = research;
        }
      }

      return insights;
    } catch (error) {
      Logger.error('[LeadResearch] Failed to get research insights:', error);
      return {};
    }
  },
};

