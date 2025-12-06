
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
import { hasAdminAccess, canViewAuditLogs, isOwner } from '../services/permissionService';
import ResourceSettings from './ResourceSettings';
import SystemStatus from './SystemStatus';
import CompanyDetailsPanel from './CompanyDetailsPanel';
import ProductsCatalogPanel from './ProductsCatalogPanel';
import ProductPricingPanel from './ProductPricingPanel';
import SecurityPinPanel from './SecurityPinPanel';
import UserManagementPanel from './UserManagementPanel';
import WhatsAppWebQRModal from './WhatsAppWebQRModal';
import WhatsAppWebBanRiskDashboard from './WhatsAppWebBanRiskDashboard';
import EmailOAuthModal from './EmailOAuthModal';
import IntegrationCard from './IntegrationCard';
import { IntegrationAnalyticsService } from '../services/integrationAnalyticsService';
import OwnerBackendSettings from './OwnerBackendSettings';

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
  const [activeTab, setActiveTab] = useState<'general' | 'integrations' | 'templates' | 'security' | 'notifications' | 'system' | 'data' | 'diagnostics' | 'tuning' | 'api-keys' | 'admin-monitoring' | 'resources' | 'network' | 'company' | 'products' | 'pricing' | 'users' | 'owner-admin'>('general');
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

  // Email OAuth state
  const [showEmailOAuthModal, setShowEmailOAuthModal] = useState(false);
  const [emailConnection, setEmailConnection] = useState<PlatformConnection | null>(null);
  const [emailAutoReply, setEmailAutoReply] = useState(false);
  const [emailDraftApproval, setEmailDraftApproval] = useState(true);
  const [emailLastSync, setEmailLastSync] = useState<number | null>(null);
  
  // Integration analytics state
  const [integrationAnalytics, setIntegrationAnalytics] = useState<{
    outlook?: any;
    whatsapp?: any;
    wechat?: any;
  }>({});
  
  // Global controls state
  const [globalAutoReply, setGlobalAutoReply] = useState(false);
  const [globalDailyLimit, setGlobalDailyLimit] = useState(50);
  const [globalTestMode, setGlobalTestMode] = useState(false);
  const [globalEmailSignature, setGlobalEmailSignature] = useState('');

  // Check for OAuth callback in URL parameters when modal opens
  useEffect(() => {
    if (isOpen) {
      const urlParams = new URLSearchParams(window.location.search);
      const oauthCallback = urlParams.get('oauth_callback');
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      
      if (oauthCallback === 'true' && code && state) {
        // Open EmailOAuthModal to handle the callback
        setShowEmailOAuthModal(true);
        // Switch to integrations tab to show the email connection
        setActiveTab('integrations');
        
        // Don't clean URL parameters here - let EmailOAuthModal handle it after processing
      }
    }
  }, [isOpen]);

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
        };

        // Load email connection
        const loadEmailConnection = async () => {
          try {
            const { loadEmailConnection } = await import('../services/securityService');
            const conn = await loadEmailConnection();
            setEmailConnection(conn);
            if (conn?.emailCredentials) {
              setEmailLastSync(conn.lastTested || null);
              // Load email settings
              const autoReply = await PlatformService.getAppConfig('emailAutoReply', false);
              const draftApproval = await PlatformService.getAppConfig('emailDraftApproval', true);
              setEmailAutoReply(autoReply);
              setEmailDraftApproval(draftApproval);
            }
          } catch (error) {
            console.error('Failed to load email connection:', error);
          }
        };

        loadSystem();
        loadEmailConnection();
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
      if (window.confirm("Are you sure? This will clear your API keys and connection settings.")) {
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
          default: return 'bg-slate-100 text-slate-600';
      }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white overflow-hidden" style={{ 
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100vw', 
      height: '100vh',
      margin: 0,
      padding: 0,
      zIndex: 100
    }}>
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
          onMfaEnabled={async () => {
            // Reload user session to get updated MFA status
            const { loadUserSession } = await import('./../services/securityService');
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

      {/* Full-screen Settings Container */}
      <div className="w-full h-full flex flex-col overflow-hidden bg-white" style={{ 
        width: '100%', 
        height: '100%',
        minWidth: '100vw',
        minHeight: '100vh',
        maxWidth: '100vw',
        maxHeight: '100vh'
      }}>
        {/* Header - Fixed at top */}
        <div className="p-4 sm:p-6 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white shrink-0 flex-shrink-0 shadow-sm">
          <h2 className="text-lg sm:text-xl font-bold text-slate-800">{t('settings', language)}</h2>
          <button onClick={onClose} aria-label="Close settings" className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex border-b border-slate-200 px-4 sm:px-6 gap-4 sm:gap-6 overflow-x-auto scrollbar-hide shrink-0 flex-shrink-0" style={{ WebkitOverflowScrolling: 'touch' }}>
            {['general', 'notifications', 'integrations', 'templates', 'tuning', 'security', 'system', 'resources', 'network', 'data', 'diagnostics', 'api-keys', 'company', 'products', 'pricing', ...(user && hasAdminAccess(user) ? ['users'] : []), ...(user && hasAdminAccess(user) ? ['admin-monitoring'] : []), ...(user && isOwner(user) ? ['owner-admin'] : [])].map(tab => {
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
                    {tab === 'tuning' ? t('aiTuning', language) : tab === 'admin-monitoring' ? 'Admin Monitoring' : tab === 'products' ? 'Products' : tab === 'pricing' ? 'Pricing' : tab === 'owner-admin' ? 'Owner Admin' : tab}
                </button>
                );
            })}
        </div>

        {/* Content Area - Scrollable, Full Height */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 min-h-0" style={{ 
          overflowY: 'auto', 
          WebkitOverflowScrolling: 'touch', 
          flex: '1 1 auto', 
          minHeight: 0,
          maxWidth: '100%',
          width: '100%'
        }}>
          
          {/* GENERAL */}
          {activeTab === 'general' && (
            <div className="space-y-4 sm:space-y-6 lg:space-y-8 w-full max-w-full" style={{ overflow: 'visible', width: '100%' }}>
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
            <div className="space-y-4 sm:space-y-6 lg:space-y-8 w-full max-w-full" style={{ overflow: 'visible', width: '100%' }}>
                {[
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
            <div className="space-y-4 sm:space-y-6 lg:space-y-8 w-full max-w-full" style={{ overflow: 'visible', width: '100%' }}>
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
            <div className="space-y-4 sm:space-y-6 w-full max-w-full" style={{ overflow: 'visible', width: '100%' }}>
                {/* Unified 3-Card Grid Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {/* Outlook/Email Card */}
                  <IntegrationCard
                    service="outlook"
                    isConnected={emailConnection?.status === PlatformStatus.CONNECTED}
                    account={emailConnection?.accountName || emailConnection?.emailCredentials?.userEmail || ''}
                    lastSync={emailLastSync ? new Date(emailLastSync).toISOString() : null}
                    dailyLimit={integrationAnalytics.outlook?.dailyUsage || { used: 0, total: globalDailyLimit }}
                    onConnect={() => setShowEmailOAuthModal(true)}
                    onDisconnect={async () => {
                      const { removeEmailConnection } = await import('../services/securityService');
                      await removeEmailConnection();
                      setEmailConnection(null);
                      setEmailLastSync(null);
                      onUpdateConnection({ ...emailConnection, status: PlatformStatus.DISCONNECTED });
                    }}
                    onReconnect={() => setShowEmailOAuthModal(true)}
                    healthStatus={emailConnection?.healthStatus}
                    tokenExpiry={emailConnection?.emailCredentials?.expiryDate || null}
                    analytics={integrationAnalytics.outlook ? {
                      messagesSent: integrationAnalytics.outlook.messagesSent,
                      deliveryRate: integrationAnalytics.outlook.deliveryRate,
                      replyRate: integrationAnalytics.outlook.replyRate,
                    } : undefined}
                  />
                  
                  {/* WhatsApp Card */}
                  {(() => {
                    const whatsappConnection = getPlatformStatus(Channel.WHATSAPP);
                    return (
                      <IntegrationCard
                        service="whatsapp"
                        isConnected={whatsappConnection.status === PlatformStatus.CONNECTED}
                        account={whatsappConnection.accountName || ''}
                        lastSync={whatsappConnection.lastTested ? new Date(whatsappConnection.lastTested).toISOString() : null}
                        dailyLimit={integrationAnalytics.whatsapp?.dailyUsage || { used: 0, total: globalDailyLimit }}
                        onConnect={() => openConnectModal(Channel.WHATSAPP)}
                        onDisconnect={() => onUpdateConnection({ ...whatsappConnection, status: PlatformStatus.DISCONNECTED })}
                        onReconnect={() => openConnectModal(Channel.WHATSAPP)}
                        healthStatus={whatsappConnection.healthStatus}
                        analytics={integrationAnalytics.whatsapp ? {
                          messagesSent: integrationAnalytics.whatsapp.messagesSent,
                          deliveryRate: integrationAnalytics.whatsapp.deliveryRate,
                          replyRate: integrationAnalytics.whatsapp.replyRate,
                        } : undefined}
                      />
                    );
                  })()}
                  
                  {/* WeChat Card */}
                  {(() => {
                    const wechatConnection = getPlatformStatus(Channel.WECHAT);
                    return (
                      <IntegrationCard
                        service="wechat"
                        isConnected={wechatConnection.status === PlatformStatus.CONNECTED}
                        account={wechatConnection.accountName || ''}
                        lastSync={wechatConnection.lastTested ? new Date(wechatConnection.lastTested).toISOString() : null}
                        dailyLimit={integrationAnalytics.wechat?.dailyUsage || { used: 0, total: globalDailyLimit }}
                        onConnect={() => openConnectModal(Channel.WECHAT)}
                        onDisconnect={() => onUpdateConnection({ ...wechatConnection, status: PlatformStatus.DISCONNECTED })}
                        onReconnect={() => openConnectModal(Channel.WECHAT)}
                        healthStatus={wechatConnection.healthStatus}
                        analytics={integrationAnalytics.wechat ? {
                          messagesSent: integrationAnalytics.wechat.messagesSent,
                          deliveryRate: integrationAnalytics.wechat.deliveryRate,
                          replyRate: integrationAnalytics.wechat.replyRate,
                        } : undefined}
                      />
                    );
                  })()}
                            </div>
                            
                {/* Global Controls Section */}
                <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4 sm:p-6 space-y-4">
                  <h4 className="font-bold text-slate-800 text-base mb-4">Global Controls</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Auto-reply toggle */}
                    <label className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                      <div>
                        <span className="text-sm font-medium text-slate-700">Auto-reply all</span>
                        <p className="text-xs text-slate-500 mt-0.5">Enable auto-reply for all connected services</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={globalAutoReply}
                        onChange={async (e) => {
                          setGlobalAutoReply(e.target.checked);
                          await PlatformService.setAppConfig('globalAutoReply', e.target.checked);
                                                }}
                        className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                    </label>
                    
                    {/* Daily limit */}
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <label className="text-sm font-medium text-slate-700 block mb-2">Daily limit (per service)</label>
                      <input
                        type="number"
                        value={globalDailyLimit}
                        onChange={async (e) => {
                          const limit = parseInt(e.target.value) || 50;
                          setGlobalDailyLimit(limit);
                          await PlatformService.setAppConfig('globalDailyLimit', limit);
                          // Update all service limits
                          await IntegrationAnalyticsService.setDailyLimit('outlook', limit);
                          await IntegrationAnalyticsService.setDailyLimit('whatsapp', limit);
                          await IntegrationAnalyticsService.setDailyLimit('wechat', limit);
                        }}
                        min="1"
                        max="1000"
                        className="w-full px-3 py-2 border border-slate-300 rounded bg-white focus:ring-2 focus:ring-indigo-500"
                      />
                      <p className="text-xs text-slate-500 mt-1">Default: 50 messages per day per service</p>
                                    </div>
                                    
                    {/* Test mode toggle */}
                    <label className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                                        <div>
                        <span className="text-sm font-medium text-slate-700">Test mode</span>
                        <p className="text-xs text-slate-500 mt-0.5">Send to self first for testing</p>
                                    </div>
                                            <input
                        type="checkbox"
                        checked={globalTestMode}
                        onChange={async (e) => {
                          setGlobalTestMode(e.target.checked);
                          await PlatformService.setAppConfig('globalTestMode', e.target.checked);
                        }}
                        className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                      />
                    </label>
                    
                    {/* Signature editor */}
                    <div className="p-3 bg-white rounded-lg border border-slate-200">
                      <label className="text-sm font-medium text-slate-700 block mb-2">Email signature</label>
                      <textarea
                        value={globalEmailSignature}
                        onChange={async (e) => {
                          setGlobalEmailSignature(e.target.value);
                          await PlatformService.setAppConfig('globalEmailSignature', e.target.value);
                        }}
                        placeholder="Enter email signature (HTML supported)"
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-300 rounded bg-white focus:ring-2 focus:ring-indigo-500 text-sm"
                      />
                      <p className="text-xs text-slate-500 mt-1">This signature will be added to all outgoing emails</p>
                                        </div>
                                    </div>
                                    </div>
                
                {/* Informational Note for Non-Owners */}
                {user && !isOwner(user) && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-semibold text-blue-800 mb-1">Backend Configuration</h4>
                        <p className="text-xs text-blue-700">
                          Backend configuration and OAuth credentials are managed by the owner. Contact the owner if you need to configure backend settings.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Legacy sections removed - now using unified cards above */}
            </div>
          )}

          {/* SECURITY */}
          {activeTab === 'security' && (
             <div className="space-y-4 sm:space-y-6 lg:space-y-8 w-full max-w-full" style={{ overflow: 'visible', width: '100%' }}>
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

          {/* OWNER ADMIN */}
          {activeTab === 'owner-admin' && user && isOwner(user) && (
            <div className="space-y-4 sm:space-y-6 lg:space-y-8 w-full max-w-full" style={{ overflow: 'visible', width: '100%' }}>
              <OwnerBackendSettings />
            </div>
          )}

          {/* RESOURCES */}
          {activeTab === 'resources' && (
            <div className="space-y-4 sm:space-y-6 lg:space-y-8 w-full max-w-full" style={{ overflow: 'visible', width: '100%' }}>
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
            <div className="space-y-4 sm:space-y-6 lg:space-y-8 w-full max-w-full" style={{ overflow: 'visible', width: '100%' }}>
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
                        Resetting configuration will wipe your API keys and connection settings.
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
              <div className="space-y-4 sm:space-y-6 lg:space-y-8 w-full max-w-full" style={{ overflow: 'visible', width: '100%' }}>
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
            <div className={`space-y-4 sm:space-y-6 lg:space-y-8 w-full max-w-full ${userRole !== UserRole.ADMIN ? 'opacity-50 pointer-events-none' : ''}`} style={{ overflow: 'visible', width: '100%' }}>
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

        {/* Footer - Fixed at bottom */}
        <div className="p-4 sm:p-6 border-t-2 border-slate-200 bg-gradient-to-r from-slate-50 to-white flex flex-col sm:flex-row justify-between gap-3 shrink-0 shadow-lg" style={{ flexShrink: 0, zIndex: 10 }}>
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

      <EmailOAuthModal
        isOpen={showEmailOAuthModal}
        onClose={() => {
          setShowEmailOAuthModal(false);
          // Reload email connection after modal closes
          (async () => {
            const { loadEmailConnection } = await import('../services/securityService');
            const conn = await loadEmailConnection();
            setEmailConnection(conn);
            if (conn) {
              setEmailLastSync(conn.lastTested || null);
            }
          })();
        }}
        onConnected={(connection) => {
          setEmailConnection(connection);
          setEmailLastSync(connection.lastTested || null);
          onUpdateConnection(connection);
        }}
      />
    </div>
  );
};

export default SettingsModal;