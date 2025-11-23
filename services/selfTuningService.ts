import { Importer, AppTemplates } from '../types';
import { OptimizationService } from './optimizationService';
import { Logger } from './loggerService';
import { PlatformService } from './platformService';
import { KnowledgeBaseService } from './knowledgeBaseService';

const STORAGE_KEY_AUTO_TUNING = 'globalreach_auto_tuning';
const TUNING_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MIN_CONVERSATIONS_FOR_TUNING = 10; // Minimum conversations before tuning

export interface AutoTuningConfig {
  enabled: boolean;
  intervalHours: number;
  minConversations: number;
  autoApply: boolean; // Auto-apply improvements or require approval
  lastRun?: number;
  nextRun?: number;
}

/**
 * Self-Tuning Service
 * Automatically improves AI messaging based on conversation outcomes
 */
export const SelfTuningService = {
  /**
   * Gets auto-tuning configuration
   */
  getConfig: async (): Promise<AutoTuningConfig> => {
    try {
      const stored = await PlatformService.secureLoad(STORAGE_KEY_AUTO_TUNING);
      if (!stored) {
        return {
          enabled: true,
          intervalHours: 24,
          minConversations: MIN_CONVERSATIONS_FOR_TUNING,
          autoApply: false, // Require approval by default
        };
      }
      return JSON.parse(stored);
    } catch (error) {
      Logger.error('[SelfTuning] Failed to get config:', error);
      return {
        enabled: true,
        intervalHours: 24,
        minConversations: MIN_CONVERSATIONS_FOR_TUNING,
        autoApply: false,
      };
    }
  },

  /**
   * Updates auto-tuning configuration
   */
  updateConfig: async (config: Partial<AutoTuningConfig>): Promise<void> => {
    try {
      const current = await SelfTuningService.getConfig();
      const updated: AutoTuningConfig = {
        ...current,
        ...config,
      };

      // Calculate next run time
      if (updated.enabled) {
        updated.nextRun = Date.now() + (updated.intervalHours * 60 * 60 * 1000);
      }

      await PlatformService.secureSave(STORAGE_KEY_AUTO_TUNING, JSON.stringify(updated));
      Logger.info('[SelfTuning] Updated configuration');
    } catch (error) {
      Logger.error('[SelfTuning] Failed to update config:', error);
    }
  },

  /**
   * Runs automated tuning if conditions are met
   */
  runAutoTuning: async (
    importers: Importer[],
    currentTemplates: AppTemplates
  ): Promise<{ ran: boolean; insights?: any; message: string }> => {
    try {
      const config = await SelfTuningService.getConfig();

      if (!config.enabled) {
        return { ran: false, message: 'Auto-tuning is disabled' };
      }

      // Check if it's time to run
      const now = Date.now();
      if (config.nextRun && now < config.nextRun) {
        return { ran: false, message: `Next tuning scheduled for ${new Date(config.nextRun).toLocaleString()}` };
      }

      // Check minimum conversation threshold
      const totalConversations = importers.reduce((sum, imp) => sum + (imp.chatHistory?.length || 0), 0);
      if (totalConversations < config.minConversations) {
        return {
          ran: false,
          message: `Need at least ${config.minConversations} conversations. Current: ${totalConversations}`,
        };
      }

      Logger.info('[SelfTuning] Starting automated tuning...');

      // Run optimization
      const insights = await OptimizationService.generateTemplateImprovements(importers, currentTemplates);

      // Update last run time
      await SelfTuningService.updateConfig({
        lastRun: now,
        nextRun: now + (config.intervalHours * 60 * 60 * 1000),
      });

      // Auto-apply if enabled
      if (config.autoApply && insights.suggestedIntro && insights.suggestedSystemInstruction) {
        Logger.info('[SelfTuning] Auto-applying improvements');
        // Note: Templates would be updated in the main app state
        // This is a placeholder - actual implementation would update App.tsx templates
      }

      Logger.info('[SelfTuning] Completed automated tuning');
      return {
        ran: true,
        insights,
        message: 'Auto-tuning completed successfully. Review suggested improvements.',
      };
    } catch (error) {
      Logger.error('[SelfTuning] Failed to run auto-tuning:', error);
      return { ran: false, message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  },

  /**
   * Extracts and learns from a completed conversation
   */
  learnFromConversation: async (importer: Importer, messages: any[]): Promise<void> => {
    try {
      // Extract effective snippets to knowledge base
      await KnowledgeBaseService.extractEffectiveSnippets(importer, messages);

      // Update template knowledge if templates were used
      // This would track which templates led to successful outcomes
      Logger.debug(`[SelfTuning] Learned from conversation with ${importer.name}`);
    } catch (error) {
      Logger.error('[SelfTuning] Failed to learn from conversation:', error);
    }
  },

  /**
   * Checks if tuning should run and triggers it if needed
   */
  checkAndRun: async (
    importers: Importer[],
    currentTemplates: AppTemplates
  ): Promise<void> => {
    try {
      const result = await SelfTuningService.runAutoTuning(importers, currentTemplates);
      if (result.ran) {
        Logger.info('[SelfTuning] Auto-tuning completed:', result.message);
      }
    } catch (error) {
      Logger.error('[SelfTuning] Failed to check and run:', error);
    }
  },
};

