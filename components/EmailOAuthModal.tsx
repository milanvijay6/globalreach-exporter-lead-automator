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
  const [step, setStep] = useState<'init' | 'authenticating' | 'success' | 'error'>('init');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [isProcessingCallback, setIsProcessingCallback] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setStep('init');
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

    // State is optional - if missing, create a default one
    const actualState = callbackState || JSON.stringify({ provider: 'outlook', timestamp: Date.now() });

    try {
      setStep('authenticating');
      
      // Get OAuth configuration
      const clientId = await PlatformService.getAppConfig('outlookClientId', '');
      const clientSecret = await PlatformService.getAppConfig('outlookClientSecret', '');
      const tenantId = await PlatformService.getAppConfig('outlookTenantId', 'common');
      const serverPort = await PlatformService.getAppConfig('serverPort', 4000);

      // Determine redirect URI:
      // 1. Use Cloudflare Tunnel URL if available (for Electron with tunnel)
      // 2. Use current window location if in web environment (for Back4App/web hosting)
      // 3. Fallback to localhost for Electron without tunnel
      const cloudflareUrl = await PlatformService.getAppConfig('cloudflareUrl', '');
      let redirectUri: string;
      
      if (cloudflareUrl) {
        redirectUri = `${cloudflareUrl}/api/oauth/callback`;
      } else if (typeof window !== 'undefined' && window.location.origin && !isDesktop()) {
        // Web environment - use current URL
        redirectUri = `${window.location.origin}/api/oauth/callback`;
      } else {
        // Electron without tunnel - use localhost
        redirectUri = `http://localhost:${serverPort}/api/oauth/callback`;
      }
      
      Logger.info('[EmailOAuthModal] OAuth configuration', {
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
        hasCode: !!code,
        hasState: !!callbackState,
        redirectUri: config.redirectUri,
        tenantId: config.tenantId
      });
      
      const tokens = await OAuthService.handleOAuthCallback('outlook', code, callbackState, config);
      
      Logger.info('[EmailOAuthModal] Code exchange successful', {
        hasAccessToken: !!tokens.accessToken,
        hasRefreshToken: !!tokens.refreshToken
      });

      // Get user profile to get email address
      const { OutlookEmailService } = await import('../services/outlookEmailService');
      const tempCredentials: OutlookEmailCredentials = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiryDate: tokens.expiryDate,
        userEmail: '', // Will be set after getting profile
        tenantId: config.tenantId,
      };

      const profile = await OutlookEmailService.getUserProfile(tempCredentials);
      if (!profile.success || !profile.email) {
        throw new Error('Failed to get user email address');
      }

      const emailCredentials: OutlookEmailCredentials = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiryDate: tokens.expiryDate,
        userEmail: profile.email,
        tenantId: config.tenantId,
      };

      // Create and save email connection
      const connection: PlatformConnection = {
        channel: Channel.EMAIL,
        status: PlatformStatus.CONNECTED,
        accountName: profile.email,
        connectedAt: Date.now(),
        provider: 'outlook',
        emailCredentials: emailCredentials,
        healthStatus: 'healthy',
        lastTested: Date.now(),
      };
      
      await saveEmailConnection(connection);
      setUserEmail(profile.email);
      setStep('success');

      // Notify parent
      onConnected(connection);

      Logger.info('[EmailOAuthModal] Outlook connection saved successfully', {
        email: profile.email,
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
      if (!errorMsg.includes('Azure') && !errorMsg.includes('Invalid') && !errorMsg.includes('Failed')) {
        errorMsg = `OAuth connection failed: ${errorMsg}\n\n` +
          `Please check:\n` +
          `1. Client ID and Client Secret are correct in Settings\n` +
          `2. Redirect URI in Azure matches: ${config.redirectUri}\n` +
          `3. Server is running on port ${serverPort}`;
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

    if (oauthCallback === 'true' && code && state && !isProcessingCallback) {
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

  const handleConnect = async () => {
    try {
      setStep('authenticating');
      setErrorMessage('');

      // Get OAuth configuration from settings
      const clientId = await PlatformService.getAppConfig('outlookClientId', '');
      const clientSecret = await PlatformService.getAppConfig('outlookClientSecret', '');
      const tenantId = await PlatformService.getAppConfig('outlookTenantId', 'common');
      const serverPort = await PlatformService.getAppConfig('serverPort', 4000);

      if (!clientId || !clientSecret) {
        throw new Error('Outlook OAuth credentials not configured. Please configure Client ID and Client Secret in Settings → Integrations → Email & OAuth.');
      }

      // Determine redirect URI:
      // 1. Use Cloudflare Tunnel URL if available (for Electron with tunnel)
      // 2. Use current window location if in web environment (for Back4App/web hosting)
      // 3. Fallback to localhost for Electron without tunnel
      const cloudflareUrl = await PlatformService.getAppConfig('cloudflareUrl', '');
      let redirectUri: string;
      
      if (cloudflareUrl) {
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
      const validation = OAuthService.validateOAuthConfig(config, 'outlook');
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid OAuth configuration');
      }

      // Initiate OAuth flow
      const { authUrl, state } = await OAuthService.initiateOutlookOAuth(config);

      // Open OAuth URL in external browser
      if (typeof window !== 'undefined' && (window as any).electronAPI?.openExternal) {
        await (window as any).electronAPI.openExternal(authUrl);
      } else {
        // Fallback: open in current window
        window.open(authUrl, '_blank');
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
        <div className="bg-[#0078d4] p-6 flex justify-between items-center text-white">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Connect Outlook Account
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
          {step === 'init' && (
            <div className="space-y-4">
              <p className="text-slate-600 text-sm">
                Connect your Outlook account to send and receive emails through the app.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>What you'll authorize:</strong>
                </p>
                <ul className="text-xs text-blue-700 mt-2 space-y-1 list-disc list-inside">
                  <li>Send emails on your behalf</li>
                  <li>Read incoming emails</li>
                  <li>Reply to customer emails</li>
                  <li>Offline access (to keep connection active)</li>
                </ul>
              </div>
              <button
                onClick={handleConnect}
                className="w-full px-4 py-2 bg-[#0078d4] text-white font-medium rounded-lg hover:bg-[#0064b8] transition-colors flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4" />
                Connect Outlook
              </button>
            </div>
          )}

          {step === 'authenticating' && (
            <div className="space-y-4 text-center">
              <Loader2 className="w-12 h-12 mx-auto animate-spin text-[#0078d4]" />
              <p className="text-slate-600">
                Opening Microsoft login page...
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

