import React, { useState, useEffect } from 'react';
import { Activity, Server, Clock, AlertCircle, CheckCircle } from 'lucide-react';
import { getSystemMetrics, getSystemHealth, getMetricsHistory } from '../services/systemMonitor';
import { getNetworkInterfaces, getAccessibleURLs } from '../services/networkService';
import { Logger } from '../services/loggerService';

interface SystemStatusProps {
  serverPort?: number;
  httpsPort?: number;
}

const SystemStatus: React.FC<SystemStatusProps> = ({ serverPort = 4000, httpsPort }) => {
  const [metrics, setMetrics] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [uptime, setUptime] = useState(0);
  const [urls, setUrls] = useState<string[]>([]);
  const [interfaces, setInterfaces] = useState<any[]>([]);

  useEffect(() => {
    loadStatus();
    
    const interval = setInterval(() => {
      loadStatus();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [serverPort, httpsPort]);

  const loadStatus = async () => {
    try {
      const [metricsData, healthData, urlsData, interfacesData] = await Promise.all([
        getSystemMetrics(),
        getSystemHealth(),
        getAccessibleURLs(serverPort, httpsPort),
        getNetworkInterfaces(),
      ]);
      
      setMetrics(metricsData);
      setHealth(healthData);
      setUrls(urlsData);
      setInterfaces(interfacesData);
      setUptime(metricsData.uptime);
    } catch (error) {
      Logger.error('[SystemStatus] Failed to load status:', error);
    }
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
          {/* Health Status */}
          {health && (
            <div className={`p-3 rounded-lg border ${
              health.status === 'healthy' ? 'bg-green-50 border-green-200' :
              health.status === 'warning' ? 'bg-yellow-50 border-yellow-200' :
              'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                {health.status === 'healthy' ? (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                )}
                <span className="text-sm font-semibold">Status: {health.status.toUpperCase()}</span>
              </div>
              {health.issues.length > 0 && (
                <ul className="text-xs text-slate-700 list-disc list-inside mt-1">
                  {health.issues.map((issue: string, i: number) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Uptime */}
          <div className="p-3 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-slate-600" />
              <span className="text-sm font-medium text-slate-700">Uptime</span>
            </div>
            <div className="text-xl font-bold text-slate-800">{formatUptime(uptime)}</div>
          </div>

          {/* Resource Usage */}
          {metrics && (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="text-xs font-medium text-slate-700 mb-1">CPU</div>
                <div className="text-lg font-bold text-slate-800">{metrics.cpu.usage.toFixed(1)}%</div>
                <div className="text-xs text-slate-500">{metrics.cpu.cores} cores</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg">
                <div className="text-xs font-medium text-slate-700 mb-1">Memory</div>
                <div className="text-lg font-bold text-slate-800">{metrics.memory.usage.toFixed(1)}%</div>
                <div className="text-xs text-slate-500">
                  {Math.round(metrics.memory.used / 1024)}GB / {Math.round(metrics.memory.total / 1024)}GB
                </div>
              </div>
            </div>
          )}

          {/* Accessible URLs */}
          {urls.length > 0 && (
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-xs font-medium text-slate-700 mb-2">Accessible URLs</div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {urls.map((url, i) => (
                  <div key={i} className="text-xs text-slate-600 font-mono break-all">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                      {url}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Network Interfaces */}
          {interfaces.length > 0 && (
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="text-xs font-medium text-slate-700 mb-2">Network Interfaces</div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {interfaces.filter(i => i.family === 'IPv4' && !i.internal).map((iface, i) => (
                  <div key={i} className="text-xs text-slate-600">
                    <span className="font-medium">{iface.name}:</span> {iface.address}
                  </div>
                ))}
              </div>
            </div>
          )}
    </div>
  );
};

export default SystemStatus;

