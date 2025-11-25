
import React, { useState, useEffect } from 'react';
import { X, Smartphone, CheckCircle, Loader2, RefreshCw, Mail, Globe, Server, MessageCircle, AlertCircle, Key, Link2 } from 'lucide-react';
import { Channel, PlatformStatus, PlatformConnection, WhatsAppCredentials, EmailCredentials, WeChatCredentials, AuthStep } from '../types';
import { WhatsAppService } from '../services/whatsappService';
// EmailService is imported dynamically to avoid bundling Node.js modules
// import { EmailService } from '../services/emailService';
import { WeChatService } from '../services/wechatService';
import { PlatformService } from '../services/platformService';
// OAuthService is imported dynamically to avoid bundling Node.js modules
// import { OAuthService } from '../services/oauthService';
// EmailAuthService is imported dynamically to avoid bundling Node.js modules
// import { EmailAuthService } from '../services/emailAuthService';
import { MagicLinkService } from '../services/magicLinkService';
import { AuthStateService } from '../services/authStateService';
import { AuthLogService } from '../services/authLogService';
import { ErrorHandlerService } from '../services/errorHandlerService';
import AuthProgressModal from './AuthProgressModal';

interface PlatformConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: Channel;
  onLink: (connection: PlatformConnection) => void;
}

const PlatformConnectModal: React.FC<PlatformConnectModalProps> = ({ isOpen, onClose, channel, onLink }) => {
  const [step, setStep] = useState<'provider-select' | 'credentials' | 'testing' | 'success' | 'error' | 'magic-link'>('provider-select');
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
  
  // Email OAuth/Magic Link state
  const [emailAddress, setEmailAddress] = useState('');
  const [magicLinkToken, setMagicLinkToken] = useState('');
  const [oauthConfig, setOauthConfig] = useState<{ 
    outlook?: { clientId: string; clientSecret: string; tenantId?: string };
    gmail?: { clientId: string; clientSecret: string };
    redirectUri?: string;
  } | null>(null);
  const [authStep, setAuthStep] = useState<AuthStep>(AuthStep.IDLE);
  const [showAuthProgress, setShowAuthProgress] = useState(false);
  
  // Email SMTP/IMAP credentials state (reusing existing state variables)
  // accessToken = email address
  // phoneNumberId = SMTP host
  // businessAccountId = SMTP port (as string)
  // webhookVerifyToken = password
  // Adding new state for IMAP
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState('');
  
  const [errorMessage, setErrorMessage] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; phoneNumber?: string; accountName?: string; error?: string } | null>(null);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      if (channel === Channel.EMAIL) {
        setStep('provider-select');
        
        // Check for existing email connection and auto-fill
        const loadEmailCredentials = async () => {
          try {
            // Check if email is already connected
            const { EmailIPCService } = await import('../services/emailIPCService');
            const existingConnection = await EmailIPCService.getEmailConnection();
            
            if (existingConnection && existingConnection.emailCredentials) {
              // Load existing credentials for reconnection
              const creds = existingConnection.emailCredentials;
              setEmailAddress(creds.username || '');
              setAccessToken(creds.username || ''); // Reusing for email
              setPhoneNumberId(creds.smtpHost || ''); // SMTP host
              setBusinessAccountId(String(creds.smtpPort || '')); // SMTP port
              setWebhookVerifyToken(''); // Don't auto-fill password for security (user needs to re-enter)
              setImapHost(creds.imapHost || '');
              setImapPort(String(creds.imapPort || ''));
            } else {
              // Auto-fill with default credentials if no connection exists
              const { getDefaultEmailCredentials } = await import('../services/emailConfig');
              const defaultCreds = getDefaultEmailCredentials();
              
              setEmailAddress(defaultCreds.username || '');
              setAccessToken(defaultCreds.username || ''); // Reusing for email
              setPhoneNumberId(defaultCreds.smtpHost || '');
              setBusinessAccountId(String(defaultCreds.smtpPort || ''));
              setWebhookVerifyToken(defaultCreds.password || ''); // Auto-fill App Password
              setImapHost(defaultCreds.imapHost || '');
              setImapPort(String(defaultCreds.imapPort || ''));
              
              // Automatically set emailProvider to 'custom' to show the form with pre-filled credentials
              setEmailProvider('custom');
              setStep('credentials');
            }
          } catch (error) {
            console.error('Failed to load email credentials:', error);
            // Reset email fields on error
            setEmailAddress('');
            setAccessToken('');
            setPhoneNumberId('');
            setBusinessAccountId('');
            setWebhookVerifyToken('');
            setImapHost('');
            setImapPort('');
          }
        };
        
        loadEmailCredentials();
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
        // Try to test connection, but don't block if it fails
        const testResult = await WhatsAppService.testConnection(phoneNumberId, accessToken);
        
        let accountName = phoneNumberId;
        let showWarning = false;
        
        if (testResult.success) {
          accountName = testResult.phoneNumber || phoneNumberId;
        } else {
          // Connection test failed, but allow connecting anyway
          // This can happen if token doesn't have query permissions but can send messages
          showWarning = true;
          console.warn('[WhatsApp] Connection test failed, but allowing connection:', testResult.error);
          
          // Check if it's a permission/not found error
          const isPermissionError = testResult.error?.includes('does not exist') || 
                                    testResult.error?.includes('cannot be loaded') ||
                                    testResult.error?.includes('missing permissions');
          
          if (isPermissionError) {
            // Use business account ID or phone number ID as account name
            accountName = `WhatsApp Business (${phoneNumberId})`;
          }
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
          accountName: accountName,
          connectedAt: Date.now(),
          provider: 'whatsapp',
          whatsappCredentials: credentials,
          healthStatus: 'healthy', // Mark as healthy even if test failed (will test during actual use)
        };

        onLink(connection);
        setStep('success');
        
        // Show warning if test failed
        if (showWarning) {
          setTimeout(() => {
            alert('⚠️ WhatsApp connected with warning:\n\n' + 
                  'Connection test failed, but credentials saved.\n' +
                  'The access token may not have permission to query phone number info, but should still work for sending messages.\n\n' +
                  'If you encounter issues sending messages, verify:\n' +
                  '• Access token is valid and not expired\n' +
                  '• Phone Number ID matches your WhatsApp Business Account\n' +
                  '• Token has "whatsapp_business_messaging" permissions');
          }, 500);
        }
        
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

  // Load OAuth config from settings and ensure redirect URI is set
  useEffect(() => {
    const loadOAuthConfig = async () => {
      try {
        // Load OAuth configuration from settings
        const configStr = await (window as any).electronAPI?.getConfig('oauthConfig');
        if (configStr) {
          const parsedConfig = JSON.parse(configStr);
          
          // Ensure redirect URI is set - get from server port or use default
          if (!parsedConfig.redirectUri) {
            const { PlatformService } = await import('../services/platformService');
            const port = await PlatformService.getAppConfig('serverPort', 4000);
            parsedConfig.redirectUri = `http://localhost:${port}/auth/oauth/callback`;
          }
          
          setOauthConfig(parsedConfig);
        }
      } catch (e) {
        // Config not set yet
        console.error('Failed to load OAuth config:', e);
      }
    };
    if (isOpen && channel === Channel.EMAIL) {
      loadOAuthConfig();
    }
  }, [isOpen, channel]);

  // Listen for OAuth callbacks
  useEffect(() => {
    if (!isOpen || channel !== Channel.EMAIL) return;

    const handleOAuthCallback = async (event: any, data: any) => {
      if (data.success && data.code && data.state) {
        setAuthStep(AuthStep.EXCHANGING);
        setShowAuthProgress(true);
        
        try {
          const startTime = Date.now();
          AuthLogService.logLoginAttempt({
            provider: data.provider || 'gmail',
            method: 'oauth',
            email: emailAddress,
            success: false, // Will update on completion
          });

          if (!oauthConfig) {
            throw new Error('OAuth configuration not found. Please configure OAuth credentials in Settings > Integrations > OAuth Configuration.');
          }

          const provider = data.provider || 'gmail';
          const providerConfig = provider === 'outlook' ? oauthConfig.outlook : oauthConfig.gmail;
          
          if (!providerConfig || !providerConfig.clientId || !providerConfig.clientSecret) {
            throw new Error(`${provider === 'outlook' ? 'Outlook' : 'Gmail'} OAuth configuration not found. Please configure OAuth credentials in Settings > Integrations > OAuth Configuration.`);
          }

          // Build OAuth config object for the service
          const serviceConfig = {
            clientId: providerConfig.clientId,
            clientSecret: providerConfig.clientSecret,
            redirectUri: oauthConfig.redirectUri || `http://localhost:${await (await import('../services/platformService')).PlatformService.getAppConfig('serverPort', 4000)}/auth/oauth/callback`,
            tenantId: provider === 'outlook' ? (providerConfig as any).tenantId || 'common' : undefined
          };

          const { OAuthService } = await import('../services/oauthService');
          const tokens = await OAuthService.handleOAuthCallback(
            provider,
            data.code,
            data.state,
            serviceConfig
          );

          // Store credentials with expiry and redirect URI
          const credentials: EmailCredentials = {
            provider: provider as 'gmail' | 'outlook',
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            tokenExpiryDate: tokens.expiryDate || (tokens.expiresIn ? Date.now() + tokens.expiresIn : undefined),
            oauthClientId: providerConfig.clientId,
            oauthClientSecret: providerConfig.clientSecret,
            redirectUri: serviceConfig.redirectUri,
          };

          const { EmailAuthService } = await import('../services/emailAuthService');
          const connection = await EmailAuthService.storeCredentialsSecurely(credentials, {
            accountName: emailAddress,
          });

          const duration = Date.now() - startTime;
          AuthLogService.logLoginAttempt({
            provider: data.provider || 'gmail',
            method: 'oauth',
            email: emailAddress,
            success: true,
            duration,
          });

          setAuthStep(AuthStep.CONNECTED);
          onLink(connection);
          setTimeout(() => {
            setShowAuthProgress(false);
            setStep('success');
            setTimeout(() => onClose(), 2000);
          }, 1000);
        } catch (error: any) {
          const errorInfo = ErrorHandlerService.handleAuthError(error, {
            provider: data.provider || 'gmail',
            method: 'oauth',
          });
          
          AuthLogService.logAuthError({
            errorCode: errorInfo.code,
            errorMessage: errorInfo.message,
            provider: data.provider || 'gmail',
            method: 'oauth',
          });

          // Add fallback options to error message
          let enhancedMessage = errorInfo.userMessage;
          if (errorInfo.fallbackOptions && errorInfo.fallbackOptions.length > 0) {
            enhancedMessage += '\n\nAlternatives:\n' + errorInfo.fallbackOptions.map(opt => `• ${opt}`).join('\n');
          }

          setAuthStep(AuthStep.ERROR);
          setErrorMessage(enhancedMessage);
          setShowAuthProgress(false);
          setStep('error');
        }
      } else if (data.error) {
        const errorInfo = ErrorHandlerService.handleAuthError(new Error(data.error), {
          provider: data.provider || 'gmail',
          method: 'oauth',
        });
        setErrorMessage(errorInfo.userMessage);
        setAuthStep(AuthStep.ERROR);
        setShowAuthProgress(false);
        setStep('error');
      }
    };

    const handleMagicLinkCallback = async (event: any, data: any) => {
      if (data.token) {
        setAuthStep(AuthStep.AUTHENTICATING);
        setShowAuthProgress(true);
        
        try {
          const validation = await (window as any).electronAPI?.validateMagicLink(data.token);
          if (validation?.valid && validation.payload) {
            // Process magic link connection
            const email = validation.payload.email;
            const provider = validation.payload.provider;
            
            // For magic links, we'd typically have pre-configured credentials
            // or use them to initiate OAuth
            setAuthStep(AuthStep.CONNECTED);
            setShowAuthProgress(false);
            setStep('success');
            setTimeout(() => onClose(), 2000);
          } else {
            throw new Error(validation?.error || 'Invalid magic link');
          }
        } catch (error: any) {
          const errorInfo = ErrorHandlerService.handleAuthError(error, {
            method: 'magic-link',
          });
          setErrorMessage(errorInfo.userMessage);
          setAuthStep(AuthStep.ERROR);
          setShowAuthProgress(false);
          setStep('error');
        }
      }
    };

    if ((window as any).electronAPI) {
      (window as any).electronAPI.onOAuthCallback(handleOAuthCallback);
      (window as any).electronAPI.onMagicLinkCallback(handleMagicLinkCallback);
      
      return () => {
        (window as any).electronAPI?.removeOAuthCallback();
        (window as any).electronAPI?.removeMagicLinkCallback();
      };
    }
  }, [isOpen, channel, emailAddress, oauthConfig, onLink, onClose]);

  const handleEmailConnect = async (provider: 'google' | 'microsoft' | 'custom') => {
    setEmailProvider(provider);
    setErrorMessage('');
    
    try {
      if (provider === 'google' || provider === 'microsoft') {
        // OAuth flow
        if (!oauthConfig) {
          setStep('credentials');
          setErrorMessage('OAuth configuration required. Please configure OAuth credentials in Settings > Integrations > OAuth Configuration. You can also use manual SMTP/IMAP credentials as an alternative.');
          return;
        }

        const oauthProvider = provider === 'google' ? 'gmail' : 'outlook';
        const providerConfig = oauthProvider === 'outlook' ? oauthConfig.outlook : oauthConfig.gmail;

        // Validate provider-specific OAuth config
        if (!providerConfig || !providerConfig.clientId || !providerConfig.clientSecret) {
          setStep('credentials');
          setErrorMessage(`${oauthProvider === 'outlook' ? 'Outlook' : 'Gmail'} OAuth configuration not found. Please configure ${oauthProvider === 'outlook' ? 'Outlook' : 'Gmail'} Client ID and Client Secret in Settings > Integrations > OAuth Configuration. You can also use manual SMTP/IMAP credentials as an alternative.`);
          return;
        }

        // Build OAuth config for the service
        const { PlatformService } = await import('../services/platformService');
        const port = await PlatformService.getAppConfig('serverPort', 4000);
        const redirectUri = oauthConfig.redirectUri || `http://localhost:${port}/auth/oauth/callback`;
        
        const serviceConfig = {
          clientId: providerConfig.clientId,
          clientSecret: providerConfig.clientSecret,
          redirectUri: redirectUri,
          tenantId: oauthProvider === 'outlook' ? (providerConfig as any).tenantId || 'common' : undefined
        };

        // Validate config using OAuth service
        const { OAuthService } = await import('../services/oauthService');
        const validation = OAuthService.validateOAuthConfig(serviceConfig, oauthProvider);
        if (!validation.valid) {
          setStep('credentials');
          setErrorMessage(`Invalid OAuth configuration: ${validation.error}. Please check your settings in Settings > Integrations > OAuth Configuration.`);
          return;
        }

        setAuthStep(AuthStep.INITIATING);
        setShowAuthProgress(true);

        try {
          const result = await (window as any).electronAPI?.initiateOAuth(
            oauthProvider,
            serviceConfig,
            emailAddress
          );

          if (result?.success) {
            setAuthStep(AuthStep.AUTHENTICATING);
            AuthLogService.logLinkClick({
              source: 'app',
              url: 'oauth://initiate',
              type: 'oauth',
              success: true,
            });
            // OAuth URL opened in browser, waiting for callback
          } else {
            throw new Error(result?.error || 'Failed to initiate OAuth');
          }
        } catch (error: any) {
          const errorInfo = ErrorHandlerService.handleAuthError(error, {
            provider: provider === 'google' ? 'gmail' : 'outlook',
            method: 'oauth',
          });
          
          // Add fallback options to error message
          let enhancedMessage = errorInfo.userMessage;
          if (errorInfo.fallbackOptions && errorInfo.fallbackOptions.length > 0) {
            enhancedMessage += '\n\nAlternatives:\n' + errorInfo.fallbackOptions.map(opt => `• ${opt}`).join('\n');
          }
          
          setErrorMessage(enhancedMessage);
          setAuthStep(AuthStep.ERROR);
          setShowAuthProgress(false);
          setStep('error');
        }
      } else {
        // Custom SMTP/IMAP - show credential form
        setStep('credentials');
        return;
      }
    } catch (error: any) {
      const errorInfo = ErrorHandlerService.handleAuthError(error);
      setStep('error');
      setErrorMessage(errorInfo.userMessage);
    }
  };

  const handleMagicLink = async () => {
    if (!emailAddress) {
      setErrorMessage('Please enter your email address');
      return;
    }

    const { EmailAuthService } = await import('../services/emailAuthService');
    const provider = EmailAuthService.detectEmailProvider(emailAddress);
    if (provider === 'custom') {
      setErrorMessage('Magic links are only available for Gmail and Outlook. Please use OAuth or manual credentials.');
      return;
    }

    setStep('magic-link');
    setAuthStep(AuthStep.INITIATING);
    setShowAuthProgress(true);

    try {
      const result = await (window as any).electronAPI?.sendMagicLink(
        emailAddress,
        provider,
        'email_connection'
      );

      if (result?.success) {
        setAuthStep(AuthStep.AUTHENTICATING);
        setErrorMessage('');
        AuthLogService.logLinkClick({
          source: 'app',
          url: 'magic-link://send',
          type: 'magic-link',
          success: true,
        });
      } else {
        throw new Error(result?.error || 'Failed to send magic link');
      }
    } catch (error: any) {
      const errorInfo = ErrorHandlerService.handleAuthError(error, {
        provider,
        method: 'magic-link',
      });
      setErrorMessage(errorInfo.userMessage);
      setAuthStep(AuthStep.ERROR);
      setShowAuthProgress(false);
      setStep('error');
    }
  };

  const handleMagicLinkInput = async () => {
    if (!magicLinkToken.trim()) {
      setErrorMessage('Please enter the magic link');
      return;
    }

    setAuthStep(AuthStep.AUTHENTICATING);
    setShowAuthProgress(true);

    try {
      const validation = await (window as any).electronAPI?.validateMagicLink(magicLinkToken);
      if (validation?.valid && validation.payload) {
        // Process magic link
        setAuthStep(AuthStep.CONNECTED);
        setShowAuthProgress(false);
        setStep('success');
        setTimeout(() => onClose(), 2000);
      } else {
        throw new Error(validation?.error || 'Invalid magic link');
      }
    } catch (error: any) {
      const errorInfo = ErrorHandlerService.handleAuthError(error, {
        method: 'magic-link',
      });
      setErrorMessage(errorInfo.userMessage);
      setAuthStep(AuthStep.ERROR);
      setShowAuthProgress(false);
      setStep('error');
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
                <p className="text-xs text-slate-600 mb-3">
                  Enter your email server credentials. For Gmail, use app-specific password.
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                  <p className="text-xs text-amber-800 font-medium mb-1">⚠️ Important Notice</p>
                  <p className="text-xs text-amber-700">
                    Some Outlook.com accounts have basic authentication disabled by Microsoft. 
                    If you get "basic authentication is disabled" error, use <strong>"Sign in with Microsoft"</strong> (OAuth) instead.
                  </p>
                </div>
                
                {/* Auto-filled credentials notice */}
                {(accessToken || phoneNumberId || imapHost) && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-blue-800 font-medium">
                        {webhookVerifyToken ? 'Default credentials auto-filled' : 'Existing credentials loaded'}
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        {webhookVerifyToken 
                          ? 'Default Outlook credentials have been pre-filled. You can modify them if needed.'
                          : 'Your existing email credentials have been loaded. Password is required for reconnection.'}
                      </p>
                      {(accessToken?.includes('@outlook.com') || accessToken?.includes('@hotmail.com')) && (
                        <p className="text-xs text-amber-700 mt-2 font-medium">
                          ⚠️ Note: Some Outlook.com accounts require App Passwords even without 2FA enabled. If authentication fails, try using an App Password.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Preset Configuration Buttons */}
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    onClick={() => {
                      setAccessToken('');
                      setPhoneNumberId('smtp-mail.outlook.com');
                      setBusinessAccountId('587');
                      setImapHost('outlook.office365.com');
                      setImapPort('993');
                    }}
                    className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                  >
                    Outlook.com
                  </button>
                  <button
                    onClick={() => {
                      setAccessToken('');
                      setPhoneNumberId('smtp.gmail.com');
                      setBusinessAccountId('587');
                      setImapHost('imap.gmail.com');
                      setImapPort('993');
                    }}
                    className="px-3 py-1.5 text-xs bg-red-50 text-red-700 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
                  >
                    Gmail
                  </button>
                  <button
                    onClick={() => {
                      setAccessToken('');
                      setPhoneNumberId('smtp.mail.yahoo.com');
                      setBusinessAccountId('587');
                      setImapHost('imap.mail.yahoo.com');
                      setImapPort('993');
                    }}
                    className="px-3 py-1.5 text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded-md hover:bg-purple-100 transition-colors"
                  >
                    Yahoo Mail
                  </button>
                  <button
                    onClick={() => {
                      setAccessToken('');
                      setPhoneNumberId('');
                      setBusinessAccountId('');
                      setWebhookVerifyToken('');
                      setImapHost('');
                      setImapPort('');
                    }}
                    className="px-3 py-1.5 text-xs bg-gray-50 text-gray-700 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-red-800 whitespace-pre-line leading-relaxed">{errorMessage}</p>
                  </div>
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
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-slate-600">
                      <strong className="text-amber-700">⚠️ Important:</strong> For accounts with 2-Step Verification (2FA), you <strong>must</strong> use an App Password, not your regular password.
                    </p>
                    <details className="text-xs bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
                      <summary className="px-3 py-2 cursor-pointer font-semibold text-blue-800 hover:bg-blue-100 transition-colors">
                        📖 How to create an App Password (Click to expand)
                      </summary>
                      <div className="px-3 pb-3 pt-2 space-y-2 text-blue-700 border-t border-blue-200">
                        <div>
                          <p className="font-semibold mb-1">For Outlook/Hotmail/Live accounts:</p>
                          <ol className="list-decimal list-inside space-y-0.5 ml-1 text-xs">
                            <li>Go to <a href="https://account.microsoft.com/security" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">account.microsoft.com/security</a></li>
                            <li>Click on <strong>"Advanced security options"</strong></li>
                            <li>Scroll down to <strong>"App passwords"</strong> section</li>
                            <li>Click <strong>"Create a new app password"</strong></li>
                            <li>Copy the generated password and paste it here</li>
                          </ol>
                        </div>
                        <div>
                          <p className="font-semibold mb-1">For Gmail accounts:</p>
                          <ol className="list-decimal list-inside space-y-0.5 ml-1 text-xs">
                            <li>Go to <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">myaccount.google.com/security</a></li>
                            <li>Under "Signing in to Google", click <strong>"2-Step Verification"</strong></li>
                            <li>Scroll down and click <strong>"App passwords"</strong></li>
                            <li>Select "Mail" and "Other (Custom name)" and enter "GlobalReach"</li>
                            <li>Click "Generate" and copy the 16-character password</li>
                          </ol>
                        </div>
                      </div>
                    </details>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <h4 className="text-sm font-medium text-slate-700 mb-3">IMAP Settings (For Reading Emails)</h4>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        IMAP Host <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={imapHost}
                        onChange={(e) => setImapHost(e.target.value)}
                        placeholder="imap.gmail.com or outlook.office365.com"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        IMAP Port <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        value={imapPort}
                        onChange={(e) => setImapPort(e.target.value)}
                        placeholder="993"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Usually 993 (SSL/TLS) or 143 (STARTTLS)
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={async () => {
                    setStep('testing');
                    setErrorMessage('');
                    
                    try {
                      // Validate required fields
                      if (!accessToken || !phoneNumberId || !businessAccountId || !webhookVerifyToken) {
                        throw new Error('Please fill in all required fields (Email, SMTP Host, SMTP Port, Password)');
                      }
                      
                      if (!imapHost || !imapPort) {
                        throw new Error('Please fill in IMAP Host and IMAP Port for reading emails');
                      }

                      // Test SMTP connection using IPC (runs in main process where nodemailer is available)
                      // Detect provider from email address for better error handling
                      const emailDomain = accessToken.split('@')[1]?.toLowerCase();
                      let detectedProvider: 'gmail' | 'outlook' | 'imap' = 'imap';
                      if (emailDomain === 'gmail.com' || emailDomain === 'googlemail.com') {
                        detectedProvider = 'gmail';
                      } else if (emailDomain === 'outlook.com' || emailDomain === 'hotmail.com' || emailDomain === 'live.com' || emailDomain?.endsWith('.office365.com')) {
                        detectedProvider = 'outlook';
                      }
                      
                      // Use 'imap' provider for SMTP/IMAP connections (even for Outlook)
                      // This ensures we use SMTP authentication, not OAuth
                      const creds: EmailCredentials = {
                        provider: 'imap' as const, // Always use 'imap' for SMTP/IMAP connections
                        smtpHost: phoneNumberId.trim(),
                        smtpPort: parseInt(businessAccountId) || 587,
                        imapHost: imapHost.trim(),
                        imapPort: parseInt(imapPort) || 993,
                        username: accessToken.trim(),
                        password: webhookVerifyToken.trim(), // Trim any whitespace from App Password
                      };
                      
                      // Use IPC service wrapper to avoid importing emailService.ts (which causes nodemailer resolution errors)
                      const { EmailIPCService } = await import('../services/emailIPCService');
                      const result = await EmailIPCService.testConnection(creds);
                      
                      if (!result) {
                        throw new Error('No response from connection test. Please try again.');
                      }
                      
                      if (result.success) {
                        // Connect
                        const connection: PlatformConnection = {
                          channel: Channel.EMAIL,
                          status: PlatformStatus.CONNECTED,
                          accountName: accessToken,
                          connectedAt: Date.now(),
                          provider: 'custom',
                          emailCredentials: creds as EmailCredentials,
                        };
                        onLink(connection);
                        setStep('success');
                        setTimeout(() => onClose(), 2000);
                      } else {
                        setStep('credentials');
                        // Display enhanced error message with actionable guidance
                        let errorMsg = result.error || 'Connection test failed. Please check your credentials and server settings.';
                        
                        // Preserve line breaks from the error message for better formatting
                        setErrorMessage(errorMsg);
                      }
                    } catch (error: any) {
                      console.error('Email connection test error:', error);
                      setStep('credentials');
                      const errorMsg = error.message || error.toString() || 'Connection test failed';
                      setErrorMessage(errorMsg.includes('nodemailer') || errorMsg.includes('module specifier') 
                        ? 'Internal error: Please restart the application and try again.' 
                        : errorMsg);
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

      {/* Auth Progress Modal */}
      <AuthProgressModal
        isOpen={showAuthProgress}
        currentStep={authStep}
        provider={emailProvider === 'google' ? 'gmail' : emailProvider === 'microsoft' ? 'outlook' : 'custom'}
        error={authStep === AuthStep.ERROR ? {
          code: 'AUTH_ERROR',
          message: errorMessage,
          retryable: true,
        } : undefined}
        onClose={() => {
          setShowAuthProgress(false);
          if (authStep === AuthStep.CONNECTED) {
            setStep('success');
            setTimeout(() => onClose(), 2000);
          }
        }}
        onRetry={() => {
          if (emailProvider === 'google' || emailProvider === 'microsoft') {
            handleEmailConnect(emailProvider);
          } else {
            handleMagicLink();
          }
        }}
        onHelp={() => {
          window.open('https://support.globalreach.app/auth', '_blank');
        }}
      />
    </div>
  );
};

export default PlatformConnectModal;
