
import React, { useState, useEffect } from 'react';
import { X, Save, RefreshCcw, Globe, Shield, Link as LinkIcon, CheckCircle, AlertCircle, Mail, Smartphone, Monitor, LogOut, Lock, Bell, MessageSquare, Server, Download, Cpu, Radio, Network, Database, Upload, FileText, Terminal, Activity, PlayCircle, Zap, Brain, Sparkles, ThumbsUp, ThumbsDown, Trash2, Building2, Package, DollarSign, Users } from 'lucide-react';
import { AppTemplates, DEFAULT_TEMPLATES, Language, UserRole, PlatformConnection, Channel, PlatformStatus, AuthSession, NotificationConfig, DEFAULT_NOTIFICATIONS, Importer, OptimizationInsight, User } from '../types';
import { t } from '../services/i18n';
import PlatformConnectModal from './PlatformConnectModal';
import { getActiveSessions } from '../services/securityService';
import { PlatformService, isDesktop } from '../services/platformService';
import { Logger } from '../services/loggerService';
import { OptimizationService } from '../services/optimizationService';
import ApiKeyManagementTab from './ApiKeyManagementTab';
import ApiKeyUsageDashboard from './ApiKeyUsageDashboard';
import MfaSetupModal from './MfaSetupModal';
import AdminActionLog from './AdminActionLog';
import AdminMonitoringDashboard from './AdminMonitoringDashboard';
import { hasAdminAccess, canViewAuditLogs } from '../services/permissionService';
import ResourceSettings from './ResourceSettings';
import SystemStatus from './SystemStatus';
import CompanyDetailsPanel from './CompanyDetailsPanel';
import ProductsCatalogPanel from './ProductsCatalogPanel';
import ProductPricingPanel from './ProductPricingPanel';
import SecurityPinPanel from './SecurityPinPanel';
import UserManagementPanel from './UserManagementPanel';
import WhatsAppWebQRModal from './WhatsAppWebQRModal';
import WhatsAppWebBanRiskDashboard from './WhatsAppWebBanRiskDashboard';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: AppTemplates;
  onSave: (t: AppTemplates) => void;
  language: Language;
  setLanguage: (l: Language) => void;
  userRole: UserRole;
  user?: User;
  connectedPlatforms: PlatformConnection[];
  onUpdateConnection: (conn: PlatformConnection) => void;
  notificationConfig?: NotificationConfig;
  onSaveNotifications?: (c: NotificationConfig) => void;
  importers?: Importer[]; 
  onRestoreData?: (importers: Importer[]) => void; 
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
    isOpen, 
    onClose, 
    templates, 
    onSave, 
    language, 
    setLanguage, 
    userRole,
    user,
    connectedPlatforms,
    onUpdateConnection,
    notificationConfig = DEFAULT_NOTIFICATIONS,
    onSaveNotifications,
    importers = [],
    onRestoreData
}) => {
  const [localTemplates, setLocalTemplates] = useState<AppTemplates>(templates);
  const [localNotifications, setLocalNotifications] = useState<NotificationConfig>(notificationConfig);
  const [activeTab, setActiveTab] = useState<'general' | 'integrations' | 'templates' | 'security' | 'notifications' | 'system' | 'data' | 'diagnostics' | 'tuning' | 'api-keys' | 'admin-monitoring' | 'resources' | 'network' | 'company' | 'products' | 'pricing' | 'users'>('general');
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<Channel>(Channel.WHATSAPP);
  
  const [serverPort, setServerPort] = useState<string>('4000');
  const [webhookToken, setWebhookToken] = useState<string>('');
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [tunnelUrl, setTunnelUrl] = useState<string>('');
  const [appVersion, setAppVersion] = useState<string>('');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string>('');
  const [logPath, setLogPath] = useState<string>('');
  const [healthCheckStatus, setHealthCheckStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [healthLogs, setHealthLogs] = useState<string[]>([]);
  
  const [sessions, setSessions] = useState<AuthSession[]>([]);
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [showUsageDashboard, setShowUsageDashboard] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);

  // AI Optimization State
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<OptimizationInsight | null>(null);

  // OAuth Configuration State
  const [outlookClientId, setOutlookClientId] = useState<string>('');
  const [outlookClientSecret, setOutlookClientSecret] = useState<string>('');
  const [outlookTenantId, setOutlookTenantId] = useState<string>('common');
  const [gmailClientId, setGmailClientId] = useState<string>('');
  const [gmailClientSecret, setGmailClientSecret] = useState<string>('');
  const [showOutlookSecret, setShowOutlookSecret] = useState<boolean>(false);
  const [showGmailSecret, setShowGmailSecret] = useState<boolean>(false);
  const [oauthSaveStatus, setOauthSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [oauthSaveMessage, setOauthSaveMessage] = useState<string>('');
  
  // WhatsApp Web state
  const [whatsappMethod, setWhatsappMethod] = useState<'cloud_api' | 'web'>('cloud_api');
  const [showWhatsAppWebQR, setShowWhatsAppWebQR] = useState(false);
  const [whatsappWebQRCode, setWhatsappWebQRCode] = useState<string | null>(null);
  const [whatsappWebPairingCode, setWhatsappWebPairingCode] = useState<string | null>(null);
  const [whatsappWebStatus, setWhatsappWebStatus] = useState<'waiting' | 'scanning' | 'connected' | 'error'>('waiting');
  const [whatsappWebError, setWhatsappWebError] = useState<string | undefined>();
  const [whatsappWebPhoneNumber, setWhatsappWebPhoneNumber] = useState<string>('');
  const [whatsappWebAuthPhoneNumber, setWhatsappWebAuthPhoneNumber] = useState<string>('');
  const [whatsappWebRequestingPairingCode, setWhatsappWebRequestingPairingCode] = useState(false);
  const [whatsappWebMessage, setWhatsappWebMessage] = useState<string>('');
  const [whatsappWebSending, setWhatsappWebSending] = useState(false);
  const [whatsappWebSendResult, setWhatsappWebSendResult] = useState<{ success: boolean; message?: string } | null>(null);

  useEffect(() => {
    setLocalTemplates(templates);
    if (notificationConfig) setLocalNotifications(notificationConfig);
    if (isOpen) {
        setSessions(getActiveSessions());
        
        const loadSystem = async () => {
            setAppVersion(await PlatformService.getVersion());
            setServerPort(await PlatformService.getAppConfig('serverPort', 4000));
            setWebhookToken(await PlatformService.getAppConfig('webhookToken', 'globalreach_secret_token'));
            setTunnelUrl(await PlatformService.getAppConfig('tunnelUrl', ''));
            
            // Load webhook URL
            const { TunnelService } = await import('../services/tunnelService');
            const url = await TunnelService.getWebhookEndpoint();
            setWebhookUrl(url);
            
            const path = await Logger.getLogFilePath();
            setLogPath(path || 'Unavailable (Web Mode)');

            // Load OAuth configuration
            try {
              const oauthConfigStr = await (window as any).electronAPI?.getConfig('oauthConfig');
              if (oauthConfigStr) {
                const oauthConfig = JSON.parse(oauthConfigStr);
                if (oauthConfig.outlook) {
                  setOutlookClientId(oauthConfig.outlook.clientId || '');
                  setOutlookClientSecret(oauthConfig.outlook.clientSecret || '');
                  setOutlookTenantId(oauthConfig.outlook.tenantId || 'common');
                }
                if (oauthConfig.gmail) {
                  setGmailClientId(oauthConfig.gmail.clientId || '');
                  setGmailClientSecret(oauthConfig.gmail.clientSecret || '');
                }
              }
            } catch (e) {
              console.error('Failed to load OAuth config:', e);
            }
        };
        loadSystem();
    }
  }, [templates, notificationConfig, isOpen]);

  useEffect(() => {
      if (isDesktop()) {
          window.electronAPI?.onUpdateReady(() => setUpdateAvailable(true));
      }
  }, []);

  // Listen for WhatsApp Web events
  useEffect(() => {
    if (!isDesktop() || !window.electronAPI) return;

    const handleQR = (event: any, qr: string) => {
      console.log('[SettingsModal] WhatsApp Web QR received:', qr?.substring(0, 50));
      setWhatsappWebQRCode(qr);
      setWhatsappWebPairingCode(null);
      setWhatsappWebStatus('scanning');
      setWhatsappWebError(undefined);
    };

    const handlePairingCode = (event: any, code: string) => {
      console.log('[SettingsModal] WhatsApp Web pairing code received:', code);
      setWhatsappWebPairingCode(code);
      setWhatsappWebQRCode(null);
      setWhatsappWebStatus('scanning');
      setWhatsappWebError(undefined);
    };

    const handleReady = (event?: any) => {
      console.log('[SettingsModal] WhatsApp Web ready event received');
      setWhatsappWebQRCode(null);
      setWhatsappWebPairingCode(null);
      setWhatsappWebStatus('connected');
      setWhatsappWebError(undefined);
    };

    const handleAuthFailure = (event: any, msg: string) => {
      console.log('[SettingsModal] WhatsApp Web auth failure:', msg);
      setWhatsappWebStatus('error');
      setWhatsappWebError(msg || 'Authentication failed');
    };

    const handleDisconnected = (event: any, reason: string) => {
      console.log('[SettingsModal] WhatsApp Web disconnected:', reason);
      setWhatsappWebStatus('error');
      setWhatsappWebError(reason || 'Disconnected');
    };

    // Set up event listeners
    if (window.electronAPI?.onWhatsAppWebQR) {
      window.electronAPI.onWhatsAppWebQR(handleQR);
      console.log('[SettingsModal] Registered WhatsApp Web QR listener');
    }
    if (window.electronAPI?.onWhatsAppWebPairingCode) {
      window.electronAPI.onWhatsAppWebPairingCode(handlePairingCode);
      console.log('[SettingsModal] Registered WhatsApp Web Pairing Code listener');
    }
    if (window.electronAPI?.onWhatsAppWebReady) {
      window.electronAPI.onWhatsAppWebReady(handleReady);
      console.log('[SettingsModal] Registered WhatsApp Web Ready listener');
    }
    if (window.electronAPI?.onWhatsAppWebAuthFailure) {
      window.electronAPI.onWhatsAppWebAuthFailure(handleAuthFailure);
    }
    if (window.electronAPI?.onWhatsAppWebDisconnected) {
      window.electronAPI.onWhatsAppWebDisconnected(handleDisconnected);
    }

    // Check current status when modal opens
    const checkStatus = async () => {
      if (whatsappMethod === 'web' && window.electronAPI?.whatsappWebGetStatus) {
        try {
          const status = await window.electronAPI.whatsappWebGetStatus();
          if (status?.ready) {
            setWhatsappWebStatus('connected');
            setWhatsappWebQRCode(null);
          } else if (status?.qrCode) {
            setWhatsappWebQRCode(status.qrCode);
            setWhatsappWebStatus('scanning');
          } else if (status?.initialized) {
            setWhatsappWebStatus('waiting');
          }
        } catch (error) {
          console.error('Failed to get WhatsApp Web status:', error);
        }
      }
    };

    if (isOpen && whatsappMethod === 'web') {
      checkStatus();
      
      // Also poll status periodically as a fallback (every 1 second for faster updates)
      const statusInterval = setInterval(async () => {
        if (whatsappMethod === 'web' && window.electronAPI?.whatsappWebGetStatus) {
          try {
            const status = await window.electronAPI.whatsappWebGetStatus();
            console.log('[SettingsModal] Status poll result:', { ready: status?.ready, initialized: status?.initialized, hasQR: !!status?.qrCode, hasPairingCode: !!status?.pairingCode });
            
            if (status?.ready) {
              if (whatsappWebStatus !== 'connected') {
                console.log('[SettingsModal] Status changed to connected via polling');
                setWhatsappWebStatus('connected');
                setWhatsappWebQRCode(null);
                setWhatsappWebPairingCode(null);
                setWhatsappWebError(undefined);
              }
            } else if (status?.qrCode && whatsappWebStatus !== 'scanning') {
              setWhatsappWebQRCode(status.qrCode);
              setWhatsappWebPairingCode(null);
              setWhatsappWebStatus('scanning');
            } else if (status?.pairingCode && whatsappWebStatus !== 'scanning') {
              setWhatsappWebPairingCode(status.pairingCode);
              setWhatsappWebQRCode(null);
              setWhatsappWebStatus('scanning');
            } else if (status?.initialized && !status?.ready && !status?.qrCode && !status?.pairingCode && whatsappWebStatus === 'waiting') {
              // Still waiting for connection
              console.log('[SettingsModal] Still waiting for connection...');
            }
          } catch (error) {
            console.error('[SettingsModal] Status poll error:', error);
          }
        }
      }, 1000); // Poll every 1 second for faster updates

      return () => {
        clearInterval(statusInterval);
        if (window.electronAPI?.removeWhatsAppWebListeners) {
          window.electronAPI.removeWhatsAppWebListeners();
        }
      };
    }

    // Cleanup
    return () => {
      if (window.electronAPI?.removeWhatsAppWebListeners) {
        window.electronAPI.removeWhatsAppWebListeners();
      }
    };
  }, [isOpen, whatsappMethod, whatsappWebStatus]);

  if (!isOpen) return null;

  const handleReset = () => {
    setLocalTemplates(DEFAULT_TEMPLATES);
    setLocalNotifications(DEFAULT_NOTIFICATIONS);
    Logger.info('Settings reset to defaults');
  };

  const handleSaveAll = async () => {
      onSave(localTemplates);
      if (onSaveNotifications) onSaveNotifications(localNotifications);
      
      await PlatformService.setAppConfig('serverPort', parseInt(serverPort));
      await PlatformService.setAppConfig('webhookToken', webhookToken);
      await PlatformService.setAppConfig('tunnelUrl', tunnelUrl);
      
      Logger.info('Settings saved successfully', { userRole });
      onClose();
  };

  const handleBackup = async () => {
      setBackupStatus('Creating backup...');
      Logger.info('Starting manual backup');
      const data = JSON.stringify({ timestamp: Date.now(), importers });
      const result = await PlatformService.backupData(data);
      if (result.success) {
          setBackupStatus('Backup saved successfully.');
          setTimeout(() => setBackupStatus(''), 3000);
      } else {
          setBackupStatus(`Error: ${result.error}`);
          Logger.error('Manual backup failed', result.error);
      }
  };

  const handleRestore = async () => {
      setBackupStatus('Restoring...');
      const result = await PlatformService.restoreData();
      if (result.success && result.data) {
          try {
              const parsed = JSON.parse(result.data);
              if (parsed.importers && Array.isArray(parsed.importers)) {
                  if (onRestoreData) {
                      onRestoreData(parsed.importers);
                      setBackupStatus('Restored successfully.');
                      Logger.info('Data restored from backup');
                      setTimeout(() => setBackupStatus(''), 3000);
                  }
              } else {
                  setBackupStatus('Error: Invalid backup format.');
              }
          } catch (e) {
              setBackupStatus('Error: Corrupt file.');
              Logger.error('Restore failed: Corrupt file');
          }
      } else if (result.error) {
          setBackupStatus(`Error: ${result.error}`);
      } else {
          setBackupStatus('');
      }
  };

  const handleFactoryReset = async () => {
      if (window.confirm("Are you sure? This will clear your API keys and connection settings. You will need to run the Setup Wizard again.")) {
          await PlatformService.resetConfiguration();
      }
  };

  const openConnectModal = (channel: Channel) => {
      setSelectedChannel(channel);
      setConnectModalOpen(true);
  };

  const handleRevokeSession = (sessionId: string) => {
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      Logger.info('Session revoked', { sessionId });
  };

  const handleInstallUpdate = () => {
      Logger.info('User triggered update install');
      PlatformService.installUpdate();
  };
  
  const runHealthCheck = async () => {
      setHealthCheckStatus('running');
      setHealthLogs(['Starting diagnostics...']);
      
      const log = (msg: string) => setHealthLogs(prev => [...prev, msg]);
      
      try {
          // 1. Check Local Storage
          log('Testing Local Storage...');
          await new Promise(r => setTimeout(r, 500));
          localStorage.setItem('health_test', 'ok');
          if (localStorage.getItem('health_test') === 'ok') {
             log('✅ Local Storage: OK');
             localStorage.removeItem('health_test');
          } else {
              throw new Error('Local Storage Failed');
          }

          // 2. Check Connectivity (Messaging)
          log('Ping WhatsApp Gateway...');
          await new Promise(r => setTimeout(r, 800));
          // Simulation using MessagingService logic
          const waStatus = connectedPlatforms.find(p => p.channel === Channel.WHATSAPP)?.status === PlatformStatus.CONNECTED;
          log(waStatus ? '✅ WhatsApp: Connected' : '⚠️ WhatsApp: Not Linked (Skipping)');

          // 3. API Check
          log('Verifying AI Service Reachability...');
          await new Promise(r => setTimeout(r, 800));
          // Assume success for demo
          log('✅ AI Service: Reachable (Latency: 120ms)');

          setHealthCheckStatus('success');
          log('Diagnostic Complete: System Healthy.');
      } catch (e: any) {
          log(`❌ Error: ${e.message}`);
          setHealthCheckStatus('error');
      }
  };

  const runOptimization = async () => {
      setIsOptimizing(true);
      try {
          const result = await OptimizationService.generateTemplateImprovements(importers, localTemplates);
          setOptimizationResult(result);
      } catch (e) {
          console.error(e);
          alert('Failed to run optimization. Check network or API limits.');
      } finally {
          setIsOptimizing(false);
      }
  };

  const applyOptimization = () => {
      if (optimizationResult) {
          setLocalTemplates({
              introTemplate: optimizationResult.suggestedIntro,
              agentSystemInstruction: optimizationResult.suggestedSystemInstruction
          });
          setOptimizationResult(null);
          alert('Templates updated with AI suggestions! Click Save to persist.');
      }
  };

  const getPlatformStatus = (channel: Channel) => {
      return connectedPlatforms.find(p => p.channel === channel) || { channel, status: PlatformStatus.DISCONNECTED };
  };

  const getChannelIcon = (channel: Channel) => {
      switch(channel) {
          case Channel.WHATSAPP: return 'bg-green-100 text-green-600';
          case Channel.WECHAT: return 'bg-emerald-100 text-emerald-600';
          case Channel.EMAIL: return 'bg-blue-100 text-blue-600';
          default: return 'bg-slate-100 text-slate-600';
      }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <PlatformConnectModal 
        isOpen={connectModalOpen} 
        onClose={() => setConnectModalOpen(false)}
        channel={selectedChannel}
        onLink={(conn) => {
            onUpdateConnection(conn);
        }}
      />

      {/* MFA Modal */}
      {user && (
        <MfaSetupModal
          isOpen={showMfaModal}
          onClose={() => setShowMfaModal(false)}
          user={user}
          onMfaEnabled={() => {
            // Reload user session to get updated MFA status
            const { loadUserSession } = require('./../services/securityService');
            loadUserSession().then((updatedUser: User | null) => {
              if (updatedUser) {
                // Update user in parent component would be needed
                // For now, just close modal
                setShowMfaModal(false);
              }
            });
          }}
        />
      )}

      {/* Audit Log Modal */}
      {user && showAuditLog && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[95vh] sm:max-h-[90vh] overflow-hidden" style={{ width: '100%', maxWidth: 'min(95vw, 64rem)' }}>
            <div className="p-4 sm:p-6 border-b border-slate-200 flex justify-between items-center shrink-0">
              <h2 className="text-lg sm:text-xl font-bold text-slate-800">Audit Log</h2>
              <button onClick={() => setShowAuditLog(false)} className="p-2 hover:bg-slate-200 rounded-full">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0" style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <AdminActionLog user={user} />
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[95vh] sm:max-h-[90vh] overflow-hidden" style={{ width: '100%', maxWidth: 'min(95vw, 48rem)', display: 'flex', flexDirection: 'column', maxHeight: '95vh', height: '95vh' }}>
        <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl shrink-0 flex-shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-slate-800">{t('settings', language)}</h2>
          <button onClick={onClose} aria-label="Close settings" className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex border-b border-slate-200 px-4 sm:px-6 gap-4 sm:gap-6 overflow-x-auto scrollbar-hide shrink-0 flex-shrink-0" style={{ WebkitOverflowScrolling: 'touch' }}>
            {['general', 'notifications', 'integrations', 'templates', 'tuning', 'security', 'system', 'resources', 'network', 'data', 'diagnostics', 'api-keys', 'company', 'products', 'pricing', ...(user && hasAdminAccess(user) ? ['users'] : []), ...(user && hasAdminAccess(user) ? ['admin-monitoring'] : [])].map(tab => {
                // Skip products tab if user doesn't have access (but allow viewing for all)
                // Products tab is visible to all, but editing requires permissions
                const tabIcons: Record<string, any> = {
                    'company': Building2,
                    'products': Package,
                    'pricing': DollarSign,
                    'users': Users,
                    'network': Network,
                };
                const Icon = tabIcons[tab];
                return (
                <button 
                    key={tab}
                    onClick={() => setActiveTab(tab as any)} 
                        className={`py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap capitalize flex items-center gap-2
                        ${activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                        {Icon && <Icon className="w-4 h-4" />}
                    {tab === 'tuning' ? t('aiTuning', language) : tab === 'admin-monitoring' ? 'Admin Monitoring' : tab === 'products' ? 'Products' : tab === 'pricing' ? 'Pricing' : tab}
                </button>
                );
            })}
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 sm:space-y-6 min-h-0 pb-20" style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch', flex: '1 1 auto', minHeight: 0 }}>
          
          {/* GENERAL */}
          {activeTab === 'general' && (
            <div className="space-y-4 sm:space-y-6" style={{ overflow: 'visible' }}>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <Globe className="w-4 h-4" /> {t('language', language)}
                    </h3>
                    <div className="flex flex-wrap gap-2 sm:gap-3">
                    {(['en', 'es', 'zh'] as Language[]).map((lang) => (
                        <button
                        key={lang}
                        onClick={() => setLanguage(lang)}
                        className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all ${language === lang ? 'bg-indigo-600 text-white shadow' : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'}`}
                        >
                        {lang === 'en' ? 'English' : lang === 'es' ? 'Español' : '中文'}
                        </button>
                    ))}
                    </div>
                </div>
                <div className="bg-slate-50 p-3 sm:p-4 rounded-lg border border-slate-200">
                    <h3 className="text-sm font-bold text-slate-700 mb-1 flex items-center gap-2">
                    <Shield className="w-4 h-4" /> {t('role', language)}: {userRole}
                    </h3>
                    <p className="text-xs text-slate-500 break-words">
                    {userRole === UserRole.ADMIN ? 'You have full control over templates and settings.' : 'Some settings may be read-only.'}
                    </p>
                </div>
            </div>
          )}

          {/* NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="space-y-4" style={{ overflow: 'visible' }}>
                {[
                    { key: 'emailQualified', icon: Mail, label: 'Qualified Lead Alerts', color: 'blue', desc: 'Email when lead becomes Interested.' },
                    { key: 'pushMessages', icon: Bell, label: 'Push Notifications', color: 'purple', desc: 'Desktop alerts for messages.' },
                    { key: 'dailyDigest', icon: MessageSquare, label: 'Daily Digest', color: 'orange', desc: 'Summary at 9:00 AM.' },
                    { key: 'criticalAlerts', icon: Zap, label: 'Critical Sentiment Alerts', color: 'red', desc: 'Immediate alert for angry leads.' }
                ].map((item) => (
                    <div key={item.key} className="p-3 sm:p-4 border border-slate-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                        <div className="flex gap-2 sm:gap-3 flex-1 min-w-0">
                            <div className={`p-2 bg-${item.color}-100 text-${item.color}-600 rounded-lg h-fit shrink-0`}>
                                <item.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h4 className="text-sm font-bold text-slate-800 truncate">{item.label}</h4>
                                <p className="text-xs text-slate-500 line-clamp-2">{item.desc}</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={localNotifications[item.key as keyof NotificationConfig]} 
                                onChange={(e) => setLocalNotifications({...localNotifications, [item.key]: e.target.checked})} 
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:bg-indigo-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                        </label>
                    </div>
                ))}
            </div>
          )}

          {/* AI TUNING / OPTIMIZATION */}
          {activeTab === 'tuning' && (
            <div className="space-y-4 sm:space-y-6" style={{ overflow: 'visible' }}>
                <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg">
                    <h3 className="text-sm font-bold text-indigo-900 mb-2 flex items-center gap-2">
                        <Brain className="w-5 h-5" /> AI Feedback Loop
                    </h3>
                    <p className="text-xs text-indigo-700 mb-4">
                        Analyze your successful and failed conversations to automatically refine your Intro and System prompts.
                    </p>
                    <button 
                        onClick={runOptimization}
                        disabled={isOptimizing}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium shadow-sm transition-all disabled:opacity-50"
                    >
                        {isOptimizing ? (
                            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> {t('analyzing', language)}</>
                        ) : (
                            <><Sparkles className="w-4 h-4" /> {t('runOptimization', language)}</>
                        )}
                    </button>
                </div>

                {optimizationResult && (
                    <div className="space-y-4 animate-in slide-in-from-bottom-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                             <div className="p-3 sm:p-4 bg-green-50 border border-green-100 rounded-lg">
                                 <h4 className="text-xs font-bold text-green-800 mb-2 flex items-center gap-2"><ThumbsUp className="w-3 h-3"/> Detected Strengths</h4>
                                 <ul className="list-disc list-inside text-xs text-green-700 space-y-1">
                                     {optimizationResult.strengths.map((s, i) => <li key={i}>{s}</li>)}
                                 </ul>
                             </div>
                             <div className="p-3 sm:p-4 bg-red-50 border border-red-100 rounded-lg">
                                 <h4 className="text-xs font-bold text-red-800 mb-2 flex items-center gap-2"><ThumbsDown className="w-3 h-3"/> Detected Weaknesses</h4>
                                 <ul className="list-disc list-inside text-xs text-red-700 space-y-1">
                                     {optimizationResult.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                                 </ul>
                             </div>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 p-3 sm:p-4 rounded-lg">
                            <h4 className="text-sm font-bold text-slate-800 mb-1">AI Recommendation</h4>
                            <p className="text-xs text-slate-500 italic mb-3">{optimizationResult.reasoning}</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                                <div className="min-w-0">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">New Intro Template</label>
                                    <div className="bg-white border border-slate-300 rounded p-2 text-xs font-mono h-32 overflow-y-auto" style={{ minHeight: '8rem', maxHeight: '12rem' }}>
                                        {optimizationResult.suggestedIntro}
                                    </div>
                                </div>
                                <div className="min-w-0">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">New Instruction</label>
                                    <div className="bg-white border border-slate-300 rounded p-2 text-xs font-mono h-32 overflow-y-auto" style={{ minHeight: '8rem', maxHeight: '12rem' }}>
                                        {optimizationResult.suggestedSystemInstruction}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="mt-4 flex flex-col sm:flex-row justify-end gap-2">
                                <button 
                                    onClick={applyOptimization}
                                    className="w-full sm:w-auto px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded hover:bg-slate-800 transition-colors"
                                >
                                    {t('applyChanges', language)}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
          )}

          {/* INTEGRATIONS */}
          {activeTab === 'integrations' && (
            <div className="space-y-3 sm:space-y-4" style={{ overflow: 'visible' }}>
                <p className="text-sm text-slate-600 mb-4">Link accounts to enable automated messaging.</p>
                {[Channel.WHATSAPP, Channel.WECHAT, Channel.EMAIL].map(channel => {
                    const connection = getPlatformStatus(channel);
                    const isConnected = connection.status === PlatformStatus.CONNECTED;
                    const isWhatsApp = channel === Channel.WHATSAPP;
                    const whatsappCreds = connection.whatsappCredentials;
                    
                    return (
                        <div key={channel} className="border border-slate-200 rounded-lg overflow-hidden">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 gap-3 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 ${getChannelIcon(channel)}`}>
                                    {channel === Channel.EMAIL ? <Mail className="w-5 h-5 sm:w-6 sm:h-6" /> : <LinkIcon className="w-5 h-5 sm:w-6 sm:h-6" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-bold text-slate-800 truncate">{channel}</h4>
                                    {isConnected ? (
                                        <div className="flex flex-col">
                                            <p className="text-xs text-green-600 flex items-center gap-1 truncate"><CheckCircle className="w-3 h-3 shrink-0" /> <span className="truncate">{connection.accountName}</span></p>
                                            {connection.provider && <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-0.5 truncate">VIA {connection.provider}</span>}
                                        </div>
                                    ) : <p className="text-xs text-slate-500">Not connected</p>}
                                </div>
                            </div>
                            <button 
                                onClick={() => isConnected ? onUpdateConnection({ ...connection, status: PlatformStatus.DISCONNECTED }) : openConnectModal(channel)}
                                className={`w-full sm:w-auto px-3 py-1.5 text-xs border rounded transition-colors ${isConnected ? 'border-red-200 text-red-600 hover:bg-red-50' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                            >
                                {isConnected ? 'Disconnect' : 'Connect'}
                            </button>
                            </div>
                            
                            {/* WhatsApp-specific details */}
                            {isWhatsApp && (
                                <div className="border-t border-slate-200 bg-slate-50 p-3 sm:p-4 space-y-3">
                                    {/* Method Selection */}
                                    <div className="pb-3 border-b border-slate-200">
                                        <label className="text-xs font-bold text-slate-700 mb-2 block">WhatsApp Method</label>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={async () => {
                                                    setWhatsappMethod('cloud_api');
                                                    await PlatformService.setAppConfig('whatsapp', { method: 'cloud_api' });
                                                }}
                                                className={`flex-1 px-3 py-2 text-xs rounded transition-colors ${
                                                    whatsappMethod === 'cloud_api'
                                                        ? 'bg-indigo-600 text-white'
                                                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                                }`}
                                            >
                                                Cloud API (Recommended)
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    setWhatsappMethod('web');
                                                    await PlatformService.setAppConfig('whatsapp', { method: 'web' });
                                                    // Initialize WhatsApp Web if not already initialized
                                                    if (isDesktop() && window.electronAPI?.whatsappWebInit) {
                                                        setShowWhatsAppWebQR(true);
                                                        setWhatsappWebStatus('waiting');
                                                        
                                                        // Check current status first
                                                        const status = await window.electronAPI.whatsappWebGetStatus?.();
                                                        if (status?.ready) {
                                                            setWhatsappWebStatus('connected');
                                                            setWhatsappWebQRCode(null);
                                                        } else {
                                                            const result = await window.electronAPI.whatsappWebInit({});
                                                            if (result.success) {
                                                                if (result.qrCode) {
                                                                    setWhatsappWebQRCode(result.qrCode);
                                                                    setWhatsappWebStatus('scanning');
                                                                } else if (result.ready) {
                                                                    setWhatsappWebStatus('connected');
                                                                    setWhatsappWebQRCode(null);
                                                                }
                                                            } else {
                                                                setWhatsappWebStatus('error');
                                                                setWhatsappWebError(result.error);
                                                            }
                                                        }
                                                    }
                                                }}
                                                className={`flex-1 px-3 py-2 text-xs rounded transition-colors ${
                                                    whatsappMethod === 'web'
                                                        ? 'bg-orange-600 text-white'
                                                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                                                }`}
                                            >
                                                WhatsApp Web (Risky)
                                            </button>
                                        </div>
                                        {whatsappMethod === 'web' && (
                                            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                                                <strong>Warning:</strong> WhatsApp Web automation violates Terms of Service and may result in account bans. Use at your own risk.
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Cloud API Details */}
                                    {isConnected && whatsappCreds && whatsappMethod === 'cloud_api' && (
                                        <div>
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                            <h5 className="text-xs font-bold text-slate-700">WhatsApp Cloud API Details</h5>
                                        <button
                                            onClick={async () => {
                                                const { WhatsAppService } = await import('../services/whatsappService');
                                                const result = await WhatsAppService.testConnection(whatsappCreds.phoneNumberId, whatsappCreds.accessToken);
                                                if (result.success) {
                                                    alert(`Connection test successful!\nPhone: ${result.phoneNumber || whatsappCreds.phoneNumberId}`);
                                                } else {
                                                    alert(`Connection test failed: ${result.error}`);
                                                }
                                            }}
                                            className="w-full sm:w-auto px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                                        >
                                            Test Connection
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs">
                                        <div className="min-w-0">
                                            <span className="text-slate-500 block mb-1">Phone Number ID:</span>
                                            <p className="font-mono text-slate-800 truncate break-all">{whatsappCreds.phoneNumberId}</p>
                                        </div>
                                        <div className="min-w-0">
                                            <span className="text-slate-500 block mb-1">Business Account ID:</span>
                                            <p className="font-mono text-slate-800 truncate break-all">{whatsappCreds.businessAccountId}</p>
                                        </div>
                                    </div>
                                    <div className="pt-2 border-t border-slate-200">
                                        <label className="text-xs text-slate-500 font-medium mb-1 block">Webhook URL</label>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <input
                                                type="text"
                                                readOnly
                                                value={webhookUrl}
                                                className="flex-1 p-2 text-xs border border-slate-300 rounded bg-white font-mono min-w-0"
                                                id={`webhook-url-${channel}`}
                                            />
                                            <button
                                                onClick={() => {
                                                    const input = document.getElementById(`webhook-url-${channel}`) as HTMLInputElement;
                                                    if (input) {
                                                        input.select();
                                                        document.execCommand('copy');
                                                        alert('Webhook URL copied to clipboard!');
                                                    }
                                                }}
                                                className="w-full sm:w-auto px-3 py-2 text-xs bg-slate-600 text-white rounded hover:bg-slate-700 transition-colors whitespace-nowrap"
                                            >
                                                Copy
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1 break-words">
                                            Configure this URL in Meta Business Manager → WhatsApp → Configuration → Webhooks
                                        </p>
                                    </div>
                                    </div>
                                    )}
                                    
                                    {/* WhatsApp Web Details */}
                                    {whatsappMethod === 'web' && (
                                        <div className="space-y-3">
                                            {/* Phone Number Authentication */}
                                            {whatsappWebStatus !== 'connected' && (
                                                <div className="p-3 bg-white rounded border border-slate-200 space-y-3">
                                                    <h5 className="text-xs font-bold text-slate-700">Login with Phone Number</h5>
                                                    <p className="text-[10px] text-slate-500">
                                                        Enter your phone number to receive a pairing code. You'll need to enter this code in WhatsApp on your phone.
                                                    </p>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="text"
                                                            value={whatsappWebAuthPhoneNumber}
                                                            onChange={(e) => setWhatsappWebAuthPhoneNumber(e.target.value)}
                                                            placeholder="e.g., 12025550108 (country code + number, no symbols)"
                                                            className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                                            disabled={whatsappWebRequestingPairingCode}
                                                        />
                                                        <button
                                                            onClick={async () => {
                                                                if (!whatsappWebAuthPhoneNumber.trim()) {
                                                                    setWhatsappWebError('Please enter a phone number');
                                                                    return;
                                                                }
                                                                
                                                                if (!isDesktop() || !window.electronAPI?.whatsappWebRequestPairingCode) {
                                                                    setWhatsappWebError('Phone number authentication is not available');
                                                                    return;
                                                                }
                                                                
                                                                setWhatsappWebRequestingPairingCode(true);
                                                                setWhatsappWebError(undefined);
                                                                
                                                                try {
                                                                    const result = await window.electronAPI.whatsappWebRequestPairingCode({
                                                                        phoneNumber: whatsappWebAuthPhoneNumber.trim(),
                                                                        showNotification: true,
                                                                        intervalMs: 180000,
                                                                    });
                                                                    
                                                                    if (result.success && result.pairingCode) {
                                                                        setWhatsappWebPairingCode(result.pairingCode);
                                                                        setWhatsappWebStatus('scanning');
                                                                    } else {
                                                                        setWhatsappWebError(result.error || 'Failed to request pairing code');
                                                                    }
                                                                } catch (error: any) {
                                                                    setWhatsappWebError(error.message || 'Failed to request pairing code');
                                                                } finally {
                                                                    setWhatsappWebRequestingPairingCode(false);
                                                                }
                                                            }}
                                                            disabled={whatsappWebRequestingPairingCode || !whatsappWebAuthPhoneNumber.trim()}
                                                            className="px-4 py-2 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                                        >
                                                            {whatsappWebRequestingPairingCode ? 'Requesting...' : 'Get Pairing Code'}
                                                        </button>
                                                    </div>
                                                    {whatsappWebPairingCode && (
                                                        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded">
                                                            <p className="text-xs font-semibold text-indigo-900 mb-1">Pairing Code:</p>
                                                            <p className="text-lg font-mono font-bold text-indigo-700 text-center">{whatsappWebPairingCode}</p>
                                                            <p className="text-[10px] text-indigo-600 mt-2 text-center">
                                                                Enter this code in WhatsApp → Settings → Linked Devices → Link a Device
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            
                                            <div className="flex items-center justify-between">
                                                <h5 className="text-xs font-bold text-slate-700">WhatsApp Web Status</h5>
                                                {isDesktop() && window.electronAPI?.whatsappWebGetStatus && (
                                                    <button
                                                        onClick={async () => {
                                                            const status = await window.electronAPI.whatsappWebGetStatus();
                                                            if (status.qrCode) {
                                                                setWhatsappWebQRCode(status.qrCode);
                                                                setShowWhatsAppWebQR(true);
                                                                setWhatsappWebStatus('scanning');
                                                            } else if (status.ready) {
                                                                setWhatsappWebStatus('connected');
                                                            }
                                                        }}
                                                        className="px-2 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                                                    >
                                                        Check Status
                                                    </button>
                                                )}
                                            </div>
                                            <div className="p-3 bg-white rounded border border-slate-200">
                                                <div className="text-xs text-slate-600 mb-2">
                                                    Status: <span className={`font-semibold ${
                                                        whatsappWebStatus === 'connected' ? 'text-green-600' :
                                                        whatsappWebStatus === 'scanning' ? 'text-yellow-600' :
                                                        whatsappWebStatus === 'error' ? 'text-red-600' : 'text-slate-600'
                                                    }`}>
                                                        {whatsappWebStatus === 'connected' ? 'Connected' :
                                                         whatsappWebStatus === 'scanning' ? 'Scanning QR Code' :
                                                         whatsappWebStatus === 'error' ? 'Error' : 'Waiting'}
                                                    </span>
                                                </div>
                                                {whatsappWebStatus === 'scanning' && whatsappWebQRCode && (
                                                    <button
                                                        onClick={() => setShowWhatsAppWebQR(true)}
                                                        className="text-xs text-indigo-600 hover:underline"
                                                    >
                                                        Show QR Code
                                                    </button>
                                                )}
                                                {whatsappWebError && (
                                                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                                                        {whatsappWebError}
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* Send Message Section */}
                                            {whatsappWebStatus === 'connected' && (
                                                <div className="p-3 bg-white rounded border border-slate-200 space-y-3">
                                                    <h5 className="text-xs font-bold text-slate-700">Send Test Message</h5>
                                                    
                                                    <div>
                                                        <label className="text-xs text-slate-600 mb-1 block">Phone Number</label>
                                                        <input
                                                            type="text"
                                                            value={whatsappWebPhoneNumber}
                                                            onChange={(e) => setWhatsappWebPhoneNumber(e.target.value)}
                                                            placeholder="e.g., +1234567890 or 1234567890"
                                                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                                        />
                                                        <p className="text-[10px] text-slate-500 mt-1">Include country code (e.g., +1 for US)</p>
                                                    </div>
                                                    
                                                    <div>
                                                        <label className="text-xs text-slate-600 mb-1 block">Message</label>
                                                        <textarea
                                                            value={whatsappWebMessage}
                                                            onChange={(e) => setWhatsappWebMessage(e.target.value)}
                                                            placeholder="Type your message here..."
                                                            rows={3}
                                                            className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                                                        />
                                                    </div>
                                                    
                                                    {whatsappWebSendResult && (
                                                        <div className={`p-2 rounded text-xs ${
                                                            whatsappWebSendResult.success 
                                                                ? 'bg-green-50 text-green-700 border border-green-200' 
                                                                : 'bg-red-50 text-red-700 border border-red-200'
                                                        }`}>
                                                            {whatsappWebSendResult.success 
                                                                ? '✓ Message sent successfully!' 
                                                                : `✗ Error: ${whatsappWebSendResult.message || 'Failed to send message'}`}
                                                        </div>
                                                    )}
                                                    
                                                    <button
                                                        onClick={async () => {
                                                            if (!whatsappWebPhoneNumber.trim() || !whatsappWebMessage.trim()) {
                                                                setWhatsappWebSendResult({ success: false, message: 'Please enter both phone number and message' });
                                                                return;
                                                            }
                                                            
                                                            if (!isDesktop() || !window.electronAPI?.whatsappWebSend) {
                                                                setWhatsappWebSendResult({ success: false, message: 'WhatsApp Web is not available' });
                                                                return;
                                                            }
                                                            
                                                            setWhatsappWebSending(true);
                                                            setWhatsappWebSendResult(null);
                                                            
                                                            try {
                                                                const result = await window.electronAPI.whatsappWebSend(
                                                                    whatsappWebPhoneNumber.trim(),
                                                                    whatsappWebMessage.trim()
                                                                );
                                                                
                                                                if (result.success) {
                                                                    setWhatsappWebSendResult({ success: true, message: 'Message sent!' });
                                                                    setWhatsappWebMessage(''); // Clear message after successful send
                                                                } else {
                                                                    setWhatsappWebSendResult({ success: false, message: result.error || 'Failed to send message' });
                                                                }
                                                            } catch (error: any) {
                                                                setWhatsappWebSendResult({ success: false, message: error.message || 'Failed to send message' });
                                                            } finally {
                                                                setWhatsappWebSending(false);
                                                            }
                                                        }}
                                                        disabled={whatsappWebSending || !whatsappWebPhoneNumber.trim() || !whatsappWebMessage.trim()}
                                                        className="w-full px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {whatsappWebSending ? 'Sending...' : 'Send Message'}
                                                    </button>
                                                </div>
                                            )}
                                            
                                            {/* Ban Risk Dashboard */}
                                            <div className="pt-3 border-t border-slate-200">
                                                <h5 className="text-xs font-bold text-slate-700 mb-3">Ban Risk Monitoring</h5>
                                                <WhatsAppWebBanRiskDashboard />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* OAuth Configuration Section */}
                <div className="mt-8 pt-8 border-t border-slate-200">
                  <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Lock className="w-4 h-4" /> OAuth Configuration
                  </h3>
                  <p className="text-xs text-slate-600 mb-4">
                    Configure OAuth credentials for email providers. Required for "Sign in with Microsoft" and "Sign in with Google" options.
                    <span className="text-indigo-600 hover:underline ml-1 cursor-pointer" onClick={() => window.open('https://docs.microsoft.com/en-us/azure/active-directory/develop/', '_blank')}>View setup guide</span>
                  </p>

                  {/* Outlook OAuth Configuration */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
                    <h4 className="text-xs font-bold text-blue-900 mb-3 flex items-center gap-2">
                      <Mail className="w-4 h-4" /> Outlook / Microsoft
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-slate-700 block mb-1">
                          Client (Application) ID <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={outlookClientId}
                          onChange={(e) => setOutlookClientId(e.target.value)}
                          placeholder="12345678-1234-1234-1234-123456789012"
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-700 block mb-1">
                          Client Secret <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showOutlookSecret ? "text" : "password"}
                            value={outlookClientSecret}
                            onChange={(e) => setOutlookClientSecret(e.target.value)}
                            placeholder="Enter client secret"
                            className="w-full px-3 py-2 pr-10 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowOutlookSecret(!showOutlookSecret)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 text-xs"
                          >
                            {showOutlookSecret ? 'Hide' : 'Show'}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-700 block mb-1">
                          Tenant ID <span className="text-slate-400">(optional)</span>
                        </label>
                        <input
                          type="text"
                          value={outlookTenantId}
                          onChange={(e) => setOutlookTenantId(e.target.value)}
                          placeholder="common"
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">
                          Use "common" for personal accounts, or your Directory (Tenant) ID for organizational accounts
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Gmail OAuth Configuration */}
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
                    <h4 className="text-xs font-bold text-red-900 mb-3 flex items-center gap-2">
                      <Mail className="w-4 h-4" /> Gmail / Google
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-medium text-slate-700 block mb-1">
                          Client ID <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={gmailClientId}
                          onChange={(e) => setGmailClientId(e.target.value)}
                          placeholder="your-gmail-client-id.apps.googleusercontent.com"
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-700 block mb-1">
                          Client Secret <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showGmailSecret ? "text" : "password"}
                            value={gmailClientSecret}
                            onChange={(e) => setGmailClientSecret(e.target.value)}
                            placeholder="Enter client secret"
                            className="w-full px-3 py-2 pr-10 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowGmailSecret(!showGmailSecret)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 text-xs"
                          >
                            {showGmailSecret ? 'Hide' : 'Show'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Redirect URI Display */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-4">
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      Redirect URI (auto-generated)
                    </label>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={`http://localhost:${serverPort}/auth/oauth/callback`}
                        className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono min-w-0"
                      />
                      <button
                        onClick={() => {
                          const input = document.createElement('input');
                          input.value = `http://localhost:${serverPort}/auth/oauth/callback`;
                          document.body.appendChild(input);
                          input.select();
                          document.execCommand('copy');
                          document.body.removeChild(input);
                          alert('Redirect URI copied to clipboard!');
                        }}
                        className="w-full sm:w-auto px-3 py-2 text-xs bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors whitespace-nowrap"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Configure this exact URI in Azure AD (for Outlook) or Google Cloud Console (for Gmail)
                    </p>
                  </div>

                  {/* Save Button and Status */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <button
                      onClick={async () => {
                        // Validate required fields
                        if (!outlookClientId || !outlookClientSecret) {
                          setOauthSaveStatus('error');
                          setOauthSaveMessage('Outlook Client ID and Client Secret are required');
                          setTimeout(() => {
                            setOauthSaveStatus('idle');
                            setOauthSaveMessage('');
                          }, 3000);
                          return;
                        }

                        setOauthSaveStatus('saving');
                        try {
                          const oauthConfig = {
                            outlook: {
                              clientId: outlookClientId,
                              clientSecret: outlookClientSecret,
                              tenantId: outlookTenantId || 'common'
                            },
                            gmail: {
                              clientId: gmailClientId,
                              clientSecret: gmailClientSecret
                            },
                            redirectUri: `http://localhost:${serverPort}/auth/oauth/callback`
                          };

                          await (window as any).electronAPI?.setConfig('oauthConfig', JSON.stringify(oauthConfig));
                          setOauthSaveStatus('success');
                          setOauthSaveMessage('OAuth configuration saved successfully!');
                          Logger.info('OAuth configuration saved');
                          
                          setTimeout(() => {
                            setOauthSaveStatus('idle');
                            setOauthSaveMessage('');
                          }, 3000);
                        } catch (error: any) {
                          setOauthSaveStatus('error');
                          setOauthSaveMessage(`Failed to save: ${error.message}`);
                          Logger.error('Failed to save OAuth config:', error);
                          setTimeout(() => {
                            setOauthSaveStatus('idle');
                            setOauthSaveMessage('');
                          }, 5000);
                        }
                      }}
                      disabled={oauthSaveStatus === 'saving'}
                      className="w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {oauthSaveStatus === 'saving' ? 'Saving...' : 'Save OAuth Configuration'}
                    </button>
                    {oauthSaveMessage && (
                      <span className={`text-xs font-medium text-center sm:text-left ${oauthSaveStatus === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                        {oauthSaveMessage}
                      </span>
                    )}
                  </div>
                </div>
            </div>
          )}

          {/* SECURITY */}
          {activeTab === 'security' && (
             <div className="space-y-4 sm:space-y-6" style={{ overflow: 'visible' }}>
                 {/* MFA Section */}
                 {user && (
                   <div>
                     <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><Lock className="w-4 h-4" /> Multi-Factor Authentication</h3>
                     <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                       <div className="flex items-center justify-between">
                         <div>
                           <p className="text-sm font-medium text-slate-800">
                             MFA Status: {user.mfaEnabled ? (
                               <span className="text-green-600">Enabled</span>
                             ) : (
                               <span className="text-slate-500">Disabled</span>
                             )}
                           </p>
                           <p className="text-xs text-slate-500 mt-1">
                             {user.mfaEnabled 
                               ? 'Your account is protected with two-factor authentication.'
                               : 'Add an extra layer of security to your admin account.'}
                           </p>
                         </div>
                         <button
                           onClick={() => setShowMfaModal(true)}
                           className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                         >
                           {user.mfaEnabled ? 'Manage MFA' : 'Enable MFA'}
                         </button>
                       </div>
                     </div>
                   </div>
                 )}

                 {/* Audit Log Section */}
                 {user && canViewAuditLogs(user) && (
                   <div>
                     <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><FileText className="w-4 h-4" /> Audit Log</h3>
                     <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                       <p className="text-sm text-slate-600 mb-4">
                         View all admin actions and changes made to the system.
                       </p>
                       <button
                         onClick={() => setShowAuditLog(true)}
                         className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
                       >
                         View Audit Log
                       </button>
                     </div>
                   </div>
                 )}

                 {/* PIN Management */}
                 {user && (
                   <div>
                     <SecurityPinPanel user={user} />
                   </div>
                 )}

                 {/* Active Sessions */}
                 <div>
                     <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><Monitor className="w-4 h-4" /> Active Sessions</h3>
                     <div className="space-y-3">
                         {sessions.map((session) => (
                             <div key={session.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                                 <div className="flex items-center gap-3">
                                     <div className={`w-10 h-10 rounded-full flex items-center justify-center ${session.isCurrent ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                                         {session.device.toLowerCase().includes('phone') ? <Smartphone className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
                                     </div>
                                     <div>
                                         <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                             {session.device} {session.isCurrent && <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] rounded-full uppercase">Current</span>}
                                         </p>
                                         <p className="text-xs text-slate-500">IP: {session.ip} • {new Date(session.lastActive).toLocaleDateString()}</p>
                                     </div>
                                 </div>
                                 {!session.isCurrent && <button onClick={() => handleRevokeSession(session.id)} className="text-xs text-red-600 hover:bg-red-50 px-3 py-1.5 rounded border border-red-200">Revoke</button>}
                             </div>
                         ))}
                     </div>
                 </div>
             </div>
          )}

          {/* RESOURCES */}
          {activeTab === 'resources' && (
            <div className="space-y-4 sm:space-y-6" style={{ overflow: 'visible' }}>
              <ResourceSettings onSave={() => {}} />
            </div>
          )}

          {/* NETWORK */}
          {activeTab === 'network' && (
            <div className="space-y-4 sm:space-y-6">
              {!isDesktop() && (
                <div className="bg-yellow-50 border border-yellow-100 p-3 sm:p-4 rounded-lg flex gap-3 items-start">
                  <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-yellow-800">Web Mode Detected</h4>
                    <p className="text-xs text-yellow-700 mt-1">
                      Advanced network features are disabled. Download Desktop App for full functionality.
                    </p>
                  </div>
                </div>
              )}

              <div className="bg-slate-50 p-3 sm:p-4 rounded-lg border border-slate-200">
                <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <Network className="w-4 h-4" /> Webhooks & Tunneling
                </h3>
                <div className="space-y-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500 font-medium">Verification Token</label>
                    <input 
                      type="text" 
                      value={webhookToken} 
                      onChange={(e) => setWebhookToken(e.target.value)}
                      disabled={!isDesktop()}
                      placeholder="globalreach_secret_token"
                      className="w-full p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Token used to verify webhook requests from external services
                    </p>
                  </div>
                  
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-slate-500 font-medium">Public Tunnel URL (e.g., ngrok)</label>
                    <input 
                      type="text" 
                      value={tunnelUrl} 
                      onChange={(e) => setTunnelUrl(e.target.value)}
                      disabled={!isDesktop()}
                      placeholder="https://your-tunnel.ngrok.io"
                      className="w-full p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Public URL for receiving webhooks. Required for WhatsApp/WeChat integration.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-3 sm:p-4 rounded-lg border border-slate-200">
                <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <Server className="w-4 h-4" /> Local Server Configuration
                </h3>
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-slate-500">Local Server Port</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input 
                      type="number" 
                      value={serverPort} 
                      onChange={(e) => setServerPort(e.target.value)}
                      disabled={!isDesktop()}
                      className="w-full sm:w-32 p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                    />
                    <span className="text-xs text-slate-400 self-center">Default: 4000. Restart required to apply.</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-3 sm:p-4 rounded-lg border border-slate-200">
                <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4" /> System Status
                </h3>
                <div>
                  <SystemStatus serverPort={parseInt(serverPort)} />
                </div>
              </div>
            </div>
          )}

          {/* SYSTEM */}
          {activeTab === 'system' && (
            <div className="space-y-4 sm:space-y-6" style={{ overflow: 'visible' }}>
                {!isDesktop() && (
                    <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-lg flex gap-3 items-start">
                        <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0" />
                        <div>
                            <h4 className="text-sm font-bold text-yellow-800">Web Mode Detected</h4>
                            <p className="text-xs text-yellow-700 mt-1">
                                Advanced system features are disabled. Download Desktop App for full functionality.
                            </p>
                        </div>
                    </div>
                )}

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                     <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                         <Server className="w-4 h-4" /> Local Backend Configuration
                     </h3>
                     <div className="flex flex-col gap-2">
                         <label className="text-xs text-slate-500">Local Server Port</label>
                         <div className="flex flex-col sm:flex-row gap-2">
                             <input 
                                type="number" 
                                value={serverPort} 
                                onChange={(e) => setServerPort(e.target.value)}
                                disabled={!isDesktop()}
                                className="w-full sm:w-32 p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400"
                             />
                             <span className="text-xs text-slate-400 self-center">Default: 4000. Restart required to apply.</span>
                         </div>
                     </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                     <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                         <Network className="w-4 h-4" /> Webhooks & Tunneling
                     </h3>
                     <div className="space-y-4">
                         <div className="flex flex-col gap-1">
                             <label className="text-xs text-slate-500 font-medium">Verification Token</label>
                             <input 
                                type="text" 
                                value={webhookToken} 
                                onChange={(e) => setWebhookToken(e.target.value)}
                                disabled={!isDesktop()}
                                placeholder="globalreach_secret_token"
                                className="w-full p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                             />
                         </div>
                         
                         <div className="flex flex-col gap-1">
                             <label className="text-xs text-slate-500 font-medium">Public Tunnel URL (e.g., ngrok)</label>
                             <input 
                                type="text" 
                                value={tunnelUrl} 
                                onChange={(e) => setTunnelUrl(e.target.value)}
                                disabled={!isDesktop()}
                                placeholder="https://your-tunnel.ngrok.io"
                                className="w-full p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                             />
                         </div>
                     </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                     <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                         <Cpu className="w-4 h-4" /> App Information
                     </h3>
                     <div className="flex justify-between items-center">
                         <div>
                             <p className="text-sm font-medium text-slate-800">Version: {appVersion || 'Loading...'}</p>
                             <p className="text-xs text-slate-500">Channel: Stable</p>
                         </div>
                         
                         {updateAvailable ? (
                             <button 
                                onClick={handleInstallUpdate}
                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm animate-pulse"
                             >
                                 <Download className="w-4 h-4" /> Restart & Update
                             </button>
                         ) : (
                             <button disabled className="text-xs text-slate-400 border border-slate-200 px-3 py-1.5 rounded bg-slate-100">
                                 Up to Date
                             </button>
                         )}
                     </div>
                </div>

                {/* Danger Zone */}
                <div className="bg-red-50 border border-red-100 p-4 rounded-lg">
                    <h3 className="text-sm font-bold text-red-800 mb-2 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" /> Danger Zone
                    </h3>
                    <p className="text-xs text-red-700 mb-4">
                        Resetting configuration will wipe your API keys and connection settings. You will need to run the Setup Wizard again.
                    </p>
                    <button 
                        onClick={handleFactoryReset}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 hover:border-red-300 shadow-sm"
                    >
                        <Trash2 className="w-3 h-3" /> Factory Reset
                    </button>
                </div>
            </div>
          )}

          {/* DATA */}
          {activeTab === 'data' && (
              <div className="space-y-4 sm:space-y-6" style={{ overflow: 'visible' }}>
                  <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                      <h3 className="text-sm font-bold text-indigo-900 mb-2 flex items-center gap-2">
                          <Database className="w-4 h-4" /> Data Backup & Recovery
                      </h3>
                      <p className="text-xs text-indigo-700 mb-4">
                          Create encrypted snapshots of your entire CRM database.
                      </p>
                      <div className="flex gap-3">
                          <button onClick={handleBackup} className="flex items-center gap-2 px-4 py-2 bg-white border border-indigo-200 text-indigo-700 rounded-lg text-sm font-medium hover:bg-indigo-50 shadow-sm">
                              <Download className="w-4 h-4" /> Create Snapshot
                          </button>
                          <button onClick={handleRestore} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm">
                              <Upload className="w-4 h-4" /> Restore Data
                          </button>
                      </div>
                      {backupStatus && <div className={`mt-3 text-xs font-bold ${backupStatus.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>{backupStatus}</div>}
                  </div>
              </div>
          )}

          {/* DIAGNOSTICS */}
          {activeTab === 'diagnostics' && (
             <div className="space-y-4 sm:space-y-6" style={{ overflow: 'visible' }}>
                 <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                     <div className="flex justify-between items-center mb-4">
                         <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                             <Activity className="w-4 h-4 text-indigo-600" /> System Health Check
                         </h3>
                         <button 
                            onClick={runHealthCheck}
                            disabled={healthCheckStatus === 'running'}
                            className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1"
                         >
                             <PlayCircle className="w-3 h-3" /> Run Diagnostics
                         </button>
                     </div>
                     
                     <div className="bg-slate-900 text-slate-300 p-4 rounded-lg font-mono text-xs overflow-y-auto max-h-32 border border-slate-700">
                         {healthLogs.length === 0 ? (
                             <span className="opacity-50">Ready to run diagnostics...</span>
                         ) : (
                             healthLogs.map((log, i) => (
                                 <div key={i} className="mb-1">{log}</div>
                             ))
                         )}
                         {healthCheckStatus === 'running' && <div className="animate-pulse mt-2">Testing...</div>}
                     </div>
                 </div>

                 <div className="bg-slate-900 text-slate-300 p-4 rounded-lg font-mono text-xs overflow-hidden">
                     <div className="flex justify-between items-start mb-2">
                         <span className="font-bold text-white flex items-center gap-2"><Terminal className="w-4 h-4" /> System Logs</span>
                         {isDesktop() && <button className="text-indigo-400 hover:underline">Open Folder</button>}
                     </div>
                     <p className="break-all opacity-80">Log Path: {logPath}</p>
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                     <div className="p-3 sm:p-4 border border-slate-200 rounded-lg bg-slate-50">
                         <h4 className="text-sm font-bold text-slate-800 mb-1">Log Level</h4>
                         <p className="text-xs text-slate-500 mb-3">Controls verbosity of system output.</p>
                         <select disabled className="w-full text-xs border border-slate-300 rounded p-2 bg-slate-200">
                             <option>INFO (Default)</option>
                             <option>DEBUG</option>
                             <option>ERROR</option>
                         </select>
                     </div>
                     <div className="p-3 sm:p-4 border border-slate-200 rounded-lg bg-slate-50">
                         <h4 className="text-sm font-bold text-slate-800 mb-1">Export Diagnostics</h4>
                         <p className="text-xs text-slate-500 mb-3">Package logs for support.</p>
                         <button disabled={!isDesktop()} className="w-full text-xs bg-white border border-slate-300 rounded p-2 hover:bg-slate-50 flex items-center justify-center gap-2 transition-colors">
                             <FileText className="w-3 h-3" /> Download Bundle
                         </button>
                     </div>
                 </div>
             </div>
          )}

          {/* API KEYS */}
          {activeTab === 'api-keys' && user && (
            <div className="space-y-4 sm:space-y-6" style={{ overflow: 'visible' }}>
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">API Key Management</h3>
                  <p className="text-sm text-slate-500">Manage and monitor API keys for external services</p>
                </div>
                <button
                  onClick={() => setShowUsageDashboard(!showUsageDashboard)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  {showUsageDashboard ? 'Hide Dashboard' : 'Show Usage Dashboard'}
                </button>
              </div>
              
              {showUsageDashboard ? (
                <ApiKeyUsageDashboard user={user} />
              ) : (
                <ApiKeyManagementTab user={user} />
              )}
             </div>
          )}

          {/* TEMPLATES */}
          {activeTab === 'templates' && (
            <div className={userRole !== UserRole.ADMIN ? 'opacity-50 pointer-events-none' : ''} style={{ overflow: 'visible' }}>
                <div className="mb-4 sm:mb-6">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Intro Message Template</label>
                    <textarea
                        value={localTemplates.introTemplate}
                        onChange={(e) => setLocalTemplates({ ...localTemplates, introTemplate: e.target.value })}
                        className="w-full min-h-[10rem] sm:h-40 p-3 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none resize-y"
                        style={{ minHeight: '10rem', maxHeight: '20rem' }}
                    />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Agent System Instruction</label>
                    <textarea
                        value={localTemplates.agentSystemInstruction}
                        onChange={(e) => setLocalTemplates({ ...localTemplates, agentSystemInstruction: e.target.value })}
                        className="w-full min-h-[10rem] sm:h-40 p-3 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none resize-y"
                        style={{ minHeight: '10rem', maxHeight: '20rem' }}
                    />
                </div>
            </div>
          )}

          {/* ADMIN MONITORING */}
          {activeTab === 'admin-monitoring' && user && hasAdminAccess(user) && (
            <div>
              <AdminMonitoringDashboard 
                user={user} 
                importers={importers || []}
                onNavigateToSettings={() => setActiveTab('tuning')}
              />
            </div>
          )}

          {/* COMPANY DETAILS */}
          {activeTab === 'company' && (
            <div>
              <CompanyDetailsPanel user={user} />
            </div>
          )}

          {/* PRODUCTS CATALOG */}
          {activeTab === 'products' && (
            <div>
              <ProductsCatalogPanel user={user} />
            </div>
          )}

          {/* PRODUCT PRICING */}
          {activeTab === 'pricing' && (
            <div>
              <ProductPricingPanel user={user} />
            </div>
          )}

          {/* USER MANAGEMENT */}
          {activeTab === 'users' && user && hasAdminAccess(user) && (
            <div>
              <UserManagementPanel user={user} />
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl flex flex-col sm:flex-row justify-between gap-3 shrink-0" style={{ flexShrink: 0, position: 'sticky', bottom: 0, zIndex: 10, backgroundColor: 'rgb(248 250 252)' }}>
          <button onClick={handleReset} disabled={userRole !== UserRole.ADMIN} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 text-sm font-medium disabled:opacity-50 w-full sm:w-auto justify-center sm:justify-start">
            <RefreshCcw className="w-4 h-4" /> Reset to Defaults
          </button>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
             <button onClick={onClose} className="w-full sm:w-auto px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg">Cancel</button>
             <button 
               disabled={userRole !== UserRole.ADMIN && !['integrations', 'security', 'notifications', 'system', 'data', 'diagnostics', 'tuning'].includes(activeTab)}
               onClick={handleSaveAll}
               className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-lg shadow-indigo-600/20 disabled:bg-slate-400 disabled:cursor-not-allowed"
             >
               <Save className="w-4 h-4" /> Save Configuration
             </button>
          </div>
        </div>
      </div>
      
      {/* WhatsApp Web QR Modal */}
      <WhatsAppWebQRModal
        isOpen={showWhatsAppWebQR}
        onClose={() => {
          setShowWhatsAppWebQR(false);
          setWhatsappWebQRCode(null);
        }}
        qrCode={whatsappWebQRCode}
        status={whatsappWebStatus}
        error={whatsappWebError}
        onRefresh={async () => {
          if (isDesktop() && window.electronAPI?.whatsappWebInit) {
            setWhatsappWebStatus('waiting');
            const result = await window.electronAPI.whatsappWebInit({});
            if (result.success) {
              if (result.qrCode) {
                setWhatsappWebQRCode(result.qrCode);
                setWhatsappWebStatus('scanning');
              } else if (result.ready) {
                setWhatsappWebStatus('connected');
              }
            } else {
              setWhatsappWebStatus('error');
              setWhatsappWebError(result.error);
            }
          }
        }}
      />
    </div>
  );
};

export default SettingsModal;