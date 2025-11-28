/**
 * WhatsApp Web Ban Risk Dashboard
 * Displays ban risk monitoring and controls
 */

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Pause, Play, Shield, TrendingUp, Activity } from 'lucide-react';
import { WhatsAppWebBanMonitor } from '../services/whatsappWebBanMonitor';
import { WhatsAppWebRateLimiter } from '../services/whatsappWebRateLimiter';
import type { RiskScore, BanWarning } from '../services/whatsappWebBanMonitor';

interface WhatsAppWebBanRiskDashboardProps {
  onPause?: () => void;
  onResume?: () => void;
}

const WhatsAppWebBanRiskDashboard: React.FC<WhatsAppWebBanRiskDashboardProps> = ({
  onPause,
  onResume,
}) => {
  const [riskScore, setRiskScore] = useState<RiskScore | null>(null);
  const [warnings, setWarnings] = useState<BanWarning[]>([]);
  const [usage, setUsage] = useState<{
    dailyCount: number;
    dailyLimit: number;
    hourlyCount: number;
    hourlyLimit: number;
  } | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const updateDashboard = () => {
      try {
        // Get usage stats
        const rateLimiter = WhatsAppWebRateLimiter.getInstance();
        const usageStats = rateLimiter.getUsage();
        setUsage(usageStats);

        // Get risk score
        const banMonitor = WhatsAppWebBanMonitor.getInstance();
        const risk = banMonitor.calculateRiskScore({
          dailyCount: usageStats.dailyCount,
          dailyLimit: usageStats.dailyLimit,
          hourlyCount: usageStats.hourlyCount,
          hourlyLimit: usageStats.hourlyLimit,
        });
        setRiskScore(risk);

        // Get warnings
        const recentWarnings = banMonitor.getWarnings(false);
        setWarnings(recentWarnings);

        // Check pause status
        const pauseStatus = banMonitor.getPauseStatus();
        setIsPaused(pauseStatus.isPaused);
      } catch (error) {
        console.error('[BanRiskDashboard] Failed to update:', error);
      }
    };

    updateDashboard();
    const interval = setInterval(updateDashboard, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const handlePause = () => {
    try {
      const banMonitor = WhatsAppWebBanMonitor.getInstance();
      banMonitor.pause();
      setIsPaused(true);
      onPause?.();
    } catch (error) {
      console.error('[BanRiskDashboard] Failed to pause:', error);
    }
  };

  const handleResume = () => {
    try {
      const banMonitor = WhatsAppWebBanMonitor.getInstance();
      banMonitor.resume();
      setIsPaused(false);
      onResume?.();
    } catch (error) {
      console.error('[BanRiskDashboard] Failed to resume:', error);
    }
  };

  if (!riskScore || !usage) {
    return (
      <div className="p-4 text-center text-slate-500">
        Loading ban risk data...
      </div>
    );
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'high':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-green-600 bg-green-50 border-green-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* Risk Score Card */}
      <div className={`p-4 rounded-lg border-2 ${getRiskColor(riskScore.level)}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            <span className="font-semibold">Ban Risk Score</span>
          </div>
          <span className="text-2xl font-bold">{riskScore.overall}/100</span>
        </div>
        <div className="mt-2">
          <div className="w-full bg-white/50 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                riskScore.level === 'critical' ? 'bg-red-600' :
                riskScore.level === 'high' ? 'bg-orange-600' :
                riskScore.level === 'medium' ? 'bg-yellow-600' : 'bg-green-600'
              }`}
              style={{ width: `${riskScore.overall}%` }}
            />
          </div>
        </div>
        <p className="text-sm mt-2 opacity-80">
          Level: <strong>{riskScore.level.toUpperCase()}</strong>
        </p>
      </div>

      {/* Usage Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-slate-50 rounded-lg">
          <div className="text-sm text-slate-600 mb-1">Daily Usage</div>
          <div className="text-2xl font-bold text-slate-800">
            {usage.dailyCount} / {usage.dailyLimit}
          </div>
          <div className="mt-2 w-full bg-slate-200 rounded-full h-1.5">
            <div
              className="bg-indigo-600 h-1.5 rounded-full"
              style={{ width: `${Math.min(100, (usage.dailyCount / usage.dailyLimit) * 100)}%` }}
            />
          </div>
        </div>
        <div className="p-4 bg-slate-50 rounded-lg">
          <div className="text-sm text-slate-600 mb-1">Hourly Usage</div>
          <div className="text-2xl font-bold text-slate-800">
            {usage.hourlyCount} / {usage.hourlyLimit}
          </div>
          <div className="mt-2 w-full bg-slate-200 rounded-full h-1.5">
            <div
              className="bg-indigo-600 h-1.5 rounded-full"
              style={{ width: `${Math.min(100, (usage.hourlyCount / usage.hourlyLimit) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Risk Factors */}
      <div className="p-4 bg-slate-50 rounded-lg">
        <h3 className="font-semibold text-slate-800 mb-3">Risk Factors</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Message Volume</span>
            <span className="font-medium">{riskScore.factors.messageVolume}/100</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Message Speed</span>
            <span className="font-medium">{riskScore.factors.messageSpeed}/100</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Content Uniqueness</span>
            <span className="font-medium">{riskScore.factors.contentUniqueness}/100</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Timing Patterns</span>
            <span className="font-medium">{riskScore.factors.timingPatterns}/100</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Recent Warnings</span>
            <span className="font-medium">{riskScore.factors.recentWarnings}/100</span>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {riskScore.recommendations.length > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Recommendations
          </h3>
          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
            {riskScore.recommendations.map((rec, idx) => (
              <li key={idx}>{rec}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Recent Warnings ({warnings.length})
          </h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {warnings.slice(0, 5).map((warning) => (
              <div key={warning.id} className="text-sm text-red-700">
                <div className="font-medium">{warning.type}</div>
                <div className="text-xs opacity-80">{warning.message}</div>
                <div className="text-xs opacity-60">
                  {new Date(warning.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-2">
        {isPaused ? (
          <button
            onClick={handleResume}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            <Play className="w-4 h-4" />
            Resume
          </button>
        ) : (
          <button
            onClick={handlePause}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
          >
            <Pause className="w-4 h-4" />
            Pause Automation
          </button>
        )}
      </div>
    </div>
  );
};

export default WhatsAppWebBanRiskDashboard;

