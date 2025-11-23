import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Brain,
  Database,
  Shield,
  RefreshCw,
  Download,
  BarChart3,
  MessageSquare,
  Zap,
  Settings,
  FileText,
  Search,
  Filter,
} from 'lucide-react';
import { User, Importer, SystemHealth, AiInteractionMetrics, ConversationHealthMetrics, SystemAlert } from '../types';
import {
  getSystemHealth,
  getAiInteractionMetrics,
  getConversationHealthMetrics,
  getSelfTuningStatus,
  getKnowledgeBaseStats,
  getLeadResearchStats,
  getSystemAlerts,
  getOverviewMetrics,
} from '../services/adminMonitoringService';
import { hasAdminAccess } from '../services/permissionService';
import ApiKeyUsageDashboard from './ApiKeyUsageDashboard';
import AdminActionLog from './AdminActionLog';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface AdminMonitoringDashboardProps {
  user: User;
  importers: Importer[];
  onNavigateToSettings?: () => void;
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];

const AdminMonitoringDashboard: React.FC<AdminMonitoringDashboardProps> = ({
  user,
  importers,
  onNavigateToSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'api-keys' | 'ai-interactions' | 'conversations' | 'self-tuning' | 'knowledge-base' | 'audit'>('overview');
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d'>('7d');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Data state
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [aiMetrics, setAiMetrics] = useState<AiInteractionMetrics | null>(null);
  const [conversationHealth, setConversationHealth] = useState<ConversationHealthMetrics | null>(null);
  const [selfTuningStatus, setSelfTuningStatus] = useState<any>(null);
  const [knowledgeBaseStats, setKnowledgeBaseStats] = useState<any>(null);
  const [leadResearchStats, setLeadResearchStats] = useState<any>(null);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [recentAuditActions, setRecentAuditActions] = useState<number>(0);

  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!hasAdminAccess(user)) return;

    loadDashboardData();

    // Set up auto-refresh every 5 seconds
    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(() => {
        loadDashboardData();
      }, 5000);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [user, importers, timeframe, autoRefresh]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const overview = await getOverviewMetrics(importers);
      setSystemHealth(overview.systemHealth);
      setAiMetrics(overview.aiMetrics);
      setConversationHealth(overview.conversationHealth);
      setAlerts(overview.alerts);
      setRecentAuditActions(overview.recentAuditActions);

      // Load additional data based on active tab
      if (activeTab === 'ai-interactions' || activeTab === 'overview') {
        const aiData = await getAiInteractionMetrics(timeframe);
        setAiMetrics(aiData);
      }

      if (activeTab === 'self-tuning' || activeTab === 'overview') {
        const tuningStatus = await getSelfTuningStatus();
        setSelfTuningStatus(tuningStatus);
      }

      if (activeTab === 'knowledge-base' || activeTab === 'overview') {
        const kbStats = await getKnowledgeBaseStats();
        setKnowledgeBaseStats(kbStats);
      }

      if (activeTab === 'overview') {
        const researchStats = await getLeadResearchStats(importers);
        setLeadResearchStats(researchStats);
      }

      setLastUpdated(Date.now());
    } catch (error) {
      console.error('[AdminMonitoringDashboard] Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleManualRefresh = () => {
    loadDashboardData();
  };

  const exportDashboard = () => {
    const data = {
      timestamp: new Date().toISOString(),
      systemHealth,
      aiMetrics,
      conversationHealth,
      selfTuningStatus,
      knowledgeBaseStats,
      leadResearchStats,
      alerts,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-dashboard-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getHealthColor = (health: 'healthy' | 'warning' | 'critical') => {
    switch (health) {
      case 'healthy':
        return 'text-green-600 bg-green-50';
      case 'warning':
        return 'text-orange-600 bg-orange-50';
      case 'critical':
        return 'text-red-600 bg-red-50';
    }
  };

  const getHealthIcon = (health: 'healthy' | 'warning' | 'critical') => {
    switch (health) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5" />;
      case 'critical':
        return <AlertTriangle className="w-5 h-5" />;
    }
  };

  if (!hasAdminAccess(user)) {
    return (
      <div className="p-8 text-center text-slate-500">
        <Shield className="w-12 h-12 mx-auto mb-4 text-slate-400" />
        <p>You don't have permission to access the admin monitoring dashboard.</p>
      </div>
    );
  }

  if (loading && !systemHealth) {
    return (
      <div className="p-8 text-center text-slate-500">
        <RefreshCw className="w-8 h-8 mx-auto mb-4 animate-spin" />
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Activity className="w-6 h-6" />
            Admin Monitoring Dashboard
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Last updated: {new Date(lastUpdated).toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh (5s)
          </label>
          <button
            onClick={handleManualRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={exportDashboard}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Critical Alerts Banner */}
      {alerts.filter(a => a.severity === 'critical').length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-red-800">Critical Alerts</h3>
          </div>
          <div className="space-y-2">
            {alerts
              .filter(a => a.severity === 'critical')
              .slice(0, 5)
              .map((alert) => (
                <div key={alert.id} className="text-sm text-red-700">
                  • {alert.message}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Overview Cards */}
      {activeTab === 'overview' && systemHealth && (
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-white border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-500">System Health</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${getHealthColor(systemHealth.overall)}`}>
                {systemHealth.overall}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold text-slate-800">{systemHealth.score}</p>
              <span className="text-sm text-slate-500">/100</span>
            </div>
          </div>

          <div className="p-4 bg-white border border-slate-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-indigo-600" />
              <span className="text-sm text-slate-500">AI Calls (24h)</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{aiMetrics?.totalCalls || 0}</p>
            <p className="text-xs text-slate-500 mt-1">
              {aiMetrics ? `${(aiMetrics.successRate * 100).toFixed(1)}% success` : 'N/A'}
            </p>
          </div>

          <div className="p-4 bg-white border border-slate-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-green-600" />
              <span className="text-sm text-slate-500">Active Conversations</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">
              {conversationHealth?.activeConversations || 0}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Health: {conversationHealth?.healthScore || 0}/100
            </p>
          </div>

          <div className="p-4 bg-white border border-slate-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-purple-600" />
              <span className="text-sm text-slate-500">Active API Keys</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">
              {systemHealth.apiKeys.active}
            </p>
            {systemHealth.apiKeys.issues > 0 && (
              <p className="text-xs text-red-600 mt-1">{systemHealth.apiKeys.issues} issues</p>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-1 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'api-keys', label: 'API Keys', icon: Shield },
            { id: 'ai-interactions', label: 'AI Interactions', icon: Brain },
            { id: 'conversations', label: 'Conversations', icon: MessageSquare },
            { id: 'self-tuning', label: 'Self-Tuning', icon: Zap },
            { id: 'knowledge-base', label: 'Knowledge Base', icon: Database },
            { id: 'audit', label: 'Audit Log', icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600 font-medium'
                    : 'border-transparent text-slate-600 hover:text-slate-800 hover:border-slate-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* System Health Status */}
            {systemHealth && (
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  {getHealthIcon(systemHealth.overall)}
                  System Health Status
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">API Keys</p>
                    <p className="text-lg font-semibold text-slate-800">
                      {systemHealth.apiKeys.active} active
                      {systemHealth.apiKeys.issues > 0 && (
                        <span className="text-red-600 ml-2">({systemHealth.apiKeys.issues} issues)</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Conversations</p>
                    <p className="text-lg font-semibold text-slate-800">
                      {systemHealth.conversations.active} active
                      {systemHealth.conversations.issues > 0 && (
                        <span className="text-red-600 ml-2">({systemHealth.conversations.issues} issues)</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">AI Service</p>
                    <p className="text-lg font-semibold text-slate-800">
                      {systemHealth.aiService.status}
                      {systemHealth.aiService.errorRate > 0 && (
                        <span className="text-orange-600 ml-2">
                          ({(systemHealth.aiService.errorRate * 100).toFixed(1)}% errors)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* AI Interaction Metrics */}
            {aiMetrics && (
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  AI Interaction Metrics ({timeframe})
                </h3>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Total Calls</p>
                    <p className="text-2xl font-bold text-slate-800">{aiMetrics.totalCalls}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Success Rate</p>
                    <p className="text-2xl font-bold text-slate-800">
                      {(aiMetrics.successRate * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Avg Response</p>
                    <p className="text-2xl font-bold text-slate-800">
                      {aiMetrics.averageResponseTime.toFixed(0)}ms
                    </p>
                  </div>
                  {aiMetrics.totalCost && (
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Total Cost</p>
                      <p className="text-2xl font-bold text-slate-800">${aiMetrics.totalCost.toFixed(2)}</p>
                    </div>
                  )}
                </div>
                {aiMetrics.callsByHour.length > 0 && (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={aiMetrics.callsByHour}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="count" stroke="#6366f1" fill="#6366f1" fillOpacity={0.6} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}

            {/* Conversation Health */}
            {conversationHealth && (
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Conversation Health
                </h3>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Total</p>
                    <p className="text-2xl font-bold text-slate-800">{conversationHealth.totalConversations}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Active</p>
                    <p className="text-2xl font-bold text-slate-800">{conversationHealth.activeConversations}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Avg Satisfaction</p>
                    <p className="text-2xl font-bold text-slate-800">
                      {conversationHealth.averageSatisfaction.toFixed(0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Health Score</p>
                    <p className="text-2xl font-bold text-slate-800">{conversationHealth.healthScore}</p>
                  </div>
                </div>
                {Object.keys(conversationHealth.sentimentDistribution).length > 0 && (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={Object.entries(conversationHealth.sentimentDistribution).map(([name, value]) => ({ name, value }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" fill="#6366f1" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}

            {/* Self-Tuning Status */}
            {selfTuningStatus && (
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Self-Tuning Status
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Status</p>
                    <p className="text-lg font-semibold text-slate-800">
                      {selfTuningStatus.enabled ? (
                        <span className="text-green-600">Enabled</span>
                      ) : (
                        <span className="text-slate-400">Disabled</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Last Run</p>
                    <p className="text-lg font-semibold text-slate-800">
                      {selfTuningStatus.lastRun
                        ? new Date(selfTuningStatus.lastRun).toLocaleString()
                        : 'Never'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Next Run</p>
                    <p className="text-lg font-semibold text-slate-800">
                      {selfTuningStatus.nextRun
                        ? new Date(selfTuningStatus.nextRun).toLocaleString()
                        : 'Not scheduled'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Interval</p>
                    <p className="text-lg font-semibold text-slate-800">
                      Every {selfTuningStatus.intervalHours}h
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Knowledge Base & Lead Research */}
            <div className="grid grid-cols-2 gap-6">
              {knowledgeBaseStats && (
                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    Knowledge Base
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-slate-500">Total Snippets</p>
                      <p className="text-2xl font-bold text-slate-800">{knowledgeBaseStats.totalSnippets}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Effective Snippets</p>
                      <p className="text-xl font-semibold text-slate-800">{knowledgeBaseStats.effectiveSnippets}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Avg Effectiveness</p>
                      <p className="text-xl font-semibold text-slate-800">
                        {knowledgeBaseStats.averageEffectiveness.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {leadResearchStats && (
                <div className="bg-white border border-slate-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Search className="w-5 h-5" />
                    Lead Research
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-slate-500">Total Researched</p>
                      <p className="text-2xl font-bold text-slate-800">{leadResearchStats.totalResearched}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Completion Rate</p>
                      <p className="text-xl font-semibold text-slate-800">
                        {(leadResearchStats.completionRate * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Avg Quality</p>
                      <p className="text-xl font-semibold text-slate-800">
                        {leadResearchStats.averageQuality.toFixed(0)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Recent Audit Actions */}
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Recent Admin Actions (24h)
              </h3>
              <p className="text-2xl font-bold text-slate-800">{recentAuditActions}</p>
              <button
                onClick={() => setActiveTab('audit')}
                className="mt-2 text-sm text-indigo-600 hover:text-indigo-700"
              >
                View full audit log →
              </button>
            </div>
          </div>
        )}

        {activeTab === 'api-keys' && (
          <div>
            <ApiKeyUsageDashboard user={user} />
          </div>
        )}

        {activeTab === 'ai-interactions' && aiMetrics && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-800">AI Interaction Metrics</h3>
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value as '24h' | '7d' | '30d')}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="24h">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                </select>
              </div>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500 mb-1">Total Calls</p>
                  <p className="text-2xl font-bold text-slate-800">{aiMetrics.totalCalls}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500 mb-1">Success Rate</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {(aiMetrics.successRate * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500 mb-1">Avg Response</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {aiMetrics.averageResponseTime.toFixed(0)}ms
                  </p>
                </div>
                {aiMetrics.totalCost && (
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-500 mb-1">Total Cost</p>
                    <p className="text-2xl font-bold text-slate-800">${aiMetrics.totalCost.toFixed(2)}</p>
                  </div>
                )}
              </div>
              {aiMetrics.callsByHour.length > 0 && (
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={aiMetrics.callsByHour}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="count" stroke="#6366f1" fill="#6366f1" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
              {Object.keys(aiMetrics.errorBreakdown).length > 0 && (
                <div className="mt-6">
                  <h4 className="font-semibold text-slate-800 mb-3">Error Breakdown</h4>
                  <div className="space-y-2">
                    {Object.entries(aiMetrics.errorBreakdown)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 10)
                      .map(([error, count]) => (
                        <div key={error} className="flex justify-between items-center p-2 bg-red-50 rounded">
                          <span className="text-sm text-slate-700">{error}</span>
                          <span className="text-sm font-semibold text-red-600">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'conversations' && conversationHealth && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Conversation Health Metrics</h3>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500 mb-1">Total Conversations</p>
                  <p className="text-2xl font-bold text-slate-800">{conversationHealth.totalConversations}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500 mb-1">Active</p>
                  <p className="text-2xl font-bold text-slate-800">{conversationHealth.activeConversations}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500 mb-1">Avg Satisfaction</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {conversationHealth.averageSatisfaction.toFixed(0)}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500 mb-1">Health Score</p>
                  <p className="text-2xl font-bold text-slate-800">{conversationHealth.healthScore}</p>
                </div>
              </div>
              {Object.keys(conversationHealth.sentimentDistribution).length > 0 && (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={Object.entries(conversationHealth.sentimentDistribution).map(([name, value]) => ({ name, value }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#6366f1" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            {conversationHealth.issues.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Conversation Issues</h3>
                <div className="space-y-2">
                  {conversationHealth.issues.slice(0, 20).map((issue, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg ${
                        issue.severity === 'critical' ? 'bg-red-50 border border-red-200' : 'bg-orange-50 border border-orange-200'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-slate-800">{issue.issue}</p>
                          <p className="text-xs text-slate-500 mt-1">Conversation ID: {issue.conversationId}</p>
                        </div>
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            issue.severity === 'critical'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-orange-100 text-orange-700'
                          }`}
                        >
                          {issue.severity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'self-tuning' && selfTuningStatus && (
          <div className="bg-white border border-slate-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Self-Tuning Configuration</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Status</p>
                  <p className="text-lg font-semibold text-slate-800">
                    {selfTuningStatus.enabled ? (
                      <span className="text-green-600">Enabled</span>
                    ) : (
                      <span className="text-slate-400">Disabled</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Auto-Apply</p>
                  <p className="text-lg font-semibold text-slate-800">
                    {selfTuningStatus.autoApply ? (
                      <span className="text-green-600">Yes</span>
                    ) : (
                      <span className="text-slate-400">No (Manual Approval)</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Interval</p>
                  <p className="text-lg font-semibold text-slate-800">
                    Every {selfTuningStatus.intervalHours} hours
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Min Conversations</p>
                  <p className="text-lg font-semibold text-slate-800">
                    {selfTuningStatus.minConversations} required
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-500 mb-1">Last Run</p>
                  <p className="text-lg font-semibold text-slate-800">
                    {selfTuningStatus.lastRun
                      ? new Date(selfTuningStatus.lastRun).toLocaleString()
                      : 'Never'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 mb-1">Next Run</p>
                  <p className="text-lg font-semibold text-slate-800">
                    {selfTuningStatus.nextRun
                      ? new Date(selfTuningStatus.nextRun).toLocaleString()
                      : 'Not scheduled'}
                  </p>
                </div>
              </div>
            </div>
            {onNavigateToSettings && (
              <button
                onClick={onNavigateToSettings}
                className="mt-6 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Configure Self-Tuning
              </button>
            )}
          </div>
        )}

        {activeTab === 'knowledge-base' && knowledgeBaseStats && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Knowledge Base Statistics</h3>
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500 mb-1">Total Snippets</p>
                  <p className="text-2xl font-bold text-slate-800">{knowledgeBaseStats.totalSnippets}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500 mb-1">Effective Snippets</p>
                  <p className="text-2xl font-bold text-slate-800">{knowledgeBaseStats.effectiveSnippets}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500 mb-1">Avg Effectiveness</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {knowledgeBaseStats.averageEffectiveness.toFixed(1)}%
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-sm text-slate-500 mb-1">Templates</p>
                  <p className="text-2xl font-bold text-slate-800">{knowledgeBaseStats.templateCount}</p>
                </div>
              </div>
            </div>
            {knowledgeBaseStats.topSnippets.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Top Performing Snippets</h3>
                <div className="space-y-2">
                  {knowledgeBaseStats.topSnippets.slice(0, 10).map((snippet, i) => (
                    <div key={snippet.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-slate-500">#{i + 1}</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          snippet.outcome === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {snippet.outcome}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-slate-800">
                        {snippet.effectiveness.toFixed(0)}% effective
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'audit' && (
          <div>
            <AdminActionLog user={user} />
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminMonitoringDashboard;

