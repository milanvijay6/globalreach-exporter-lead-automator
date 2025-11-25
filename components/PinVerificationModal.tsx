import React, { useState, useRef, useEffect } from 'react';
import { PinService } from '../services/pinService';
import { Lock, X } from 'lucide-react';

interface PinVerificationModalProps {
  isOpen: boolean;
  onVerify: (success: boolean) => void;
  onCancel?: () => void;
  title?: string;
  message?: string;
}

const PinVerificationModal: React.FC<PinVerificationModalProps> = ({
  isOpen,
  onVerify,
  onCancel,
  title = 'Enter PIN',
  message = 'Please enter your 4-digit PIN to continue',
}) => {
  const [pin, setPin] = useState(['', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setPin(['', '', '', '']);
      setError(null);
      // Focus first input
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits

    const newPin = [...pin];
    newPin[index] = value.slice(-1); // Only take last character
    setPin(newPin);
    setError(null);

    // Auto-focus next input
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 4 digits entered
    if (newPin.every(d => d !== '') && newPin.join('').length === 4) {
      handleSubmit(newPin.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').slice(0, 4);
    if (/^\d{4}$/.test(pasted)) {
      const newPin = pasted.split('');
      setPin(newPin);
      inputRefs.current[3]?.focus();
      handleSubmit(pasted);
    }
  };

  const handleSubmit = async (pinValue?: string) => {
    const pinToVerify = pinValue || pin.join('');
    
    if (pinToVerify.length !== 4) {
      setError('Please enter a 4-digit PIN');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get current user from session
      const { loadUserSession } = await import('../services/securityService');
      const user = await loadUserSession();
      
      if (!user) {
        setError('No user session found');
        setLoading(false);
        return;
      }

      const isValid = await PinService.verifyPin(user.id, pinToVerify);
      
      if (isValid) {
        setPin(['', '', '', '']);
        onVerify(true);
      } else {
        setError('Incorrect PIN. Please try again.');
        setPin(['', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (err: any) {
      setError(err.message || 'PIN verification failed');
      setPin(['', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <p className="text-sm text-slate-600 mb-6">{message}</p>

        <div className="flex gap-3 justify-center mb-4">
          {[0, 1, 2, 3].map((index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={pin[index]}
              onChange={(e) => handlePinChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              className="w-14 h-14 text-center text-2xl font-semibold border-2 border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
              disabled={loading}
            />
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => handleSubmit()}
            disabled={loading || pin.join('').length !== 4}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PinVerificationModal;

