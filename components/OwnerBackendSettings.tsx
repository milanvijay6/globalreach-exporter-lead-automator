import React, { useState, useEffect } from 'react';
import { Lock, Server, Mail, MessageCircle, Copy, CheckCircle, Eye, EyeOff, Save, AlertCircle, Link as LinkIcon } from 'lucide-react';
import { PlatformService } from '../services/platformService';

interface OwnerBackendSettingsProps {
  // This component manages its own state internally
}

const OwnerBackendSettings: React.FC<OwnerBackendSettingsProps> = () => {
  // OAuth Configuration State
  const [outlookClientId, setOutlookClientId] = useState<string>('');
  const [outlookClientSecret, setOutlookClientSecret] = useState<string>('');
  const [outlookTenantId, setOutlookTenantId] = useState<string>('common');
  const [gmailClientId, setGmailClientId] = useState<string>('');
  const [gmailClientSecret, setGmailClientSecret] = useState<string>('');
  const [cloudflareWorkerUrl, setCloudflareWorkerUrl] = useState<string>('');
  const [cloudflarePagesUrl, setCloudflarePagesUrl] = useState<string>('');
  const [showOutlookSecret, setShowOutlookSecret] = useState<boolean>(false);
  const [showGmailSecret, setShowGmailSecret] = useState<boolean>(false);
  const [oauthSaveStatus, setOauthSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [oauthSaveMessage, setOauthSaveMessage] = useState<string>('');
  
  // WeChat Integration State
  const [wechatAppId, setWechatAppId] = useState<string>('');
  const [wechatAppSecret, setWechatAppSecret] = useState<string>('');
  const [wechatWebhookToken, setWechatWebhookToken] = useState<string>('');
  const [showWechatSecret, setShowWechatSecret] = useState<boolean>(false);
  
  // Callback URL State
  const [selectedCallbackService, setSelectedCallbackService] = useState<'email-outlook' | 'email-gmail' | 'whatsapp' | 'wechat'>('email-outlook');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  
  // Cloudflare URL state
  const [cloudflareWorkerUrlFromBackend, setCloudflareWorkerUrlFromBackend] = useState<string>('');
  const [isCloudflareUrlReadOnly, setIsCloudflareUrlReadOnly] = useState<boolean>(false);
  const [isEditingCloudflareUrl, setIsEditingCloudflareUrl] = useState<boolean>(false);

  // Load configuration on mount
  useEffect(() => {
    const loadConfiguration = async () => {
      try {
        // Load OAuth configuration
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
        
        // Also try loading from individual config keys
        const savedClientId = await PlatformService.getAppConfig('outlookClientId', '');
        const savedClientSecret = await PlatformService.getAppConfig('outlookClientSecret', '');
        const savedTenantId = await PlatformService.getAppConfig('outlookTenantId', '');
        if (savedClientId && !outlookClientId) {
          setOutlookClientId(savedClientId);
          setOutlookClientSecret(savedClientSecret);
          setOutlookTenantId(savedTenantId || 'common');
        }
        
        // Load Gmail credentials from individual config keys as fallback
        const savedGmailClientId = await PlatformService.getAppConfig('gmailClientId', '');
        const savedGmailClientSecret = await PlatformService.getAppConfig('gmailClientSecret', '');
        if (savedGmailClientId && !gmailClientId) {
          setGmailClientId(savedGmailClientId);
          setGmailClientSecret(savedGmailClientSecret);
        }
        
        // Load Cloudflare Worker URL (try API first for web, then local config)
        try {
          const { apiService } = await import('../services/apiService');
          const workerResponse = await apiService.get<{ success: boolean; url?: string }>('/api/cloudflare-worker/url');
          if (workerResponse.success && workerResponse.url) {
            setCloudflareWorkerUrlFromBackend(workerResponse.url);
            setCloudflareWorkerUrl(workerResponse.url);
            setIsCloudflareUrlReadOnly(true);
            // Also save to local config for offline access
            await PlatformService.setAppConfig('cloudflareWorkerUrl', workerResponse.url);
          } else {
            // Fallback to local config
            const savedWorkerUrl = await PlatformService.getAppConfig('cloudflareWorkerUrl', '');
            if (savedWorkerUrl) {
              setCloudflareWorkerUrl(savedWorkerUrl);
            }
          }
        } catch (error) {
          // Fallback to local config if API fails
          const savedWorkerUrl = await PlatformService.getAppConfig('cloudflareWorkerUrl', '');
          if (savedWorkerUrl) {
            setCloudflareWorkerUrl(savedWorkerUrl);
          }
        }
        
        // Load Cloudflare Pages URL
        try {
          const { apiService } = await import('../services/apiService');
          const pagesResponse = await apiService.get<{ success: boolean; url?: string }>('/api/cloudflare-pages/url');
          if (pagesResponse.success && pagesResponse.url) {
            setCloudflarePagesUrl(pagesResponse.url);
            await PlatformService.setAppConfig('cloudflarePagesUrl', pagesResponse.url);
          } else {
            const savedPagesUrl = await PlatformService.getAppConfig('cloudflarePagesUrl', '');
            if (savedPagesUrl) {
              setCloudflarePagesUrl(savedPagesUrl);
            } else if (typeof window !== 'undefined' && (window.location.hostname.includes('pages.dev') || window.location.hostname.includes('cloudflarepages.com'))) {
              // If already on Cloudflare Pages, use current URL
              setCloudflarePagesUrl(window.location.origin);
            }
          }
        } catch (error) {
          const savedPagesUrl = await PlatformService.getAppConfig('cloudflarePagesUrl', '');
          if (savedPagesUrl) {
            setCloudflarePagesUrl(savedPagesUrl);
          } else if (typeof window !== 'undefined' && (window.location.hostname.includes('pages.dev') || window.location.hostname.includes('cloudflarepages.com'))) {
            setCloudflarePagesUrl(window.location.origin);
          }
        }
        
        // Load WeChat credentials
        const savedWechatAppId = await PlatformService.getAppConfig('wechatAppId', '');
        const savedWechatAppSecret = await PlatformService.getAppConfig('wechatAppSecret', '');
        const savedWechatWebhookToken = await PlatformService.getAppConfig('wechatWebhookToken', '');
        if (savedWechatAppId) {
          setWechatAppId(savedWechatAppId);
        }
        if (savedWechatAppSecret) {
          setWechatAppSecret(savedWechatAppSecret);
        }
        if (savedWechatWebhookToken) {
          setWechatWebhookToken(savedWechatWebhookToken);
        }
      } catch (e) {
        console.error('Failed to load backend configuration:', e);
      }
    };

    loadConfiguration();
  }, []);

  // Generate callback URL based on selected service
  const getCallbackUrl = (service: typeof selectedCallbackService): string => {
    const baseUrl = cloudflareWorkerUrl || cloudflarePagesUrl || '';
    if (!baseUrl) return '';
    
    const callbackPaths: Record<typeof service, string> = {
      'email-outlook': '/auth/outlook/callback',
      'email-gmail': '/auth/gmail/callback',
      'whatsapp': '/webhooks/whatsapp',
      'wechat': '/webhooks/wechat',
    };
    
    return `${baseUrl}${callbackPaths[service]}`;
  };

  // Copy to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUrl(text);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  // Save OAuth configuration
  const handleSaveOAuth = async () => {
    setOauthSaveStatus('saving');
    try {
      const config = {
        outlook: {
          clientId: outlookClientId,
          clientSecret: outlookClientSecret,
          tenantId: outlookTenantId || 'common',
        },
        gmail: {
          clientId: gmailClientId,
          clientSecret: gmailClientSecret,
        },
      };
      if ((window as any).electronAPI?.setConfig) {
        await (window as any).electronAPI.setConfig('oauthConfig', JSON.stringify(config));
      }
      await PlatformService.setAppConfig('outlookClientId', outlookClientId);
      await PlatformService.setAppConfig('outlookClientSecret', outlookClientSecret);
      await PlatformService.setAppConfig('outlookTenantId', outlookTenantId || 'common');
      await PlatformService.setAppConfig('gmailClientId', gmailClientId);
      await PlatformService.setAppConfig('gmailClientSecret', gmailClientSecret);
      await PlatformService.setAppConfig('cloudflareWorkerUrl', cloudflareWorkerUrl || '');
      await PlatformService.setAppConfig('cloudflarePagesUrl', cloudflarePagesUrl || '');
      setOauthSaveStatus('success');
      setOauthSaveMessage('OAuth configuration saved successfully');
      setTimeout(() => {
        setOauthSaveStatus('idle');
        setOauthSaveMessage('');
      }, 3000);
    } catch (error: any) {
      setOauthSaveStatus('error');
      setOauthSaveMessage(error.message || 'Failed to save OAuth configuration');
    }
  };

  // Save WeChat configuration
  const handleSaveWeChat = async () => {
    try {
      await PlatformService.setAppConfig('wechatAppId', wechatAppId);
      await PlatformService.setAppConfig('wechatAppSecret', wechatAppSecret);
      await PlatformService.setAppConfig('wechatWebhookToken', wechatWebhookToken);
      setOauthSaveStatus('success');
      setOauthSaveMessage('WeChat configuration saved successfully');
      setTimeout(() => {
        setOauthSaveStatus('idle');
        setOauthSaveMessage('');
      }, 3000);
    } catch (error: any) {
      setOauthSaveStatus('error');
      setOauthSaveMessage(error.message || 'Failed to save WeChat configuration');
    }
  };

  // Deploy Cloudflare Worker
  const handleDeployWorker = async () => {
    setOauthSaveStatus('saving');
    setOauthSaveMessage('Deploying Cloudflare Worker...');
    try {
      const { apiService } = await import('../services/apiService');
      const response = await apiService.post<{ success: boolean; url?: string; error?: string }>('/api/cloudflare-worker/deploy', {});
      if (response.success && response.url) {
        setCloudflareWorkerUrl(response.url);
        setCloudflareWorkerUrlFromBackend(response.url);
        setIsCloudflareUrlReadOnly(true);
        await PlatformService.setAppConfig('cloudflareWorkerUrl', response.url);
        setOauthSaveStatus('success');
        setOauthSaveMessage('Worker deployed successfully!');
      } else {
        setOauthSaveStatus('error');
        setOauthSaveMessage(response.error || 'Failed to deploy worker');
      }
      setTimeout(() => {
        setOauthSaveStatus('idle');
        setOauthSaveMessage('');
      }, 5000);
    } catch (error: any) {
      setOauthSaveStatus('error');
      setOauthSaveMessage(error.message || 'Failed to deploy worker');
      setTimeout(() => {
        setOauthSaveStatus('idle');
        setOauthSaveMessage('');
      }, 5000);
    }
  };

  // Reset Cloudflare Worker
  const handleResetWorker = async () => {
    setOauthSaveStatus('saving');
    setOauthSaveMessage('Resetting Cloudflare Worker...');
    try {
      const { apiService } = await import('../services/apiService');
      const response = await apiService.post<{ success: boolean; url?: string; error?: string }>('/api/cloudflare-worker/reset', {});
      if (response.success && response.url) {
        setCloudflareWorkerUrl(response.url);
        setCloudflareWorkerUrlFromBackend(response.url);
        setIsCloudflareUrlReadOnly(true);
        await PlatformService.setAppConfig('cloudflareWorkerUrl', response.url);
        setOauthSaveStatus('success');
        setOauthSaveMessage('New worker URL generated!');
      } else {
        setOauthSaveStatus('error');
        setOauthSaveMessage(response.error || 'Failed to reset worker');
      }
      setTimeout(() => {
        setOauthSaveStatus('idle');
        setOauthSaveMessage('');
      }, 5000);
    } catch (error: any) {
      setOauthSaveStatus('error');
      setOauthSaveMessage(error.message || 'Failed to reset worker');
      setTimeout(() => {
        setOauthSaveStatus('idle');
        setOauthSaveMessage('');
      }, 5000);
    }
  };

  const currentCallbackUrl = getCallbackUrl(selectedCallbackService);
  const allCallbackUrls = {
    'email-outlook': getCallbackUrl('email-outlook'),
    'email-gmail': getCallbackUrl('email-gmail'),
    'whatsapp': getCallbackUrl('whatsapp'),
    'wechat': getCallbackUrl('wechat'),
  };

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Infrastructure Section */}
      <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4 sm:p-6 space-y-4">
        <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Server className="w-5 h-5" /> Infrastructure
        </h3>
        
        {/* Cloudflare Worker URL */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 block">Cloudflare Worker URL</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={cloudflareWorkerUrl}
              onChange={(e) => {
                setCloudflareWorkerUrl(e.target.value);
                setIsCloudflareUrlReadOnly(false);
              }}
              disabled={isCloudflareUrlReadOnly && !isEditingCloudflareUrl}
              placeholder="https://your-worker.workers.dev"
              className="flex-1 px-3 py-2 border border-slate-300 rounded bg-white focus:ring-2 focus:ring-indigo-500 text-sm disabled:bg-slate-100"
            />
            {isCloudflareUrlReadOnly && !isEditingCloudflareUrl && (
              <button
                onClick={() => setIsEditingCloudflareUrl(true)}
                className="px-3 py-2 border border-slate-300 rounded hover:bg-slate-50 text-sm"
              >
                Edit
              </button>
            )}
            {isEditingCloudflareUrl && (
              <button
                onClick={() => {
                  setIsEditingCloudflareUrl(false);
                  setIsCloudflareUrlReadOnly(true);
                }}
                className="px-3 py-2 border border-slate-300 rounded hover:bg-slate-50 text-sm"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleDeployWorker}
              className="px-3 py-2 bg-green-600 text-white text-sm font-semibold rounded hover:bg-green-700 transition-colors whitespace-nowrap"
              title="Deploy or update Cloudflare Worker"
            >
              Deploy
            </button>
            {cloudflareWorkerUrl && (
              <button
                onClick={handleResetWorker}
                className="px-3 py-2 bg-orange-600 text-white text-sm font-semibold rounded hover:bg-orange-700 transition-colors whitespace-nowrap"
                title="Generate new worker URL"
              >
                Reset
              </button>
            )}
          </div>
          {cloudflareWorkerUrlFromBackend && (
            <p className="text-xs text-slate-500">
              ℹ️ URL loaded from backend deployment. Click "Edit" to manually override.
            </p>
          )}
          {!cloudflareWorkerUrl && (
            <p className="text-xs text-slate-500">
              Click "Deploy" to automatically create a permanent OAuth callback URL
            </p>
          )}
        </div>

        {/* Cloudflare Pages URL */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-700 block">Cloudflare Pages URL</label>
          <input
            type="text"
            value={cloudflarePagesUrl}
            onChange={(e) => setCloudflarePagesUrl(e.target.value)}
            placeholder="https://your-app.pages.dev"
            className="w-full px-3 py-2 border border-slate-300 rounded bg-white focus:ring-2 focus:ring-indigo-500 text-sm"
          />
          <p className="text-xs text-slate-500">
            Your Cloudflare Pages deployment URL (if applicable)
          </p>
        </div>
      </div>

      {/* Callback URLs Matrix */}
      <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4 sm:p-6 space-y-4">
        <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
          <LinkIcon className="w-5 h-5" /> Callback URLs
        </h3>
        
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-2">Select Service</label>
            <select
              value={selectedCallbackService}
              onChange={(e) => setSelectedCallbackService(e.target.value as typeof selectedCallbackService)}
              className="w-full px-3 py-2 border border-slate-300 rounded bg-white focus:ring-2 focus:ring-indigo-500 text-sm"
            >
              <option value="email-outlook">Email (Outlook)</option>
              <option value="email-gmail">Email (Gmail)</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="wechat">WeChat</option>
            </select>
          </div>

          {/* Callback URL Matrix Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">Service</th>
                  <th className="px-4 py-2 text-left font-semibold text-slate-700">Callback URL</th>
                  <th className="px-4 py-2 text-center font-semibold text-slate-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(allCallbackUrls).map(([service, url]) => {
                  const serviceLabels: Record<string, string> = {
                    'email-outlook': 'Email (Outlook)',
                    'email-gmail': 'Email (Gmail)',
                    'whatsapp': 'WhatsApp',
                    'wechat': 'WeChat',
                  };
                  return (
                    <tr key={service} className="border-t border-slate-200">
                      <td className="px-4 py-2 text-slate-700">{serviceLabels[service]}</td>
                      <td className="px-4 py-2">
                        <code className="text-xs bg-slate-50 px-2 py-1 rounded text-slate-800 break-all">
                          {url || 'No base URL configured'}
                        </code>
                      </td>
                      <td className="px-4 py-2 text-center">
                        {url && (
                          <button
                            onClick={() => copyToClipboard(url)}
                            className="flex items-center gap-1 px-3 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors mx-auto"
                          >
                            {copiedUrl === url ? (
                              <>
                                <CheckCircle className="w-3 h-3" /> Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" /> Copy
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!cloudflareWorkerUrl && !cloudflarePagesUrl && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
              <p className="text-xs text-yellow-800">
                ⚠️ Configure Cloudflare Worker URL or Cloudflare Pages URL to generate callback URLs.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Email OAuth Configuration */}
      <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4 sm:p-6 space-y-4">
        <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5" /> Email OAuth Configuration
        </h3>

        {/* Outlook OAuth */}
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-slate-700">Outlook OAuth Configuration</h4>
          <p className="text-xs text-slate-500">
            Configure your Outlook OAuth credentials to connect your email account.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded p-2">
            <p className="text-xs text-blue-800 font-semibold mb-1">⚠️ Important Azure Configuration:</p>
            <p className="text-xs text-blue-700">
              In Azure Portal → Authentication → Platform configurations, make sure your redirect URI 
              (<code className="bg-blue-100 px-1 rounded">{cloudflareWorkerUrl || cloudflarePagesUrl || 'http://localhost:4000'}/auth/outlook/callback</code>) 
              is configured as <strong>"Web"</strong> platform type, NOT "Single-page application".
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <div>
              <label className="text-slate-600 block mb-1">Client ID</label>
              <input
                type="text"
                value={outlookClientId}
                onChange={(e) => setOutlookClientId(e.target.value)}
                placeholder="Enter Outlook Client ID"
                className="w-full px-3 py-2 border border-slate-300 rounded bg-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-slate-600 block mb-1">Client Secret <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <input
                  type={showOutlookSecret ? "text" : "password"}
                  value={outlookClientSecret}
                  onChange={(e) => setOutlookClientSecret(e.target.value)}
                  placeholder="Enter Secret VALUE (not Secret ID)"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded bg-white focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={() => setShowOutlookSecret(!showOutlookSecret)}
                  className="px-3 py-2 border border-slate-300 rounded hover:bg-slate-50"
                >
                  {showOutlookSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                ⚠️ Important: Enter the Secret <strong>VALUE</strong> (long string), not the Secret ID (GUID).
                <br />
                In Azure Portal: Certificates & secrets → Copy the <strong>Value</strong> column (not the Secret ID).
              </p>
            </div>
            <div>
              <label className="text-slate-600 block mb-1">Tenant ID (optional)</label>
              <input
                type="text"
                value={outlookTenantId}
                onChange={(e) => setOutlookTenantId(e.target.value)}
                placeholder="common, organizations, or your tenant GUID"
                className="w-full px-3 py-2 border border-slate-300 rounded bg-white focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Use "common" for personal accounts, "organizations" for work accounts, or your tenant GUID
              </p>
            </div>
          </div>
        </div>

        {/* Gmail OAuth */}
        <div className="border-t border-slate-200 pt-4 space-y-3">
          <h4 className="text-sm font-bold text-slate-700">Gmail OAuth Configuration</h4>
          <p className="text-xs text-slate-500">
            Configure your Gmail OAuth credentials to connect your Gmail account.
          </p>
          <div className="bg-green-50 border border-green-200 rounded p-2">
            <p className="text-xs text-green-800 font-semibold mb-1">ℹ️ Google Cloud Console Setup:</p>
            <p className="text-xs text-green-700">
              In Google Cloud Console → APIs & Services → Credentials, make sure your redirect URI 
              (<code className="bg-green-100 px-1 rounded">{cloudflareWorkerUrl || cloudflarePagesUrl || 'http://localhost:4000'}/auth/gmail/callback</code>) 
              is added to your OAuth 2.0 Client ID.
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <div>
              <label className="text-slate-600 block mb-1">Gmail Client ID</label>
              <input
                type="text"
                value={gmailClientId}
                onChange={(e) => setGmailClientId(e.target.value)}
                placeholder="Enter Gmail Client ID (e.g., xxx.apps.googleusercontent.com)"
                className="w-full px-3 py-2 border border-slate-300 rounded bg-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-slate-600 block mb-1">Gmail Client Secret <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <input
                  type={showGmailSecret ? "text" : "password"}
                  value={gmailClientSecret}
                  onChange={(e) => setGmailClientSecret(e.target.value)}
                  placeholder="Enter Gmail Client Secret"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded bg-white focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={() => setShowGmailSecret(!showGmailSecret)}
                  className="px-3 py-2 border border-slate-300 rounded hover:bg-slate-50"
                >
                  {showGmailSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Get your Client ID and Secret from Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client ID.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleSaveOAuth}
          className="w-full px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" /> Save OAuth Configuration
        </button>
        {oauthSaveStatus !== 'idle' && (
          <p className={`text-sm ${
            oauthSaveStatus === 'success' ? 'text-green-600' : 'text-red-600'
          }`}>
            {oauthSaveMessage}
          </p>
        )}
      </div>

      {/* WeChat Integration */}
      <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4 sm:p-6 space-y-4">
        <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
          <MessageCircle className="w-5 h-5" /> WeChat Integration
        </h3>
        
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            Configure your WeChat Official Account credentials for webhook integration.
          </p>
          <div className="space-y-2 text-sm">
            <div>
              <label className="text-slate-600 block mb-1">App ID <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={wechatAppId}
                onChange={(e) => setWechatAppId(e.target.value)}
                placeholder="wx1234567890abcdef"
                className="w-full px-3 py-2 border border-slate-300 rounded bg-white focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Found in WeChat Official Account Platform → Development → Basic Configuration
              </p>
            </div>
            <div>
              <label className="text-slate-600 block mb-1">App Secret <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <input
                  type={showWechatSecret ? "text" : "password"}
                  value={wechatAppSecret}
                  onChange={(e) => setWechatAppSecret(e.target.value)}
                  placeholder="Enter App Secret"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded bg-white focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={() => setShowWechatSecret(!showWechatSecret)}
                  className="px-3 py-2 border border-slate-300 rounded hover:bg-slate-50"
                >
                  {showWechatSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Keep this secret secure. Reset it if exposed.
              </p>
            </div>
            <div>
              <label className="text-slate-600 block mb-1">Webhook Token</label>
              <input
                type="text"
                value={wechatWebhookToken}
                onChange={(e) => setWechatWebhookToken(e.target.value)}
                placeholder="globalreach_secret_token"
                className="w-full px-3 py-2 border border-slate-300 rounded bg-white focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                Token used for webhook verification. Must match the token configured in WeChat Official Account Platform.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleSaveWeChat}
          className="w-full px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" /> Save WeChat Configuration
        </button>
      </div>
    </div>
  );
};

export default OwnerBackendSettings;



