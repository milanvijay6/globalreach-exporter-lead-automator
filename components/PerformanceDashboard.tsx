import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, Clock, Database, Zap, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { initPerformanceMonitoring, getCurrentMetrics, getWebVitals, getMetricsHistory } from '../services/performanceMonitor';

const PerformanceDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState(getCurrentMetrics());
  const [vitals, setVitals] = useState(getWebVitals());

  useEffect(() => {
    // Initialize performance monitoring
    initPerformanceMonitoring();

    // Update metrics every second
    const interval = setInterval(() => {
      setMetrics(getCurrentMetrics());
      setVitals(getWebVitals());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const getVitalColor = (rating: string) => {
    switch (rating) {
      case 'good': return 'text-green-600 bg-green-50';
      case 'needs-improvement': return 'text-yellow-600 bg-yellow-50';
      case 'poor': return 'text-red-600 bg-red-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Activity className="w-5 h-5" /> Performance Metrics
        </h3>
        <button
          onClick={() => {
            setMetrics(getCurrentMetrics());
            setVitals(getWebVitals());
          }}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Core Web Vitals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {vitals.map((vital) => (
          <div key={vital.id} className={`p-4 rounded-lg border ${getVitalColor(vital.rating)}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm">{vital.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${getVitalColor(vital.rating)}`}>
                {vital.rating}
              </span>
            </div>
            <div className="text-2xl font-bold">
              {vital.name === 'CLS' ? vital.value.toFixed(3) : `${Math.round(vital.value)}${vital.name === 'FID' ? 'ms' : 'ms'}`}
            </div>
          </div>
        ))}
      </div>

      {/* Other Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.bundleSize !== undefined && (
          <div className="p-4 bg-white rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 text-slate-600 text-sm mb-1">
              <Database className="w-4 h-4" /> Bundle Size
            </div>
            <div className="text-xl font-bold text-slate-800">{metrics.bundleSize.toFixed(1)} KB</div>
          </div>
        )}

        {metrics.apiResponseTime !== undefined && (
          <div className="p-4 bg-white rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 text-slate-600 text-sm mb-1">
              <Clock className="w-4 h-4" /> API Response
            </div>
            <div className="text-xl font-bold text-slate-800">{metrics.apiResponseTime.toFixed(0)} ms</div>
          </div>
        )}

        {metrics.memoryUsage !== undefined && (
          <div className="p-4 bg-white rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 text-slate-600 text-sm mb-1">
              <Database className="w-4 h-4" /> Memory
            </div>
            <div className="text-xl font-bold text-slate-800">{metrics.memoryUsage.toFixed(1)} MB</div>
          </div>
        )}

        {metrics.fps !== undefined && (
          <div className="p-4 bg-white rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 text-slate-600 text-sm mb-1">
              <Zap className="w-4 h-4" /> FPS
            </div>
            <div className="text-xl font-bold text-slate-800">{metrics.fps}</div>
          </div>
        )}

        {metrics.offlineStatus !== undefined && (
          <div className="p-4 bg-white rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 text-slate-600 text-sm mb-1">
              {metrics.offlineStatus ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
              Status
            </div>
            <div className={`text-xl font-bold ${metrics.offlineStatus ? 'text-red-600' : 'text-green-600'}`}>
              {metrics.offlineStatus ? 'Offline' : 'Online'}
            </div>
          </div>
        )}
      </div>

      {/* Performance Recommendations */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" /> Recommendations
        </h4>
        <ul className="text-sm text-blue-800 space-y-1">
          {vitals.find(v => v.rating === 'poor') && (
            <li>• Some Core Web Vitals need improvement</li>
          )}
          {metrics.bundleSize && metrics.bundleSize > 100 && (
            <li>• Bundle size is large - consider code splitting</li>
          )}
          {metrics.fps && metrics.fps < 60 && (
            <li>• FPS is below 60 - check for heavy animations</li>
          )}
          {vitals.every(v => v.rating === 'good') && metrics.fps && metrics.fps >= 60 && (
            <li>• All performance metrics are optimal!</li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default PerformanceDashboard;



