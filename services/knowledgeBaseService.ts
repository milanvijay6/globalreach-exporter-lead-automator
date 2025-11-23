import { Message, Importer, LeadStatus } from '../types';
import { PlatformService } from './platformService';
import { Logger } from './loggerService';

const STORAGE_KEY_KNOWLEDGE_BASE = 'globalreach_knowledge_base';

export interface ConversationSnippet {
  id: string;
  timestamp: number;
  leadId: string;
  leadName: string;
  leadStatus: LeadStatus;
  satisfactionIndex?: number;
  channel: string;
  messages: {
    sender: string;
    content: string;
    timestamp: number;
  }[];
  outcome: 'success' | 'failure' | 'neutral';
  tags: string[];
  effectivenessScore: number; // 0-100
  conversionResult?: 'converted' | 'lost' | 'ongoing';
  extractedInsights?: string[];
}

export interface TemplateKnowledge {
  id: string;
  templateType: 'intro' | 'reply' | 'followup';
  templateContent: string;
  usageCount: number;
  successRate: number;
  averageSatisfaction: number;
  lastUpdated: number;
  tags: string[];
  sourceSnippets: string[]; // IDs of snippets that contributed
}

/**
 * Knowledge Base Service
 * Stores and retrieves effective conversation snippets and templates for continuous learning
 */
export const KnowledgeBaseService = {
  /**
   * Saves a conversation snippet to the knowledge base
   */
  saveSnippet: async (snippet: ConversationSnippet): Promise<void> => {
    try {
      const stored = await PlatformService.secureLoad(STORAGE_KEY_KNOWLEDGE_BASE);
      let knowledgeBase: {
        snippets: ConversationSnippet[];
        templates: TemplateKnowledge[];
      } = stored ? JSON.parse(stored) : { snippets: [], templates: [] };

      // Remove old snippet if exists
      knowledgeBase.snippets = knowledgeBase.snippets.filter(s => s.id !== snippet.id);
      
      // Add new snippet
      knowledgeBase.snippets.push(snippet);

      // Keep only top 5000 snippets (sorted by effectiveness)
      if (knowledgeBase.snippets.length > 5000) {
        knowledgeBase.snippets.sort((a, b) => b.effectivenessScore - a.effectivenessScore);
        knowledgeBase.snippets = knowledgeBase.snippets.slice(0, 5000);
      }

      await PlatformService.secureSave(STORAGE_KEY_KNOWLEDGE_BASE, JSON.stringify(knowledgeBase));
      Logger.info(`[KnowledgeBase] Saved snippet ${snippet.id}`);
    } catch (error) {
      Logger.error('[KnowledgeBase] Failed to save snippet:', error);
    }
  },

  /**
   * Extracts and saves effective snippets from a completed conversation
   */
  extractEffectiveSnippets: async (importer: Importer, messages: Message[]): Promise<void> => {
    try {
      // Only extract from successful or high-satisfaction conversations
      const isSuccessful = 
        importer.status === LeadStatus.INTERESTED ||
        importer.status === LeadStatus.NEGOTIATION ||
        importer.status === LeadStatus.SAMPLE_SENT ||
        (importer.satisfactionIndex && importer.satisfactionIndex > 70);

      const isFailure = 
        importer.satisfactionIndex && importer.satisfactionIndex < 40 ||
        importer.sentimentAnalysis?.label === 'Critical';

      if (!isSuccessful && !isFailure) {
        return; // Skip neutral conversations
      }

      // Calculate effectiveness score
      let effectivenessScore = 50; // Base score
      if (isSuccessful) {
        effectivenessScore = 70 + (importer.satisfactionIndex || 0) * 0.3;
        if (importer.status === LeadStatus.SAMPLE_SENT) effectivenessScore += 10;
      } else if (isFailure) {
        effectivenessScore = 30 - (importer.satisfactionIndex || 0) * 0.3;
      }

      // Extract key message pairs (agent message + importer response)
      const snippets: ConversationSnippet[] = [];
      for (let i = 0; i < messages.length - 1; i++) {
        const agentMsg = messages[i];
        const importerMsg = messages[i + 1];

        if (agentMsg.sender === 'agent' && importerMsg.sender === 'importer') {
          const snippet: ConversationSnippet = {
            id: `snippet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: agentMsg.timestamp,
            leadId: importer.id,
            leadName: importer.name,
            leadStatus: importer.status,
            satisfactionIndex: importer.satisfactionIndex,
            channel: agentMsg.channel,
            messages: [
              {
                sender: agentMsg.sender,
                content: agentMsg.content,
                timestamp: agentMsg.timestamp,
              },
              {
                sender: importerMsg.sender,
                content: importerMsg.content,
                timestamp: importerMsg.timestamp,
              },
            ],
            outcome: isSuccessful ? 'success' : 'failure',
            tags: [
              importer.country,
              importer.productsImported?.substring(0, 20) || 'general',
              agentMsg.channel,
            ],
            effectivenessScore,
            conversionResult: isSuccessful ? 'converted' : (isFailure ? 'lost' : 'ongoing'),
          };

          snippets.push(snippet);
        }
      }

      // Save all snippets
      for (const snippet of snippets) {
        await KnowledgeBaseService.saveSnippet(snippet);
      }

      Logger.info(`[KnowledgeBase] Extracted ${snippets.length} snippets from lead ${importer.id}`);
    } catch (error) {
      Logger.error('[KnowledgeBase] Failed to extract snippets:', error);
    }
  },

  /**
   * Gets effective snippets for a given context
   */
  getEffectiveSnippets: async (filters: {
    tags?: string[];
    outcome?: 'success' | 'failure';
    channel?: string;
    minEffectiveness?: number;
    limit?: number;
  }): Promise<ConversationSnippet[]> => {
    try {
      const stored = await PlatformService.secureLoad(STORAGE_KEY_KNOWLEDGE_BASE);
      if (!stored) return [];

      const knowledgeBase: {
        snippets: ConversationSnippet[];
        templates: TemplateKnowledge[];
      } = JSON.parse(stored);

      let snippets = knowledgeBase.snippets;

      // Apply filters
      if (filters.tags && filters.tags.length > 0) {
        snippets = snippets.filter(s =>
          filters.tags!.some(tag => s.tags.some(t => t.toLowerCase().includes(tag.toLowerCase())))
        );
      }

      if (filters.outcome) {
        snippets = snippets.filter(s => s.outcome === filters.outcome);
      }

      if (filters.channel) {
        snippets = snippets.filter(s => s.channel === filters.channel);
      }

      if (filters.minEffectiveness) {
        snippets = snippets.filter(s => s.effectivenessScore >= filters.minEffectiveness!);
      }

      // Sort by effectiveness
      snippets.sort((a, b) => b.effectivenessScore - a.effectivenessScore);

      // Limit results
      const limit = filters.limit || 10;
      return snippets.slice(0, limit);
    } catch (error) {
      Logger.error('[KnowledgeBase] Failed to get snippets:', error);
      return [];
    }
  },

  /**
   * Gets templates from knowledge base
   */
  getTemplates: async (templateType?: 'intro' | 'reply' | 'followup'): Promise<TemplateKnowledge[]> => {
    try {
      const stored = await PlatformService.secureLoad(STORAGE_KEY_KNOWLEDGE_BASE);
      if (!stored) return [];

      const knowledgeBase: {
        snippets: ConversationSnippet[];
        templates: TemplateKnowledge[];
      } = JSON.parse(stored);

      let templates = knowledgeBase.templates;

      if (templateType) {
        templates = templates.filter(t => t.templateType === templateType);
      }

      // Sort by success rate and usage
      templates.sort((a, b) => {
        const scoreA = a.successRate * 0.7 + (a.usageCount / 100) * 0.3;
        const scoreB = b.successRate * 0.7 + (b.usageCount / 100) * 0.3;
        return scoreB - scoreA;
      });

      return templates;
    } catch (error) {
      Logger.error('[KnowledgeBase] Failed to get templates:', error);
      return [];
    }
  },

  /**
   * Updates template knowledge based on usage and outcomes
   */
  updateTemplateKnowledge: async (
    templateId: string,
    success: boolean,
    satisfaction?: number
  ): Promise<void> => {
    try {
      const stored = await PlatformService.secureLoad(STORAGE_KEY_KNOWLEDGE_BASE);
      if (!stored) return;

      const knowledgeBase: {
        snippets: ConversationSnippet[];
        templates: TemplateKnowledge[];
      } = JSON.parse(stored);

      const template = knowledgeBase.templates.find(t => t.id === templateId);
      if (!template) return;

      // Update statistics
      template.usageCount += 1;
      const totalSuccesses = template.successRate * (template.usageCount - 1) + (success ? 1 : 0);
      template.successRate = totalSuccesses / template.usageCount;

      if (satisfaction !== undefined) {
        const totalSatisfaction = template.averageSatisfaction * (template.usageCount - 1) + satisfaction;
        template.averageSatisfaction = totalSatisfaction / template.usageCount;
      }

      template.lastUpdated = Date.now();

      await PlatformService.secureSave(STORAGE_KEY_KNOWLEDGE_BASE, JSON.stringify(knowledgeBase));
    } catch (error) {
      Logger.error('[KnowledgeBase] Failed to update template knowledge:', error);
    }
  },
};

