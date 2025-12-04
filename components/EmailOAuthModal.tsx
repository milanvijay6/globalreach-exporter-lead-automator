import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, CheckCircle, AlertCircle, Mail } from 'lucide-react';
import { OAuthService, OAuthConfig } from '../services/oauthService';
import { saveEmailConnection, loadEmailConnection } from '../services/securityService';
import { OutlookEmailCredentials, PlatformConnection, PlatformStatus, Channel } from '../types';
import { PlatformService, isDesktop } from '../services/platformService';
import { Logger } from '../services/loggerService';

interface EmailOAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected: (connection: PlatformConnection) => void;
}

const EmailOAuthModal: React.FC<EmailOAuthModalProps> = ({ isOpen, onClose, onConnected }) => {
  const [step, setStep] = useState<'provider-select' | 'init' | 'authenticating' | 'success' | 'error'>('provider-select');
  const [provider, setProvider] = useState<'outlook' | 'gmail' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [isProcessingCallback, setIsProcessingCallback] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setStep('provider-select');
      setProvider(null);
      setErrorMessage('');
      setUserEmail('');
      setIsProcessingCallback(false);
    }
  }, [isOpen]);

  // OAuth callback handler function - defined before useEffect so it can be used
  // Using useCallback to ensure stable reference
  const handleOAuthCallback = useCallback(async (data: any) => {
    // Prevent processing callback multiple times
    if (isProcessingCallback) {
      Logger.warn('[EmailOAuthModal] Callback already being processed, ignoring duplicate');
      return;
    }
    
    setIsProcessingCallback(true);
    
    // IPC sends data directly, not wrapped in event.detail
    const { success, code, state: callbackState, provider, error } = data;

    Logger.info('[EmailOAuthModal] handleOAuthCallback called', { 
      success, 
      hasCode: !!code, 
      codeLength: code?.length,
      hasState: !!callbackState, 
      stateLength: callbackState?.length,
      provider, 
      hasError: !!error,
      errorMessage: error
    });

    // Accept if provider is outlook, or if provider is missing/unknown (assume Outlook)
    if (provider && provider !== 'outlook' && provider !== 'gmail') {
      Logger.debug('[EmailOAuthModal] Ignoring callback (not Outlook)', { provider });
      return;
    }

    if (!success || error) {
      Logger.error('[EmailOAuthModal] OAuth callback error received', { error, success });
      setStep('error');
      setErrorMessage(error || 'OAuth authentication failed');
      return;
    }

    if (!code) {
      Logger.error('[EmailOAuthModal] OAuth callback missing authorization code');
      setStep('error');
      setErrorMessage('OAuth callback missing authorization code. Please try connecting again.');
      return;
    }

    // Determine provider from callback or state
    let actualProvider: 'outlook' | 'gmail' = provider || 'outlook';
    if (callbackState) {
      try {
        const stateData = JSON.parse(callbackState);
        if (stateData.provider === 'gmail' || stateData.provider === 'outlook') {
          actualProvider = stateData.provider;
        }
      } catch (e) {
        // If state parsing fails, use provider from callback or default
        if (provider === 'gmail' || provider === 'outlook') {
          actualProvider = provider;
        }
      }
    }

    // State is optional - if missing, create a default one
    const actualState = callbackState || JSON.stringify({ provider: actualProvider, timestamp: Date.now() });

    try {
      setStep('authenticating');
      
      // Get OAuth configuration based on provider
      let clientId: string;
      let clientSecret: string;
      let tenantId: string | undefined;
      
      if (actualProvider === 'gmail') {
        clientId = await PlatformService.getAppConfig('gmailClientId', '');
        clientSecret = await PlatformService.getAppConfig('gmailClientSecret', '');
      } else {
        clientId = await PlatformService.getAppConfig('outlookClientId', '');
        clientSecret = await PlatformService.getAppConfig('outlookClientSecret', '');
        tenantId = await PlatformService.getAppConfig('outlookTenantId', 'common');
      }
      
      const serverPort = await PlatformService.getAppConfig('serverPort', 4000);

      // Determine redirect URI priority:
      // 1. Cloudflare Worker URL (if configured) - Permanent, never expires
      // 2. Cloudflare Tunnel URL (if available) - For Electron with tunnel
      // 3. Current window location (web environment) - For Back4App/web hosting
      // 4. Fallback to localhost - For Electron without tunnel
      const cloudflareWorkerUrl = await PlatformService.getAppConfig('cloudflareWorkerUrl', '');
      const cloudflareUrl = await PlatformService.getAppConfig('cloudflareUrl', '');
      let redirectUri: string;
      
      // Determine redirect URI based on provider
      if (cloudflareWorkerUrl) {
        // Use Cloudflare Worker URL - permanent solution for Back4App
        if (actualProvider === 'gmail') {
          redirectUri = `${cloudflareWorkerUrl}/auth/gmail/callback`;
        } else {
          redirectUri = `${cloudflareWorkerUrl}/auth/outlook/callback`;
        }
      } else if (cloudflareUrl) {
        redirectUri = `${cloudflareUrl}/api/oauth/callback`;
      } else if (typeof window !== 'undefined' && window.location.origin && !isDesktop()) {
        // Web environment - use current URL
        redirectUri = `${window.location.origin}/api/oauth/callback`;
      } else {
        // Electron without tunnel - use localhost
        redirectUri = `http://localhost:${serverPort}/api/oauth/callback`;
      }
      
      Logger.info('[EmailOAuthModal] OAuth configuration', {
        provider: actualProvider,
        clientId: clientId ? `${clientId.substring(0, 8)}...` : 'missing',
        hasClientSecret: !!clientSecret,
        redirectUri,
        tenantId: tenantId || 'common',
      });

      const config: OAuthConfig = {
        clientId,
        clientSecret,
        redirectUri,
        tenantId: tenantId || 'common',
      };

      // Exchange code for tokens
      Logger.info('[EmailOAuthModal] Starting code exchange', {
        provider: actualProvider,
        hasCode: !!code,
        hasState: !!callbackState,
        redirectUri: config.redirectUri,
        tenantId: config.tenantId
      });
      
      const tokens = await OAuthService.handleOAuthCallback(actualProvider, code, callbackState, config);
      
      Logger.info('[EmailOAuthModal] Code exchange successful', {
        provider: actualProvider,
        hasAccessToken: !!tokens.accessToken,
        hasRefreshToken: !!tokens.refreshToken
      });

      // Get user profile to get email address
      let profileEmail: string;
      let profileName: string | undefined;

      if (actualProvider === 'gmail') {
        // Get Gmail user profile using Google OAuth2 API
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${tokens.accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `HTTP ${response.status}: Failed to get user profile`);
        }

        const userInfo = await response.json();
        
        if (!userInfo.email) {
          throw new Error('Failed to get user email address from Google');
        }
        
        profileEmail = userInfo.email;
        profileName = userInfo.name;
      } else {
        // Get Outlook user profile
        const { OutlookEmailService } = await import('../services/outlookEmailService');
        const tempCredentials: OutlookEmailCredentials = {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiryDate: tokens.expiryDate,
          userEmail: '', // Will be set after getting profile
          tenantId: config.tenantId || 'common',
        };

        const profile = await OutlookEmailService.getUserProfile(tempCredentials);
        if (!profile.success || !profile.email) {
          throw new Error('Failed to get user email address');
        }
        
        profileEmail = profile.email;
        profileName = profile.name;
      }

      // Create email credentials based on provider
      let emailCredentials: any;
      if (actualProvider === 'gmail') {
        emailCredentials = {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiryDate: tokens.expiryDate,
          userEmail: profileEmail,
          provider: 'gmail',
        };
      } else {
        emailCredentials = {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiryDate: tokens.expiryDate,
          userEmail: profileEmail,
          tenantId: config.tenantId || 'common',
        };
      }

      // Create and save email connection
      const connection: PlatformConnection = {
        channel: Channel.EMAIL,
        status: PlatformStatus.CONNECTED,
        accountName: profileEmail,
        connectedAt: Date.now(),
        provider: actualProvider,
        emailCredentials: emailCredentials,
        healthStatus: 'healthy',
        lastTested: Date.now(),
      };
      
      await saveEmailConnection(connection);
      setUserEmail(profileEmail);
      setStep('success');

      // Notify parent
      onConnected(connection);

      Logger.info(`[EmailOAuthModal] ${actualProvider === 'gmail' ? 'Gmail' : 'Outlook'} connection saved successfully`, {
        email: profileEmail,
        provider: actualProvider,
        hasAccessToken: !!emailCredentials.accessToken,
        hasRefreshToken: !!emailCredentials.refreshToken
      });

      // Close after 2 seconds
      setTimeout(() => {
        setIsProcessingCallback(false);
        onClose();
      }, 2000);
    } catch (error: any) {
      setIsProcessingCallback(false);
      Logger.error('[EmailOAuthModal] OAuth callback processing failed:', {
        error: error.message,
        stack: error.stack,
        code: error.code,
        hasCode: !!code,
        hasState: !!callbackState
      });
      
      setStep('error');
      
      // Format error message for better readability
      let errorMsg = error.message || 'Failed to complete OAuth flow';
      
      // Add debugging info if error is vague
      const providerName = actualProvider === 'gmail' ? 'Google' : 'Azure';
      if (!errorMsg.includes(providerName) && !errorMsg.includes('Invalid') && !errorMsg.includes('Failed')) {
        errorMsg = `OAuth connection failed: ${errorMsg}\n\n` +
          `Please check:\n` +
          `1. ${actualProvider === 'gmail' ? 'Gmail' : 'Outlook'} Client ID and Client Secret are correct in Settings\n` +
          `2. Redirect URI in ${providerName} ${actualProvider === 'gmail' ? 'Cloud Console' : 'Portal'} matches: ${config.redirectUri}\n` +
          `3. Server is running on port ${serverPort}`;
      }
      
      // Add specific help for redirect_uri_mismatch error
      if (errorMsg.includes('redirect_uri_mismatch') || errorMsg.includes('redirect URI')) {
        errorMsg = `Redirect URI Mismatch Error\n\n` +
          `The redirect URI being used is:\n${config.redirectUri}\n\n` +
          `This URI must be added to your ${providerName} ${actualProvider === 'gmail' ? 'Cloud Console' : 'Portal'}:\n` +
          `1. Go to ${actualProvider === 'gmail' ? 'Google Cloud Console → APIs & Services → Credentials → Your OAuth 2.0 Client ID' : 'Azure Portal → App registrations → Your app → Authentication'}\n` +
          `2. Add this redirect URI: ${config.redirectUri}\n` +
          `3. Save and wait 1-2 minutes\n` +
          `4. Try connecting again\n\n` +
          `See GOOGLE_CLOUD_CONSOLE_REDIRECT_URI_SETUP.md for detailed instructions.`;
      }
      
      // If error contains newlines (from our improved error messages), format it nicely
      if (errorMsg.includes('\n')) {
        errorMsg = errorMsg.split('\n').map((line: string, idx: number) => {
          if (idx === 0) return line; // First line is the main error
          if (line.trim().startsWith('To fix') || line.trim().startsWith('Note:') || line.trim().startsWith('Please check:')) {
            return `\n${line}`; // Add spacing before instructions
          }
          return line;
        }).join('\n');
      }
      
      setErrorMessage(errorMsg);
    }
  }, [onConnected, onClose, isProcessingCallback]);

  // Check for OAuth callback in URL parameters (for web apps)
  useEffect(() => {
    if (!isOpen) return;

    // Check URL parameters for OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const oauthCallback = urlParams.get('oauth_callback');
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const provider = urlParams.get('provider') || 'outlook';

    // Process callback if we have code (state is optional)
    if (oauthCallback === 'true' && code && !isProcessingCallback) {
      Logger.info('[EmailOAuthModal] OAuth callback detected in URL parameters', {
        hasCode: !!code,
        codeLength: code.length,
        hasState: !!state,
        stateLength: state.length,
        provider,
        isProcessing: isProcessingCallback
      });

      // Set step to authenticating immediately
      setStep('authenticating');
      setErrorMessage('');

      // Process the callback - handleOAuthCallback is async and handles errors internally
      handleOAuthCallback({
        success: true,
        code,
        state,
        provider
      });

      // Clean up URL parameters after a delay to ensure processing has started
      setTimeout(() => {
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }, 500);
    }
  }, [isOpen, handleOAuthCallback]);

  // Set up OAuth callback listener when modal opens
  useEffect(() => {
    if (!isOpen) return;

    Logger.info('[EmailOAuthModal] Setting up OAuth callback listener', { isOpen });

    // Listen for OAuth callback from electron main process via IPC
    if (typeof window !== 'undefined' && (window as any).electronAPI?.onOAuthCallback) {
      const callbackHandler = (event: any, data: any) => {
        // IPC callback receives (event, data) where data is the payload from main process
        // The main process sends: { success, code, state, provider }
        const callbackData = data; // data is the actual payload
        Logger.info('[EmailOAuthModal] IPC callback received', { 
          hasEvent: !!event, 
          hasData: !!data, 
          callbackData,
          provider: callbackData?.provider,
          hasCode: !!callbackData?.code,
          success: callbackData?.success
        });
        
        // Process if it's Outlook OR if it has a code (might be Outlook even if provider detection failed)
        if (callbackData && callbackData.success && callbackData.code) {
          // Check if it's Outlook or if provider is missing/unknown (assume Outlook if we're in this modal)
          if (callbackData.provider === 'outlook' || !callbackData.provider || callbackData.provider === 'gmail') {
            Logger.info('[EmailOAuthModal] Processing OAuth callback', { 
              provider: callbackData.provider,
              hasCode: !!callbackData.code,
              hasState: !!callbackData.state
            });
            handleOAuthCallback(callbackData);
          } else {
            Logger.debug('[EmailOAuthModal] Ignoring callback (not Outlook)', { provider: callbackData.provider });
          }
        } else {
          Logger.warn('[EmailOAuthModal] Ignoring callback (missing success or code)', callbackData);
        }
      };

      (window as any).electronAPI.onOAuthCallback(callbackHandler);
      Logger.info('[EmailOAuthModal] OAuth callback listener registered via IPC');

      // Cleanup listener when modal closes
      return () => {
        if ((window as any).electronAPI?.removeOAuthCallback) {
          (window as any).electronAPI.removeOAuthCallback();
          Logger.info('[EmailOAuthModal] OAuth callback listener removed');
        }
      };
    } else {
      Logger.warn('[EmailOAuthModal] electronAPI.onOAuthCallback not available - OAuth callback will not work');
    }
  }, [isOpen, handleOAuthCallback]);

  const handleProviderSelect = (selectedProvider: 'outlook' | 'gmail') => {
    setProvider(selectedProvider);
    setStep('init');
  };

  const handleConnect = async () => {
    if (!provider) {
      setStep('provider-select');
      return;
    }

    try {
      setStep('authenticating');
      setErrorMessage('');

      // Get OAuth configuration from settings based on provider
      let clientId: string;
      let clientSecret: string;
      let tenantId: string | undefined;
      
      if (provider === 'gmail') {
        clientId = await PlatformService.getAppConfig('gmailClientId', '');
        clientSecret = await PlatformService.getAppConfig('gmailClientSecret', '');
        
        if (!clientId || !clientSecret) {
          throw new Error('Gmail OAuth credentials not configured. Please configure Client ID and Client Secret in Settings → Integrations → OAuth Configuration.');
        }
      } else {
        clientId = await PlatformService.getAppConfig('outlookClientId', '');
        clientSecret = await PlatformService.getAppConfig('outlookClientSecret', '');
        tenantId = await PlatformService.getAppConfig('outlookTenantId', 'common');
        
        if (!clientId || !clientSecret) {
          throw new Error('Outlook OAuth credentials not configured. Please configure Client ID and Client Secret in Settings → Integrations → OAuth Configuration.');
        }
      }

      const serverPort = await PlatformService.getAppConfig('serverPort', 4000);

      // Determine redirect URI priority:
      // 1. Cloudflare Worker URL (if configured) - Permanent, never expires
      // 2. Cloudflare Tunnel URL (if available) - For Electron with tunnel
      // 3. Current window location (web environment) - For Back4App/web hosting
      // 4. Fallback to localhost - For Electron without tunnel
      const cloudflareWorkerUrl = await PlatformService.getAppConfig('cloudflareWorkerUrl', '');
      const cloudflareUrl = await PlatformService.getAppConfig('cloudflareUrl', '');
      let redirectUri: string;
      
      if (cloudflareWorkerUrl) {
        // Use Cloudflare Worker URL - permanent solution for Back4App
        if (provider === 'gmail') {
          redirectUri = `${cloudflareWorkerUrl}/auth/gmail/callback`;
        } else {
          redirectUri = `${cloudflareWorkerUrl}/auth/outlook/callback`;
        }
      } else if (cloudflareUrl) {
        redirectUri = `${cloudflareUrl}/api/oauth/callback`;
      } else if (typeof window !== 'undefined' && window.location.origin && !isDesktop()) {
        // Web environment - use current URL
        redirectUri = `${window.location.origin}/api/oauth/callback`;
      } else {
        // Electron without tunnel - use localhost
        redirectUri = `http://localhost:${serverPort}/api/oauth/callback`;
      }

      const config: OAuthConfig = {
        clientId,
        clientSecret,
        redirectUri,
        tenantId: tenantId || 'common',
      };

      // Validate config
      const validation = OAuthService.validateOAuthConfig(config, provider);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid OAuth configuration');
      }

      // Initiate OAuth flow based on provider
      // Use IPC for Electron (required for Gmail), direct service for web
      if (isDesktop() && (window as any).electronAPI?.initiateOAuth) {
        // Use IPC to initiate OAuth in main process (required for Gmail in Electron)
        const result = await (window as any).electronAPI.initiateOAuth(provider, config, userEmail || undefined);
        if (!result.success) {
          throw new Error(result.error || 'Failed to initiate OAuth flow');
        }
        // OAuth URL is opened by main process, state is returned
        // The callback will be handled by the IPC listener
      } else {
        // Web environment or fallback - build OAuth URL manually (no googleapis needed)
        let authUrl: string;
        let state: string;
        
        if (provider === 'gmail') {
          // Build Gmail OAuth URL manually (no googleapis needed)
          // Generate random nonce using Web Crypto API
          const array = new Uint8Array(32);
          if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
            window.crypto.getRandomValues(array);
          } else {
            // Fallback for environments without crypto
            for (let i = 0; i < array.length; i++) {
              array[i] = Math.floor(Math.random() * 256);
            }
          }
          const nonce = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
          
          const stateObj = {
            provider: 'gmail',
            nonce,
            timestamp: Date.now(),
            email: userEmail || undefined
          };
          const stateJson = JSON.stringify(stateObj);
          // Use base64url encoding
          state = btoa(stateJson).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
          
          const scopes = [
            'https://www.googleapis.com/auth/gmail.modify',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
          ].join(' ');
          
          const params = new URLSearchParams({
            client_id: config.clientId,
            redirect_uri: config.redirectUri,
            response_type: 'code',
            scope: scopes,
            access_type: 'offline',
            prompt: 'consent',
            state,
          });
          
          authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
        } else {
          // Outlook OAuth - can use service directly
          const result = await OAuthService.initiateOutlookOAuth(config);
          authUrl = result.authUrl;
          state = result.state;
        }

        // Open OAuth URL
        if (typeof window !== 'undefined' && (window as any).electronAPI?.openExternal) {
          await (window as any).electronAPI.openExternal(authUrl);
        } else {
          // Fallback: open in current window
          window.open(authUrl, '_blank');
        }
      }

      // OAuth callback will be handled by the IPC listener set up in useEffect
      // The listener is already active and will call handleOAuthCallback when the callback arrives
    } catch (error: any) {
      Logger.error('[EmailOAuthModal] OAuth initiation failed:', error);
      setStep('error');
      setErrorMessage(error.message || 'Failed to initiate OAuth flow');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className={`p-6 flex justify-between items-center text-white ${provider === 'gmail' ? 'bg-[#ea4335]' : 'bg-[#0078d4]'}`}>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Mail className="w-5 h-5" />
            {provider === 'gmail' ? 'Connect Gmail Account' : provider === 'outlook' ? 'Connect Outlook Account' : 'Connect Email Account'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-8">
          {step === 'provider-select' && (
            <div className="space-y-4">
              <p className="text-slate-600 text-sm text-center">
                Choose your email provider to connect your account
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleProviderSelect('outlook')}
                  className="p-6 border-2 border-slate-200 rounded-lg hover:border-[#0078d4] hover:bg-blue-50 transition-all flex flex-col items-center gap-3"
                >
                  <div className="w-12 h-12 bg-[#0078d4] rounded-full flex items-center justify-center">
                    <Mail className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-slate-800">Outlook</p>
                    <p className="text-xs text-slate-500 mt-1">Microsoft 365</p>
                  </div>
                </button>
                <button
                  onClick={() => handleProviderSelect('gmail')}
                  className="p-6 border-2 border-slate-200 rounded-lg hover:border-[#ea4335] hover:bg-red-50 transition-all flex flex-col items-center gap-3"
                >
                  <div className="w-12 h-12 bg-[#ea4335] rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-slate-800">Gmail</p>
                    <p className="text-xs text-slate-500 mt-1">Google</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {step === 'init' && provider && (
            <div className="space-y-4">
              <p className="text-slate-600 text-sm">
                Connect your {provider === 'gmail' ? 'Gmail' : 'Outlook'} account to send and receive emails through the app.
              </p>
              <div className={`border rounded-lg p-4 ${provider === 'gmail' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                <p className={`text-sm font-semibold mb-2 ${provider === 'gmail' ? 'text-red-800' : 'text-blue-800'}`}>
                  <strong>What you'll authorize:</strong>
                </p>
                <ul className={`text-xs mt-2 space-y-1 list-disc list-inside ${provider === 'gmail' ? 'text-red-700' : 'text-blue-700'}`}>
                  <li>Send emails on your behalf</li>
                  <li>Read incoming emails</li>
                  <li>Reply to customer emails</li>
                  <li>Offline access (to keep connection active)</li>
                </ul>
              </div>
              <button
                onClick={handleConnect}
                className={`w-full px-4 py-2 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
                  provider === 'gmail' 
                    ? 'bg-[#ea4335] hover:bg-[#d33b2c]' 
                    : 'bg-[#0078d4] hover:bg-[#0064b8]'
                }`}
              >
                <Mail className="w-4 h-4" />
                Connect {provider === 'gmail' ? 'Gmail' : 'Outlook'}
              </button>
            </div>
          )}

          {step === 'authenticating' && (
            <div className="space-y-4 text-center">
              <Loader2 className={`w-12 h-12 mx-auto animate-spin ${provider === 'gmail' ? 'text-[#ea4335]' : 'text-[#0078d4]'}`} />
              <p className="text-slate-600">
                Opening {provider === 'gmail' ? 'Google' : 'Microsoft'} login page...
              </p>
              <p className="text-xs text-slate-500">
                Please complete the login in the browser window that opened.
              </p>
            </div>
          )}

          {step === 'success' && (
            <div className="space-y-4 text-center">
              <CheckCircle className="w-12 h-12 mx-auto text-green-600" />
              <p className="text-slate-800 font-medium">
                Successfully connected!
              </p>
              {userEmail && (
                <p className="text-sm text-slate-600">
                  Connected to: <strong>{userEmail}</strong>
                </p>
              )}
              <p className="text-xs text-slate-500">
                Closing in a moment...
              </p>
            </div>
          )}

          {step === 'error' && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-800 font-medium">Connection Failed</p>
                  <p className="text-xs text-red-700 mt-1">{errorMessage}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setStep('init');
                  setErrorMessage('');
                }}
                className="w-full px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailOAuthModal;
