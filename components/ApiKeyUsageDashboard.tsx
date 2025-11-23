import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Clock, AlertTriangle, Download, Filter } from 'lucide-react';
import { User, ApiKeyProvider, KeyStatistics, UsageStats } from '../types';
import { getUsageStats, getKeyStatistics, checkRateLimits } from '../services/apiKeyMonitoringService';
import { getApiKeys } from '../services/apiKeyService';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ApiKeyUsageDashboardProps {
  user: User;
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

const ApiKeyUsageDashboard: React.FC<ApiKeyUsageDashboardProps> = ({ user }) => {
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d'>('7d');
  const [providerFilter, setProviderFilter] = useState<ApiKeyProvider | 'all'>('all');
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [keyStats, setKeyStats] = useState<KeyStatistics[]>([]);
  const [alerts, setAlerts] = useState<Array<{ keyId: string; message: string; severity: 'warning' | 'critical' }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [timeframe, providerFilter]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      const timeframeMs = {
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
      }[timeframe];

      const stats = await getUsageStats(
        providerFilter === 'all' ? undefined : providerFilter,
        timeframeMs
      );
      setUsageStats(stats);

      // Load stats for all keys
      const keys = await getApiKeys(providerFilter === 'all' ? undefined : providerFilter);
      const statsPromises = keys.map(key => getKeyStatistics(key.id, timeframe));
      const allStats = await Promise.all(statsPromises);
      setKeyStats(allStats);

      // Load alerts
      const rateLimitAlerts = await checkRateLimits();
      setAlerts(rateLimitAlerts);
    } catch (error) {
      console.error('[ApiKeyUsageDashboard] Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportData = () => {
    const data = {
      timeframe,
      providerFilter,
      usageStats,
      keyStats,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-key-usage-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading dashboard data...</div>;
  }

  // Prepare chart data
  const requestVolumeData = keyStats.map(stat => ({
    name: stat.keyId.substring(0, 8),
    requests: stat.totalRequests,
    success: stat.successfulRequests,
    failed: stat.failedRequests,
  }));

  const responseTimeData = keyStats.map(stat => ({
    name: stat.keyId.substring(0, 8),
    avg: stat.averageResponseTime,
  }));

  const errorRateData = keyStats.map(stat => ({
    name: stat.keyId.substring(0, 8),
    rate: (stat.errorRate * 100).toFixed(1),
  }));

  const pieData = keyStats.map(stat => ({
    name: stat.keyId.substring(0, 8),
    value: stat.totalRequests,
  }));

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex justify-between items-center">
        <div className="flex gap-4 items-center">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as '24h' | '7d' | '30d')}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>

          <select
            value={providerFilter}
            onChange={(e) => setProviderFilter(e.target.value as ApiKeyProvider | 'all')}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="all">All Providers</option>
            {Object.values(ApiKeyProvider).map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <button
          onClick={exportData}
          className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700"
        >
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div
              key={i}
              className={`p-3 rounded-lg flex items-center gap-3 ${
                alert.severity === 'critical'
                  ? 'bg-red-50 border border-red-200 text-red-800'
                  : 'bg-orange-50 border border-orange-200 text-orange-800'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
              <div className="flex-1">
                <p className="font-medium">{alert.message}</p>
                <p className="text-xs opacity-75">Key: {alert.keyId.substring(0, 8)}...</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <span className="text-sm text-slate-500">Total Requests</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{usageStats?.totalRequests || 0}</p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <span className="text-sm text-slate-500">Success Rate</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {usageStats ? `${(usageStats.successRate * 100).toFixed(1)}%` : '0%'}
          </p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-slate-500">Avg Response</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {usageStats ? `${usageStats.averageResponseTime.toFixed(0)}ms` : '0ms'}
          </p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <Filter className="w-5 h-5 text-purple-600" />
            <span className="text-sm text-slate-500">Keys Used</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{usageStats?.keysUsed || 0}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <h4 className="font-semibold text-slate-800 mb-4">Request Volume</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={requestVolumeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="success" fill="#10b981" name="Success" />
              <Bar dataKey="failed" fill="#ef4444" name="Failed" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <h4 className="font-semibold text-slate-800 mb-4">Response Time</h4>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={responseTimeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="avg" stroke="#6366f1" name="Avg (ms)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <h4 className="font-semibold text-slate-800 mb-4">Error Rate</h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={errorRateData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="rate" fill="#f59e0b" name="Error Rate (%)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <h4 className="font-semibold text-slate-800 mb-4">Key Usage Distribution</h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyUsageDashboard;
