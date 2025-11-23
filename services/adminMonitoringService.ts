import { 
  SystemHealth, 
  AiInteractionMetrics, 
  ConversationHealthMetrics, 
  SystemAlert,
  Importer,
  ApiKeyProvider 
} from '../types';
import { getUsageStats, loadUsageData } from './apiKeyMonitoringService';
import { getApiKeys } from './apiKeyService';
import { getAuditStatistics } from './auditService';
import { SelfTuningService } from './selfTuningService';
import { KnowledgeBaseService } from './knowledgeBaseService';
import { LeadResearchService } from './leadResearchService';
import { checkRateLimits } from './apiKeyMonitoringService';
import { Logger } from './loggerService';

/**
 * Admin Monitoring Service
 * Aggregates monitoring data from all services for the admin dashboard
 */

/**
 * Gets overall system health status
 */
export const getSystemHealth = async (importers: Importer[]): Promise<SystemHealth> => {
  try {
    // Get API key status
    const apiKeys = await getApiKeys();
    const activeKeys = apiKeys.filter(k => k.metadata.isActive);
    const keyAlerts = await checkRateLimits();
    const keyIssues = keyAlerts.filter(a => a.severity === 'critical').length;

    // Get AI service status
    const aiStats = await getUsageStats(ApiKeyProvider.GEMINI, 24 * 60 * 60 * 1000);
    const aiErrorRate = 1 - aiStats.successRate;

    // Get conversation health
    const activeConversations = importers.filter(i => 
      i.chatHistory && i.chatHistory.length > 0 && 
      (Date.now() - (i.lastContacted || 0)) < 7 * 24 * 60 * 60 * 1000
    ).length;
    
    const healthyConversations = importers.filter(i => 
      (i.satisfactionIndex && i.satisfactionIndex > 60) || 
      (i.sentimentAnalysis && i.sentimentAnalysis.label !== 'Critical' && i.sentimentAnalysis.label !== 'Negative')
    ).length;

    const conversationIssues = importers.filter(i =>
      (i.satisfactionIndex && i.satisfactionIndex < 40) ||
      (i.sentimentAnalysis && i.sentimentAnalysis.label === 'Critical')
    ).length;

    // Calculate overall health score
    let score = 100;
    if (keyIssues > 0) score -= 20;
    if (aiErrorRate > 0.1) score -= 15;
    if (conversationIssues > activeConversations * 0.2) score -= 15;
    if (activeKeys.length === 0) score -= 30;

    const overall = score >= 80 ? 'healthy' : (score >= 50 ? 'warning' : 'critical');

    return {
      overall,
      score: Math.max(0, Math.min(100, score)),
      apiKeys: {
        status: activeKeys.length > 0 ? 'active' : 'no_keys',
        active: activeKeys.length,
        issues: keyIssues,
      },
      conversations: {
        active: activeConversations,
        healthy: healthyConversations,
        issues: conversationIssues,
      },
      aiService: {
        status: aiErrorRate < 0.1 ? 'operational' : 'degraded',
        errorRate: aiErrorRate,
      },
      lastUpdated: Date.now(),
    };
  } catch (error) {
    Logger.error('[AdminMonitoring] Failed to get system health:', error);
    return {
      overall: 'critical',
      score: 0,
      apiKeys: { status: 'unknown', active: 0, issues: 0 },
      conversations: { active: 0, healthy: 0, issues: 0 },
      aiService: { status: 'unknown', errorRate: 1 },
      lastUpdated: Date.now(),
    };
  }
};

/**
 * Gets AI interaction metrics
 */
export const getAiInteractionMetrics = async (
  timeframe: '24h' | '7d' | '30d' = '7d'
): Promise<AiInteractionMetrics> => {
  try {
    const timeframeMs = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    }[timeframe];

    const stats = await getUsageStats(ApiKeyProvider.GEMINI, timeframeMs);
    const usageData = await loadUsageData();

    const now = Date.now();
    const startTime = now - timeframeMs;
    const relevantUsage = usageData.filter(
      u => u.provider === ApiKeyProvider.GEMINI && u.timestamp >= startTime
    );

    // Group by hour
    const callsByHour: Array<{ hour: number; count: number }> = [];
    const hoursInTimeframe = Math.ceil(timeframeMs / (60 * 60 * 1000));
    
    for (let i = 0; i < hoursInTimeframe; i++) {
      const hourStart = startTime + (i * 60 * 60 * 1000);
      const hourEnd = hourStart + (60 * 60 * 1000);
      const hourCount = relevantUsage.filter(
        u => u.timestamp >= hourStart && u.timestamp < hourEnd
      ).length;
      callsByHour.push({ hour: i, count: hourCount });
    }

    // Error breakdown
    const errorBreakdown: Record<string, number> = {};
    relevantUsage.filter(u => !u.success).forEach(u => {
      const errorType = u.errorCode || u.errorMessage?.substring(0, 50) || 'unknown';
      errorBreakdown[errorType] = (errorBreakdown[errorType] || 0) + 1;
    });

    return {
      totalCalls: stats.totalRequests,
      successRate: stats.successRate,
      averageResponseTime: stats.averageResponseTime,
      totalCost: stats.totalCost,
      callsByHour,
      errorBreakdown,
      timeframe,
    };
  } catch (error) {
    Logger.error('[AdminMonitoring] Failed to get AI interaction metrics:', error);
    return {
      totalCalls: 0,
      successRate: 0,
      averageResponseTime: 0,
      callsByHour: [],
      errorBreakdown: {},
      timeframe,
    };
  }
};

/**
 * Gets conversation health metrics
 */
export const getConversationHealthMetrics = async (
  importers: Importer[]
): Promise<ConversationHealthMetrics> => {
  try {
    const activeConversations = importers.filter(i => 
      i.chatHistory && i.chatHistory.length > 0 && 
      (Date.now() - (i.lastContacted || 0)) < 7 * 24 * 60 * 60 * 1000
    );

    const totalConversations = importers.length;
    const activeCount = activeConversations.length;

    // Calculate average satisfaction
    const satisfactions = importers
      .map(i => i.satisfactionIndex)
      .filter(s => s !== undefined) as number[];
    const averageSatisfaction = satisfactions.length > 0
      ? satisfactions.reduce((a, b) => a + b, 0) / satisfactions.length
      : 50;

    // Sentiment distribution
    const sentimentDistribution: Record<string, number> = {
      Positive: 0,
      Neutral: 0,
      Negative: 0,
      Critical: 0,
    };

    importers.forEach(imp => {
      const sentiment = imp.sentimentAnalysis?.label || 'Neutral';
      if (sentimentDistribution[sentiment] !== undefined) {
        sentimentDistribution[sentiment]++;
      }
    });

    // Identify issues
    const issues: Array<{ conversationId: string; issue: string; severity: 'warning' | 'critical' }> = [];
    importers.forEach(imp => {
      if (imp.satisfactionIndex && imp.satisfactionIndex < 40) {
        issues.push({
          conversationId: imp.id,
          issue: `Low satisfaction: ${imp.satisfactionIndex}`,
          severity: 'critical',
        });
      } else if (imp.sentimentAnalysis && imp.sentimentAnalysis.label === 'Critical') {
        issues.push({
          conversationId: imp.id,
          issue: 'Critical sentiment detected',
          severity: 'critical',
        });
      } else if (imp.satisfactionIndex && imp.satisfactionIndex < 60) {
        issues.push({
          conversationId: imp.id,
          issue: `Moderate satisfaction: ${imp.satisfactionIndex}`,
          severity: 'warning',
        });
      }
    });

    // Calculate health score
    let healthScore = 100;
    const issueRatio = issues.length / totalConversations;
    if (issueRatio > 0.3) healthScore -= 30;
    else if (issueRatio > 0.2) healthScore -= 20;
    else if (issueRatio > 0.1) healthScore -= 10;

    if (averageSatisfaction < 40) healthScore -= 20;
    else if (averageSatisfaction < 60) healthScore -= 10;

    return {
      totalConversations,
      activeConversations: activeCount,
      averageSatisfaction,
      sentimentDistribution,
      healthScore: Math.max(0, Math.min(100, healthScore)),
      issues,
    };
  } catch (error) {
    Logger.error('[AdminMonitoring] Failed to get conversation health:', error);
    return {
      totalConversations: 0,
      activeConversations: 0,
      averageSatisfaction: 0,
      sentimentDistribution: {},
      healthScore: 0,
      issues: [],
    };
  }
};

/**
 * Gets self-tuning status
 */
export const getSelfTuningStatus = async (): Promise<{
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
  intervalHours: number;
  autoApply: boolean;
  minConversations: number;
  recentInsights?: any;
}> => {
  try {
    const config = await SelfTuningService.getConfig();
    return {
      enabled: config.enabled,
      lastRun: config.lastRun,
      nextRun: config.nextRun,
      intervalHours: config.intervalHours,
      autoApply: config.autoApply,
      minConversations: config.minConversations,
    };
  } catch (error) {
    Logger.error('[AdminMonitoring] Failed to get self-tuning status:', error);
    return {
      enabled: false,
      intervalHours: 24,
      autoApply: false,
      minConversations: 10,
    };
  }
};

/**
 * Gets knowledge base statistics
 */
export const getKnowledgeBaseStats = async (): Promise<{
  totalSnippets: number;
  effectiveSnippets: number;
  averageEffectiveness: number;
  topSnippets: Array<{ id: string; effectiveness: number; outcome: string }>;
  templateCount: number;
}> => {
  try {
    const effectiveSnippets = await KnowledgeBaseService.getEffectiveSnippets({
      minEffectiveness: 70,
      limit: 100,
    });

    const allSnippets = await KnowledgeBaseService.getEffectiveSnippets({ limit: 1000 });
    const totalSnippets = allSnippets.length;

    const averageEffectiveness = totalSnippets > 0
      ? allSnippets.reduce((sum, s) => sum + s.effectivenessScore, 0) / totalSnippets
      : 0;

    const topSnippets = allSnippets
      .slice(0, 10)
      .map(s => ({
        id: s.id,
        effectiveness: s.effectivenessScore,
        outcome: s.outcome,
      }));

    const templates = await KnowledgeBaseService.getTemplates();

    return {
      totalSnippets,
      effectiveSnippets: effectiveSnippets.length,
      averageEffectiveness,
      topSnippets,
      templateCount: templates ? templates.length : 0,
    };
  } catch (error) {
    Logger.error('[AdminMonitoring] Failed to get knowledge base stats:', error);
    return {
      totalSnippets: 0,
      effectiveSnippets: 0,
      averageEffectiveness: 0,
      topSnippets: [],
      templateCount: 0,
    };
  }
};

/**
 * Gets lead research statistics
 */
export const getLeadResearchStats = async (importers: Importer[]): Promise<{
  totalResearched: number;
  completionRate: number;
  averageQuality: number;
}> => {
  try {
    const leadIds = importers.map(i => i.id);
    const researchInsights = await LeadResearchService.getResearchInsights(leadIds);
    
    if (Object.keys(researchInsights).length === 0) {
      return {
        totalResearched: 0,
        completionRate: 0,
        averageQuality: 0,
      };
    }

    const totalResearched = Object.keys(researchInsights).length;
    const completionRate = importers.length > 0 ? totalResearched / importers.length : 0;

    // Calculate average quality (based on research completeness)
    const qualityScores = Object.values(researchInsights).map(r => {
      let score = 0;
      if (r.industry && r.industry !== 'Unknown') score += 20;
      if (r.painPoints && r.painPoints.length > 0) score += 20;
      if (r.opportunities && r.opportunities.length > 0) score += 20;
      if (r.recommendedApproach) score += 20;
      if (r.personalizationTips && r.personalizationTips.length > 0) score += 20;
      return score;
    });

    const averageQuality = qualityScores.length > 0
      ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
      : 0;

    return {
      totalResearched,
      completionRate,
      averageQuality,
    };
  } catch (error) {
    Logger.error('[AdminMonitoring] Failed to get lead research stats:', error);
    return {
      totalResearched: 0,
      completionRate: 0,
      averageQuality: 0,
    };
  }
};

/**
 * Gets system alerts
 */
export const getSystemAlerts = async (importers: Importer[]): Promise<SystemAlert[]> => {
  try {
    const alerts: SystemAlert[] = [];

    // API key alerts
    const keyAlerts = await checkRateLimits();
    keyAlerts.forEach(alert => {
      alerts.push({
        id: `api-key-${alert.keyId}-${Date.now()}`,
        type: 'api_key',
        severity: alert.severity,
        message: alert.message,
        timestamp: Date.now(),
        actionUrl: '#api-keys',
      });
    });

    // Conversation health alerts
    const healthMetrics = await getConversationHealthMetrics(importers);
    if (healthMetrics.healthScore < 50) {
      alerts.push({
        id: `conversation-health-${Date.now()}`,
        type: 'conversation',
        severity: 'critical',
        message: `Conversation health score is low: ${healthMetrics.healthScore}`,
        timestamp: Date.now(),
      });
    }

    healthMetrics.issues
      .filter(i => i.severity === 'critical')
      .slice(0, 5)
      .forEach(issue => {
        alerts.push({
          id: `conversation-${issue.conversationId}-${Date.now()}`,
          type: 'conversation',
          severity: 'critical',
          message: `Conversation issue: ${issue.issue}`,
          timestamp: Date.now(),
        });
      });

    // AI service alerts
    const aiMetrics = await getAiInteractionMetrics('24h');
    if (aiMetrics.successRate < 0.8) {
      alerts.push({
        id: `ai-service-${Date.now()}`,
        type: 'ai_service',
        severity: aiMetrics.successRate < 0.5 ? 'critical' : 'warning',
        message: `AI service success rate is low: ${(aiMetrics.successRate * 100).toFixed(1)}%`,
        timestamp: Date.now(),
      });
    }

    // System health alerts
    const systemHealth = await getSystemHealth(importers);
    if (systemHealth.overall === 'critical') {
      alerts.push({
        id: `system-health-${Date.now()}`,
        type: 'system',
        severity: 'critical',
        message: `System health is critical. Score: ${systemHealth.score}`,
        timestamp: Date.now(),
      });
    }

    // Sort by severity and timestamp
    alerts.sort((a, b) => {
      if (a.severity === 'critical' && b.severity !== 'critical') return -1;
      if (a.severity !== 'critical' && b.severity === 'critical') return 1;
      return b.timestamp - a.timestamp;
    });

    return alerts.slice(0, 20); // Limit to 20 most important alerts
  } catch (error) {
    Logger.error('[AdminMonitoring] Failed to get system alerts:', error);
    return [];
  }
};

/**
 * Gets overview metrics for dashboard summary
 */
export const getOverviewMetrics = async (importers: Importer[]): Promise<{
  systemHealth: SystemHealth;
  aiMetrics: AiInteractionMetrics;
  conversationHealth: ConversationHealthMetrics;
  alerts: SystemAlert[];
  recentAuditActions: number;
}> => {
  try {
    const [systemHealth, aiMetrics, conversationHealth, alerts, auditStats] = await Promise.all([
      getSystemHealth(importers),
      getAiInteractionMetrics('24h'),
      getConversationHealthMetrics(importers),
      getSystemAlerts(importers),
      getAuditStatistics('24h'),
    ]);

    return {
      systemHealth,
      aiMetrics,
      conversationHealth,
      alerts,
      recentAuditActions: auditStats.totalActions,
    };
  } catch (error) {
    Logger.error('[AdminMonitoring] Failed to get overview metrics:', error);
    throw error;
  }
};

