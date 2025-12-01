import React from 'react';
import { Mail, MessageSquare, CheckCircle, AlertCircle, RefreshCw, X, Activity } from 'lucide-react';
import { Channel, PlatformStatus } from '../types';

export interface IntegrationCardProps {
  service: 'outlook' | 'whatsapp' | 'wechat';
  isConnected: boolean;
  account: string;
  lastSync: string | null;
  dailyLimit: { used: number; total: number };
  onConnect: () => void;
  onDisconnect: () => void;
  onReconnect?: () => void;
  healthStatus?: 'healthy' | 'error';
  errorMessage?: string;
  tokenExpiry?: number | null;
  analytics?: {
    messagesSent: number;
    deliveryRate: number;
    replyRate: number;
  };
}

const IntegrationCard: React.FC<IntegrationCardProps> = ({
  service,
  isConnected,
  account,
  lastSync,
  dailyLimit,
  onConnect,
  onDisconnect,
  onReconnect,
  healthStatus = 'healthy',
  errorMessage,
  tokenExpiry,
  analytics,
}) => {
  const getServiceIcon = () => {
    switch (service) {
      case 'outlook':
        return <Mail className="w-6 h-6" />;
      case 'whatsapp':
        return <MessageSquare className="w-6 h-6" />;
      case 'wechat':
        return <MessageSquare className="w-6 h-6" />;
    }
  };

  const getServiceName = () => {
    switch (service) {
      case 'outlook':
        return 'Email & Outlook';
      case 'whatsapp':
        return 'WhatsApp';
      case 'wechat':
        return 'WeChat';
    }
  };

  const getServiceColor = () => {
    switch (service) {
      case 'outlook':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-500',
          header: 'bg-gradient-to-r from-blue-600 to-blue-700',
          icon: 'bg-blue-100 text-blue-600',
        };
      case 'whatsapp':
        return {
          bg: 'bg-green-50',
          border: 'border-green-500',
          header: 'bg-gradient-to-r from-green-600 to-green-700',
          icon: 'bg-green-100 text-green-600',
        };
      case 'wechat':
        return {
          bg: 'bg-emerald-50',
          border: 'border-emerald-500',
          header: 'bg-gradient-to-r from-emerald-600 to-emerald-700',
          icon: 'bg-emerald-100 text-emerald-600',
        };
    }
  };

  const colors = getServiceColor();
  const limitPercentage = dailyLimit.total > 0 ? (dailyLimit.used / dailyLimit.total) * 100 : 0;
  const isLimitReached = dailyLimit.used >= dailyLimit.total;

  const formatLastSync = (sync: string | null) => {
    if (!sync) return 'Never';
    const date = new Date(sync);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}min ago`;
    if (diffHours < 24) return `${diffHours}hr ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getTokenExpiryStatus = () => {
    if (!tokenExpiry) return null;
    const now = Date.now();
    const expiry = tokenExpiry;
    const diffMs = expiry - now;
    const diffHours = Math.floor(diffMs / 3600000);
    const diffMins = Math.floor((diffMs % 3600000) / 60000);

    if (diffMs < 0) {
      return { text: 'Token expired', color: 'text-red-600', bg: 'bg-red-50' };
    }
    if (diffHours < 1) {
      return { text: `Expires in ${diffMins}min`, color: 'text-yellow-600', bg: 'bg-yellow-50' };
    }
    if (diffHours < 24) {
      return { text: `Expires in ${diffHours}hr`, color: 'text-yellow-600', bg: 'bg-yellow-50' };
    }
    return { text: `Expires in ${Math.floor(diffHours / 24)}d`, color: 'text-green-600', bg: 'bg-green-50' };
  };

  const tokenStatus = getTokenExpiryStatus();

  return (
    <div className={`border-2 ${colors.border} rounded-xl overflow-hidden bg-white shadow-lg hover:shadow-xl transition-shadow`}>
      {/* Header */}
      <div className={`${colors.header} p-4 text-white`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colors.icon.replace('bg-', 'bg-white/20')} text-white`}>
              {getServiceIcon()}
            </div>
            <div>
              <h4 className="font-bold text-base">{getServiceName()}</h4>
              <p className="text-xs text-white/80 mt-0.5">
                {isConnected ? account || 'Connected' : 'Not connected'}
              </p>
            </div>
          </div>
          {isConnected ? (
            <div className="flex items-center gap-2">
              {healthStatus === 'healthy' ? (
                <CheckCircle className="w-5 h-5 text-green-300" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-300" />
              )}
              <span className="text-sm font-medium text-green-200">Connected</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-300" />
              <span className="text-sm font-medium text-yellow-200">Not Connected</span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Status Info */}
        {isConnected && (
          <div className="space-y-2">
            {lastSync && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">Last sync:</span>
                <span className="text-slate-800 font-medium">{formatLastSync(lastSync)}</span>
              </div>
            )}
            {tokenStatus && (
              <div className={`${tokenStatus.bg} border border-current rounded px-2 py-1 text-xs ${tokenStatus.color}`}>
                {tokenStatus.text}
              </div>
            )}
            {errorMessage && (
              <div className="bg-red-50 border border-red-200 rounded px-2 py-1 text-xs text-red-700">
                {errorMessage}
              </div>
            )}
          </div>
        )}

        {/* Analytics */}
        {analytics && isConnected && (
          <div className="bg-slate-50 rounded-lg p-3 space-y-1.5 border border-slate-200">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Messages sent:</span>
              <span className="text-slate-800 font-semibold">{analytics.messagesSent} ✓</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Delivery rate:</span>
              <span className="text-slate-800 font-semibold">{analytics.deliveryRate}%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Reply rate:</span>
              <span className="text-slate-800 font-semibold">{analytics.replyRate}%</span>
            </div>
          </div>
        )}

        {/* Daily Limit */}
        {isConnected && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Daily limit:</span>
              <span className={`font-medium ${isLimitReached ? 'text-red-600' : 'text-slate-800'}`}>
                {dailyLimit.used} / {dailyLimit.total}
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  isLimitReached ? 'bg-red-500' : limitPercentage > 80 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${Math.min(limitPercentage, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {isConnected ? (
            <>
              {onReconnect && (
                <button
                  onClick={onReconnect}
                  className="flex-1 px-3 py-2 bg-slate-100 text-slate-700 text-xs font-medium rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reconnect
                </button>
              )}
              <button
                onClick={onDisconnect}
                className="flex-1 px-3 py-2 border-2 border-red-300 text-red-600 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={onConnect}
              className="w-full px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
            >
              {getServiceIcon()}
              <span>Connect</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default IntegrationCard;


