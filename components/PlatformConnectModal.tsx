
import React, { useState, useEffect } from 'react';
import { X, Smartphone, CheckCircle, Loader2, RefreshCw, Mail, Globe, Server, MessageCircle, AlertCircle, Key } from 'lucide-react';
import { Channel, PlatformStatus, PlatformConnection, WhatsAppCredentials, EmailCredentials, WeChatCredentials } from '../types';
import { WhatsAppService } from '../services/whatsappService';
import { EmailService } from '../services/emailService';
import { WeChatService } from '../services/wechatService';
import { PlatformService } from '../services/platformService';

interface PlatformConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: Channel;
  onLink: (connection: PlatformConnection) => void;
}

const PlatformConnectModal: React.FC<PlatformConnectModalProps> = ({ isOpen, onClose, channel, onLink }) => {
  const [step, setStep] = useState<'provider-select' | 'credentials' | 'testing' | 'success' | 'error'>('provider-select');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [emailProvider, setEmailProvider] = useState<'google' | 'microsoft' | 'custom' | null>(null);
  
  // WhatsApp credentials state
  const [accessToken, setAccessToken] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [businessAccountId, setBusinessAccountId] = useState('');
  const [webhookVerifyToken, setWebhookVerifyToken] = useState('');
  
  // WeChat credentials state
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [wechatWebhookToken, setWechatWebhookToken] = useState('');
  
  const [errorMessage, setErrorMessage] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; phoneNumber?: string; accountName?: string; error?: string } | null>(null);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      if (channel === Channel.EMAIL) {
        setStep('provider-select');
      } else if (channel === Channel.WHATSAPP) {
        setStep('credentials');
        loadExistingCredentials();
      } else if (channel === Channel.WECHAT) {
        setStep('credentials');
        loadExistingCredentials();
      } else {
        setStep('provider-select');
        setTimeout(() => {
          setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=GlobalReachAuth-${channel}-${Date.now()}`);
        }, 1500);
      }
      setErrorMessage('');
      setTestResult(null);
    }
  }, [isOpen, channel]);

  const loadExistingCredentials = async () => {
    // Try to load from platform connections
    try {
      const { loadPlatformConnections } = await import('../services/securityService');
      const connections = await loadPlatformConnections();
      
      if (channel === Channel.WHATSAPP) {
        const whatsappConn = connections.find(c => c.channel === Channel.WHATSAPP && c.whatsappCredentials);
        if (whatsappConn?.whatsappCredentials) {
          const creds = whatsappConn.whatsappCredentials;
          setAccessToken(creds.accessToken);
          setPhoneNumberId(creds.phoneNumberId);
          setBusinessAccountId(creds.businessAccountId);
          setWebhookVerifyToken(creds.webhookVerifyToken);
        }
      } else if (channel === Channel.WECHAT) {
        const wechatConn = connections.find(c => c.channel === Channel.WECHAT && c.wechatCredentials);
        if (wechatConn?.wechatCredentials) {
          const creds = wechatConn.wechatCredentials;
          setAppId(creds.appId);
          setAppSecret(''); // Don't load secret for security
          setWechatWebhookToken(creds.webhookToken || '');
        }
      }
    } catch (e) {
      console.error('Failed to load existing credentials', e);
    }
  };

  const handleTestConnection = async () => {
    if (channel === Channel.WHATSAPP) {
      if (!accessToken.trim() || !phoneNumberId.trim()) {
        setErrorMessage('Please enter Access Token and Phone Number ID');
        return;
      }

      setStep('testing');
      setErrorMessage('');
      setTestResult(null);

      try {
        const result = await WhatsAppService.testConnection(phoneNumberId, accessToken);
        setTestResult(result);
        
        if (result.success) {
          setTimeout(() => {
            handleConnect();
          }, 1500);
        } else {
          setStep('credentials');
          setErrorMessage(result.error || 'Connection test failed');
        }
      } catch (error: any) {
        setStep('credentials');
        setErrorMessage(error.message || 'Failed to test connection');
        setTestResult({ success: false, error: error.message });
      }
    } else if (channel === Channel.WECHAT) {
      if (!appId.trim() || !appSecret.trim()) {
        setErrorMessage('Please enter AppID and AppSecret');
        return;
      }

      setStep('testing');
      setErrorMessage('');
      setTestResult(null);

      try {
        const credentials: WeChatCredentials = {
          appId,
          appSecret,
          webhookToken: wechatWebhookToken || 'globalreach_secret_token',
        };
        const result = await WeChatService.testConnection(credentials);
        setTestResult(result);
        
        if (result.success) {
          setTimeout(() => {
            handleConnect();
          }, 1500);
        } else {
          setStep('credentials');
          setErrorMessage(result.error || 'Connection test failed');
        }
      } catch (error: any) {
        setStep('credentials');
        setErrorMessage(error.message || 'Failed to test connection');
        setTestResult({ success: false, error: error.message });
      }
    }
  };

  const handleConnect = async () => {
    if (channel === Channel.WHATSAPP) {
      if (!accessToken.trim() || !phoneNumberId.trim() || !businessAccountId.trim() || !webhookVerifyToken.trim()) {
        setErrorMessage('Please fill in all required fields');
        return;
      }

      setStep('testing');
      setErrorMessage('');

      try {
        const testResult = await WhatsAppService.testConnection(phoneNumberId, accessToken);
        
        if (!testResult.success) {
          setStep('credentials');
          setErrorMessage(testResult.error || 'Connection test failed');
          return;
        }

        await PlatformService.setAppConfig('webhookVerifyToken', webhookVerifyToken);

        const credentials: WhatsAppCredentials = {
          accessToken,
          phoneNumberId,
          businessAccountId,
          webhookVerifyToken,
        };

        const connection: PlatformConnection = {
          channel: Channel.WHATSAPP,
          status: PlatformStatus.CONNECTED,
          accountName: testResult.phoneNumber || phoneNumberId,
          connectedAt: Date.now(),
          provider: 'whatsapp',
          whatsappCredentials: credentials,
          healthStatus: 'healthy',
        };

        onLink(connection);
        setStep('success');
        
        setTimeout(() => {
          onClose();
        }, 2000);
      } catch (error: any) {
        setStep('credentials');
        setErrorMessage(error.message || 'Failed to connect');
      }
    } else if (channel === Channel.WECHAT) {
      if (!appId.trim() || !appSecret.trim()) {
        setErrorMessage('Please fill in AppID and AppSecret');
        return;
      }

      setStep('testing');
      setErrorMessage('');

      try {
        const credentials: WeChatCredentials = {
          appId,
          appSecret,
          webhookToken: wechatWebhookToken || 'globalreach_secret_token',
        };
        
        const testResult = await WeChatService.testConnection(credentials);
        
        if (!testResult.success) {
          setStep('credentials');
          setErrorMessage(testResult.error || 'Connection test failed');
          return;
        }

        // Save webhook token to config
        await PlatformService.setAppConfig('webhookVerifyToken', wechatWebhookToken || 'globalreach_secret_token');

        const connection: PlatformConnection = {
          channel: Channel.WECHAT,
          status: PlatformStatus.CONNECTED,
          accountName: testResult.accountName || `WeChat Account (${appId.substring(0, 8)}...)`,
          connectedAt: Date.now(),
          provider: 'wechat',
          wechatCredentials: credentials,
          healthStatus: 'healthy',
        };

        onLink(connection);
        setStep('success');
        
        setTimeout(() => {
          onClose();
        }, 2000);
      } catch (error: any) {
        setStep('credentials');
        setErrorMessage(error.message || 'Failed to connect');
      }
    }
  };

  const handleSimulateScan = () => {
    setStep('testing');
    setTimeout(() => {
      setStep('success');
      setTimeout(() => {
        onLink({
          channel: channel,
          status: PlatformStatus.CONNECTED,
          accountName: channel === Channel.WECHAT ? 'WeChatUser_88' : '+1 (555) 867-5309',
          connectedAt: Date.now(),
          provider: channel === Channel.WECHAT ? 'wechat' : 'whatsapp'
        });
        onClose();
      }, 1500);
    }, 2000);
  };

  const handleEmailConnect = async (provider: 'google' | 'microsoft' | 'custom') => {
    setEmailProvider(provider);
    setStep('testing');
    
    try {
      if (provider === 'google') {
        // Gmail OAuth flow (simplified - in production would use proper OAuth)
        // For now, show instructions
        setStep('credentials');
        setErrorMessage('Gmail OAuth integration requires OAuth client setup. Please configure OAuth credentials in Settings.');
        return;
      } else if (provider === 'microsoft') {
        // Microsoft Graph OAuth (similar to Gmail)
        setStep('credentials');
        setErrorMessage('Microsoft OAuth integration requires OAuth client setup. Please configure OAuth credentials in Settings.');
        return;
      } else {
        // Custom SMTP/IMAP - show credential form
        setStep('credentials');
        return;
      }
    } catch (error: any) {
      setStep('credentials');
      setErrorMessage(error.message || 'Failed to initiate connection');
    }
  };

  const getInstructions = () => {
    switch (channel) {
      case Channel.WHATSAPP:
        return (
          <div className="text-left space-y-3 text-sm text-slate-600">
            <p className="font-semibold text-slate-800 mb-2">How to get your credentials:</p>
            <ol className="list-decimal list-inside space-y-2">
              <li>Go to <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Meta for Developers</a></li>
              <li>Create or select your WhatsApp Business App</li>
              <li>Navigate to WhatsApp → API Setup</li>
              <li>Copy your <strong>Access Token</strong> and <strong>Phone Number ID</strong></li>
              <li>Find your <strong>Business Account ID</strong> in the Business Manager</li>
              <li>Set a <strong>Webhook Verify Token</strong> (you'll configure this in webhook settings)</li>
            </ol>
            <p className="mt-3 text-xs text-slate-500">
              For testing, you can use Meta's test credentials. See <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">documentation</a>.
            </p>
          </div>
        );
      case Channel.WECHAT:
        return (
          <div className="text-left space-y-3 text-sm text-slate-600">
            <p className="font-semibold text-slate-800 mb-2">How to get your WeChat Official Account credentials:</p>
            <ol className="list-decimal list-inside space-y-2">
              <li>Go to <a href="https://mp.weixin.qq.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">WeChat Official Account Platform</a></li>
              <li>Log in with your WeChat Official Account</li>
              <li>Navigate to <strong>Development</strong> → <strong>Basic Configuration</strong></li>
              <li>Copy your <strong>AppID</strong> and <strong>AppSecret</strong></li>
              <li>Configure your <strong>Server URL</strong> (webhook URL) and <strong>Token</strong> in the webhook settings</li>
              <li>Enable <strong>Message Encryption</strong> if needed (optional)</li>
            </ol>
            <p className="mt-3 text-xs text-slate-500">
              For testing, you can use WeChat's test account. See <a href="https://developers.weixin.qq.com/doc/offiaccount/Basic_Information/Getting_started_with_an_Official_Account.html" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">documentation</a>.
            </p>
          </div>
        );
      default:
        return null;
    }
  };

  const getHeaderColor = () => {
    switch (channel) {
      case Channel.WHATSAPP: return 'bg-[#00a884]';
      case Channel.WECHAT: return 'bg-[#07C160]';
      case Channel.EMAIL: return 'bg-blue-600';
      default: return 'bg-slate-900';
    }
  };

  const getHeaderIcon = () => {
    switch (channel) {
      case Channel.EMAIL: return <Mail className="w-5 h-5" />;
      case Channel.WECHAT: return <MessageCircle className="w-5 h-5" />;
      default: return <Smartphone className="w-5 h-5" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col transition-all max-h-[90vh]">
        
        {/* Header */}
        <div className={`p-6 flex justify-between items-center text-white ${getHeaderColor()}`}>
          <h2 className="text-lg font-bold flex items-center gap-2">
            {getHeaderIcon()}
            Link {channel} Account
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 flex flex-col overflow-y-auto">
          
          {/* EMAIL: Provider Selection */}
          {step === 'provider-select' && channel === Channel.EMAIL && (
            <div className="w-full space-y-4 animate-in slide-in-from-bottom-4 duration-300">
              <p className="text-slate-600 mb-6 text-sm">Select your email provider to authorize access via OAuth 2.0.</p>
              
              <button 
                onClick={() => handleEmailConnect('google')}
                className="w-full flex items-center p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all hover:shadow-md group"
              >
                <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-slate-700 group-hover:scale-110 transition-transform">
                  <span className="font-bold text-lg">G</span>
                </div>
                <div className="ml-4 text-left">
                  <span className="block font-bold text-slate-800">Sign in with Google</span>
                  <span className="block text-xs text-slate-500">Gmail, G Suite, Workspace</span>
                </div>
              </button>

              <button 
                onClick={() => handleEmailConnect('microsoft')}
                className="w-full flex items-center p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all hover:shadow-md group"
              >
                <div className="w-10 h-10 bg-[#00a4ef] text-white rounded-full shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="font-bold text-lg">M</span>
                </div>
                <div className="ml-4 text-left">
                  <span className="block font-bold text-slate-800">Sign in with Microsoft</span>
                  <span className="block text-xs text-slate-500">Outlook, Office 365</span>
                </div>
              </button>

              <button 
                onClick={() => handleEmailConnect('custom')}
                className="w-full flex items-center p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all hover:shadow-md group"
              >
                <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-full shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Server className="w-5 h-5" />
                </div>
                <div className="ml-4 text-left">
                  <span className="block font-bold text-slate-800">IMAP/SMTP</span>
                  <span className="block text-xs text-slate-500">Custom server configuration</span>
                </div>
              </button>
              </div>
          )}

          {/* EMAIL: SMTP/IMAP Credentials Form */}
          {step === 'credentials' && channel === Channel.EMAIL && emailProvider === 'custom' && (
            <div className="w-full space-y-4 animate-in slide-in-from-bottom-4 duration-300">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                <h3 className="font-bold text-slate-800 text-sm mb-2">SMTP/IMAP Configuration</h3>
                <p className="text-xs text-slate-600">
                  Enter your email server credentials. For Gmail, use app-specific password.
                </p>
              </div>

              {errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{errorMessage}</p>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={accessToken} // Reusing for email
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="your.email@example.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    SMTP Host <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={phoneNumberId} // Reusing for SMTP host
                    onChange={(e) => setPhoneNumberId(e.target.value)}
                    placeholder="smtp.gmail.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    SMTP Port <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={businessAccountId} // Reusing for port
                    onChange={(e) => setBusinessAccountId(e.target.value)}
                    placeholder="587"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Password/App Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={webhookVerifyToken} // Reusing for password
                    onChange={(e) => setWebhookVerifyToken(e.target.value)}
                    placeholder="Your email password or app password"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={async () => {
                    setStep('testing');
                    setErrorMessage('');
                    
                    try {
                      // Test SMTP connection
                      const creds: EmailCredentials = {
                        provider: 'smtp',
                        smtpHost: phoneNumberId,
                        smtpPort: parseInt(businessAccountId) || 587,
                        username: accessToken,
                        password: webhookVerifyToken,
                      };
                      const result = await EmailService.testConnection(creds);
                      if (result.success) {
                        // Connect
                        const connection: PlatformConnection = {
                          channel: Channel.EMAIL,
                          status: PlatformStatus.CONNECTED,
                          accountName: accessToken,
                          connectedAt: Date.now(),
                          provider: 'custom',
                          emailCredentials: creds,
                        };
                        onLink(connection);
                        setStep('success');
                        setTimeout(() => onClose(), 2000);
                      } else {
                        setStep('credentials');
                        setErrorMessage(result.error || 'Connection test failed');
                      }
                    } catch (error: any) {
                      setStep('credentials');
                      setErrorMessage(error.message || 'Connection test failed');
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                >
                  Test & Connect
                </button>
              </div>
            </div>
          )}

          {/* WHATSAPP: Credentials Form */}
          {step === 'credentials' && channel === Channel.WHATSAPP && (
            <div className="w-full space-y-4 animate-in slide-in-from-bottom-4 duration-300">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                <h3 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  WhatsApp Cloud API Credentials
                </h3>
                {getInstructions()}
              </div>

              {errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{errorMessage}</p>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Access Token <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="EAAxxxxxxxxxxxxx"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Phone Number ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={phoneNumberId}
                    onChange={(e) => setPhoneNumberId(e.target.value)}
                    placeholder="123456789012345"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Business Account ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={businessAccountId}
                    onChange={(e) => setBusinessAccountId(e.target.value)}
                    placeholder="123456789012345"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Webhook Verify Token <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={webhookVerifyToken}
                    onChange={(e) => setWebhookVerifyToken(e.target.value)}
                    placeholder="globalreach_secret_token"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 mt-1">Use this token when configuring webhook in Meta Business Manager</p>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleTestConnection}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                >
                  Test Connection
                </button>
                <button
                  onClick={handleConnect}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  Connect
                </button>
              </div>
            </div>
          )}

          {/* WECHAT: Credentials Form */}
          {step === 'credentials' && channel === Channel.WECHAT && (
            <div className="w-full space-y-4 animate-in slide-in-from-bottom-4 duration-300">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                <h3 className="font-bold text-slate-800 text-sm mb-2 flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  WeChat Official Account Credentials
                </h3>
                {getInstructions()}
              </div>

              {errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{errorMessage}</p>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    AppID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="wx1234567890abcdef"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 mt-1">Found in WeChat Official Account Platform → Development → Basic Configuration</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    AppSecret <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={appSecret}
                    onChange={(e) => setAppSecret(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 mt-1">Keep this secret secure. Reset it if exposed.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Webhook Token (Optional)
                  </label>
                  <input
                    type="text"
                    value={wechatWebhookToken}
                    onChange={(e) => setWechatWebhookToken(e.target.value)}
                    placeholder="globalreach_secret_token"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 mt-1">Use this token when configuring webhook in WeChat Official Account Platform</p>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleTestConnection}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                >
                  Test Connection
                </button>
                <button
                  onClick={handleConnect}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  Connect
                </button>
              </div>
            </div>
          )}

          {/* Testing/Verifying */}
          {step === 'testing' && (
            <div className="h-64 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              <h3 className="font-bold text-slate-800">Testing Connection...</h3>
              <p className="text-slate-500 text-sm">
                {channel === Channel.WHATSAPP 
                  ? 'Verifying WhatsApp API credentials...'
                  : channel === Channel.WECHAT
                  ? 'Verifying WeChat API credentials...'
                  : channel === Channel.EMAIL 
                  ? `Connecting to ${emailProvider === 'google' ? 'Google' : emailProvider === 'microsoft' ? 'Microsoft' : 'Server'}...`
                  : "Securely linking your device session."}
              </p>
              {testResult && testResult.success && (
                <div className="mt-2 text-sm text-green-600 font-medium">
                  ✓ Connected to {testResult.phoneNumber || testResult.accountName || phoneNumberId || appId}
                </div>
              )}
            </div>
          )}

          {/* Success */}
          {step === 'success' && (
            <div className="h-64 flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-white mb-2 animate-in bounce-in bg-green-500">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h3 className="font-bold text-slate-800 text-xl">
                {channel === Channel.EMAIL ? 'Email Linked!' : channel === Channel.WECHAT ? 'WeChat Connected!' : 'WhatsApp Connected!'}
              </h3>
              <p className="text-slate-500 text-sm">Redirecting back to settings...</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default PlatformConnectModal;
