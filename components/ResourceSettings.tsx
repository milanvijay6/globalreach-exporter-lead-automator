import React, { useState, useEffect } from 'react';
import { Activity, Cpu, HardDrive, Zap, Settings } from 'lucide-react';
import { ResourceMode, getResourceConfig, saveResourceConfig, getEffectiveConfig, getSystemCapabilities } from '../services/resourceManager';
import { getSystemMetrics, getSystemHealth } from '../services/systemMonitor';
import { Logger } from '../services/loggerService';

interface ResourceSettingsProps {
  onSave?: () => void;
}

const ResourceSettings: React.FC<ResourceSettingsProps> = ({ onSave }) => {
  const [mode, setMode] = useState<ResourceMode>('auto');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [capabilities, setCapabilities] = useState<any>(null);

  useEffect(() => {
    loadSettings();
    loadMetrics();
    
    const interval = setInterval(() => {
      loadMetrics();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const loadSettings = async () => {
    try {
      const config = await getResourceConfig();
      setMode(config.mode);
    } catch (error) {
      Logger.error('[ResourceSettings] Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = async () => {
    try {
      const [metricsData, healthData, capabilitiesData] = await Promise.all([
        getSystemMetrics(),
        getSystemHealth(),
        getSystemCapabilities(),
      ]);
      setMetrics(metricsData);
      setHealth(healthData);
      setCapabilities(capabilitiesData);
    } catch (error) {
      Logger.error('[ResourceSettings] Failed to load metrics:', error);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await saveResourceConfig({ mode });
      if (onSave) onSave();
    } catch (error) {
      Logger.error('[ResourceSettings] Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-4 text-center text-slate-500">Loading...</div>;
  }

  const getModeDescription = (m: ResourceMode) => {
    switch (m) {
      case 'low':
        return 'Minimal resource usage. Best for low-end systems.';
      case 'medium':
        return 'Balanced performance. Recommended for most systems.';
      case 'high':
        return 'Maximum performance. For high-end systems.';
      case 'auto':
        return 'Automatically adjusts based on system capabilities.';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-800 mb-4">Resource Management</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Resource Mode
            </label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as ResourceMode)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            >
              <option value="auto">Auto (Recommended)</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <p className="text-xs text-slate-500 mt-1">{getModeDescription(mode)}</p>
          </div>

          {metrics && (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Cpu className="w-4 h-4 text-slate-600" />
                  <span className="text-sm font-medium text-slate-700">CPU Usage</span>
                </div>
                <div className="text-2xl font-bold text-slate-800">{metrics.cpu.usage.toFixed(1)}%</div>
                <div className="text-xs text-slate-500">{metrics.cpu.cores} cores</div>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <HardDrive className="w-4 h-4 text-slate-600" />
                  <span className="text-sm font-medium text-slate-700">Memory Usage</span>
                </div>
                <div className="text-2xl font-bold text-slate-800">{metrics.memory.usage.toFixed(1)}%</div>
                <div className="text-xs text-slate-500">
                  {Math.round(metrics.memory.used / 1024)}GB / {Math.round(metrics.memory.total / 1024)}GB
                </div>
              </div>
            </div>
          )}

          {health && (
            <div className={`p-4 rounded-lg ${
              health.status === 'healthy' ? 'bg-green-50 border border-green-200' :
              health.status === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
              'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <Activity className={`w-4 h-4 ${
                  health.status === 'healthy' ? 'text-green-600' :
                  health.status === 'warning' ? 'text-yellow-600' :
                  'text-red-600'
                }`} />
                <span className="font-medium">System Health: {health.status.toUpperCase()}</span>
              </div>
              {health.issues.length > 0 && (
                <ul className="text-sm text-slate-700 list-disc list-inside">
                  {health.issues.map((issue: string, i: number) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-400"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResourceSettings;

