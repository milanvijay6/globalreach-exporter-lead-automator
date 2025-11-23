import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Download, Copy, Eye, EyeOff } from 'lucide-react';
import { User } from '../types';
import { generateMfaSecret, enableMfa, disableMfa, verifyMfaToken, generateBackupCodes, verifyBackupCode } from '../services/mfaService';
import { Logger } from '../services/loggerService';

interface MfaSetupModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onMfaEnabled?: () => void;
}

const MfaSetupModal: React.FC<MfaSetupModalProps> = ({ user, isOpen, onClose, onMfaEnabled }) => {
  const [step, setStep] = useState<'setup' | 'verify' | 'backup' | 'complete'>('setup');
  const [secret, setSecret] = useState<{ secret: string; qrCodeUrl: string } | null>(null);
  const [verificationToken, setVerificationToken] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  useEffect(() => {
    if (isOpen && !user.mfaEnabled) {
      initializeSetup();
    } else if (isOpen && user.mfaEnabled) {
      setStep('complete');
    }
  }, [isOpen, user.mfaEnabled]);

  const initializeSetup = async () => {
    try {
      setLoading(true);
      const mfaSecret = await generateMfaSecret(user.id);
      setSecret(mfaSecret);
      setStep('setup');
    } catch (error: any) {
      setError(error.message || 'Failed to generate MFA secret');
      Logger.error('[MfaSetupModal] Failed to initialize setup:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verificationToken.trim()) {
      setError('Please enter the verification code');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const isValid = await verifyMfaToken(user.id, verificationToken);
      
      if (!isValid) {
        setError('Invalid verification code. Please try again.');
        return;
      }

      // Generate backup codes
      const codes = generateBackupCodes();
      setBackupCodes(codes);

      // Enable MFA
      await enableMfa(user.id, secret!.secret, codes);
      
      setStep('backup');
    } catch (error: any) {
      setError(error.message || 'Failed to verify MFA token');
      Logger.error('[MfaSetupModal] Failed to verify:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    if (onMfaEnabled) {
      onMfaEnabled();
    }
    onClose();
    // Reset state
    setStep('setup');
    setSecret(null);
    setVerificationToken('');
    setBackupCodes([]);
    setError('');
  };

  const copyBackupCodes = () => {
    const text = backupCodes.join('\n');
    navigator.clipboard.writeText(text);
    alert('Backup codes copied to clipboard!');
  };

  const downloadBackupCodes = () => {
    const text = backupCodes.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mfa-backup-codes-${user.id}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-800">Multi-Factor Authentication</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {step === 'setup' && secret && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-slate-600 mb-4">
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
              </p>
              <div className="bg-white p-4 rounded-lg border-2 border-slate-200 inline-block">
                <img src={secret.qrCodeUrl} alt="MFA QR Code" className="w-48 h-48" />
              </div>
              <p className="text-xs text-slate-500 mt-4">
                Or enter this code manually: <code className="bg-slate-100 px-2 py-1 rounded">{secret.secret}</code>
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Enter verification code from your app
              </label>
              <input
                type="text"
                value={verificationToken}
                onChange={(e) => setVerificationToken(e.target.value.replace(/\D/g, '').substring(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-center text-2xl tracking-widest"
              />
            </div>

            <button
              onClick={handleVerify}
              disabled={loading || verificationToken.length !== 6}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-400"
            >
              {loading ? 'Verifying...' : 'Verify & Enable MFA'}
            </button>
          </div>
        )}

        {step === 'backup' && backupCodes.length > 0 && (
          <div className="space-y-4">
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800 mb-1">Save Your Backup Codes</p>
                  <p className="text-sm text-yellow-700">
                    These codes can be used to access your account if you lose your authenticator device. 
                    Each code can only be used once.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-slate-800">Backup Codes</h4>
                <div className="flex gap-2">
                  <button
                    onClick={copyBackupCodes}
                    className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg"
                    title="Copy codes"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={downloadBackupCodes}
                    className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg"
                    title="Download codes"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {showBackupCodes ? (
                <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                  {backupCodes.map((code, i) => (
                    <div key={i} className="p-2 bg-white rounded border border-slate-200 text-center">
                      {code}
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  onClick={() => setShowBackupCodes(true)}
                  className="w-full py-2 text-slate-600 hover:text-slate-800 flex items-center justify-center gap-2"
                >
                  <Eye className="w-4 h-4" /> Show Backup Codes
                </button>
              )}
            </div>

            <button
              onClick={handleComplete}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              I've Saved My Backup Codes
            </button>
          </div>
        )}

        {step === 'complete' && user.mfaEnabled && (
          <div className="space-y-4 text-center">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
              <p className="font-medium text-green-800">MFA is Enabled</p>
              <p className="text-sm text-green-700 mt-1">
                Your account is now protected with multi-factor authentication.
              </p>
            </div>

            <button
              onClick={async () => {
                if (confirm('Are you sure you want to disable MFA? This will make your account less secure.')) {
                  try {
                    await disableMfa(user.id, '');
                    if (onMfaEnabled) onMfaEnabled();
                    onClose();
                  } catch (error: any) {
                    alert('Failed to disable MFA: ' + (error.message || 'Unknown error'));
                  }
                }
              }}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Disable MFA
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MfaSetupModal;
