import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle, XCircle, AlertCircle, HelpCircle, ExternalLink } from 'lucide-react';
import { AuthStep, AuthError } from '../types';

interface AuthProgressModalProps {
  isOpen: boolean;
  currentStep: AuthStep;
  provider?: 'gmail' | 'outlook' | 'custom';
  error?: AuthError;
  onClose?: () => void;
  onRetry?: () => void;
  onHelp?: () => void;
}

const AuthProgressModal: React.FC<AuthProgressModalProps> = ({
  isOpen,
  currentStep,
  provider,
  error,
  onClose,
  onRetry,
  onHelp,
}) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setProgress(0);
      return;
    }

    // Update progress based on step
    const stepProgress: Record<AuthStep, number> = {
      [AuthStep.IDLE]: 0,
      [AuthStep.INITIATING]: 20,
      [AuthStep.AUTHENTICATING]: 50,
      [AuthStep.EXCHANGING]: 80,
      [AuthStep.CONNECTED]: 100,
      [AuthStep.ERROR]: 0,
    };

    setProgress(stepProgress[currentStep] || 0);
  }, [currentStep, isOpen]);

  if (!isOpen) return null;

  const providerName = provider === 'gmail' ? 'Gmail' :
                       provider === 'outlook' ? 'Outlook' : 'Email Provider';

  const getStepMessage = (): string => {
    switch (currentStep) {
      case AuthStep.IDLE:
        return 'Ready to connect...';
      case AuthStep.INITIATING:
        return `Connecting to ${providerName}...`;
      case AuthStep.AUTHENTICATING:
        return `Authenticating with ${providerName}...`;
      case AuthStep.EXCHANGING:
        return 'Completing connection...';
      case AuthStep.CONNECTED:
        return `Successfully connected to ${providerName}!`;
      case AuthStep.ERROR:
        return error?.message || 'Connection failed';
      default:
        return 'Processing...';
    }
  };

  const getStepIcon = () => {
    if (currentStep === AuthStep.CONNECTED) {
      return <CheckCircle className="w-8 h-8 text-green-500" />;
    }
    if (currentStep === AuthStep.ERROR) {
      return <XCircle className="w-8 h-8 text-red-500" />;
    }
    return <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-center mb-6">
          {getStepIcon()}
        </div>

        {/* Progress Bar */}
        {currentStep !== AuthStep.ERROR && currentStep !== AuthStep.CONNECTED && (
          <div className="mb-6">
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2 text-center">{progress}%</p>
          </div>
        )}

        {/* Status Message */}
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            {currentStep === AuthStep.CONNECTED ? 'Connection Successful!' :
             currentStep === AuthStep.ERROR ? 'Connection Failed' :
             `Connecting to ${providerName}`}
          </h3>
          <p className="text-sm text-slate-600">{getStepMessage()}</p>
        </div>

        {/* Error Details */}
        {currentStep === AuthStep.ERROR && error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">{error.message}</p>
                {error.code && (
                  <p className="text-xs text-red-600 mt-1">Error Code: {error.code}</p>
                )}
                {error.retryable && (
                  <p className="text-xs text-red-600 mt-1">You can try again.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Success Message */}
        {currentStep === AuthStep.CONNECTED && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">
              Your {providerName} account has been successfully connected. You can now send and receive emails.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {currentStep === AuthStep.ERROR && error?.retryable && onRetry && (
            <button
              onClick={onRetry}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Try Again
            </button>
          )}
          
          {onHelp && (
            <button
              onClick={onHelp}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <HelpCircle className="w-4 h-4" />
              Help
            </button>
          )}

          {(currentStep === AuthStep.CONNECTED || currentStep === AuthStep.ERROR) && onClose && (
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
            >
              {currentStep === AuthStep.CONNECTED ? 'Done' : 'Close'}
            </button>
          )}
        </div>

        {/* Help Link */}
        {currentStep === AuthStep.ERROR && error?.code && (
          <div className="mt-4 text-center">
            <a
              href={`https://support.globalreach.app/troubleshooting/${error.code.toLowerCase()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center justify-center gap-1"
            >
              <ExternalLink className="w-3 h-3" />
              Troubleshooting Guide
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthProgressModal;

