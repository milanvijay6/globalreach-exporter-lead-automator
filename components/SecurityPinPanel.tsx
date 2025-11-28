import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { PinService } from '../services/pinService';
import { AuthService } from '../services/authService';
import { UserManagementService } from '../services/userManagementService';
import { UserService } from '../services/userService';
import { Logger } from '../services/loggerService';
import { hasAdminAccess } from '../services/permissionService';
import { Lock, Key, Shield, CheckCircle, XCircle } from 'lucide-react';

interface SecurityPinPanelProps {
  user: User;
}

const SecurityPinPanel: React.FC<SecurityPinPanelProps> = ({ user }) => {
  const [currentPin, setCurrentPin] = useState(['', '', '', '']);
  const [newPin, setNewPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
  const [currentPassword, setCurrentPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasPin, setHasPin] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);

  useEffect(() => {
    checkPinStatus();
    checkPinVerification();
  }, []);

  const checkPinStatus = async () => {
    try {
      const currentUser = await UserService.getUser(user.id);
      setHasPin(!!currentUser?.pinHash);
    } catch (error) {
      Logger.error('[SecurityPinPanel] Failed to check PIN status:', error);
    }
  };

  const checkPinVerification = () => {
    const verified = PinService.isPinVerified(user.id);
    setPinVerified(verified);
  };

  const handleSetPin = async () => {
    const newPinValue = newPin.join('');
    const confirmPinValue = confirmPin.join('');

    if (newPinValue.length !== 4) {
      setError('PIN must be exactly 4 digits');
      return;
    }

    if (newPinValue !== confirmPinValue) {
      setError('PINs do not match');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // If PIN already exists, require current password
      if (hasPin && !currentPassword) {
        setError('Please enter your current password to change PIN');
        setLoading(false);
        return;
      }

      // Verify password if provided
      if (hasPin && currentPassword) {
        const isValid = await AuthService.verifyPassword(user.id, currentPassword);
        if (!isValid) {
          setError('Incorrect password');
          setLoading(false);
          return;
        }
      }

      await PinService.setPin(user.id, newPinValue, hasPin ? currentPassword : undefined);

      setSuccess('PIN set successfully');
      setNewPin(['', '', '', '']);
      setConfirmPin(['', '', '', '']);
      setCurrentPassword('');
      await checkPinStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to set PIN');
    } finally {
      setLoading(false);
    }
  };

  const handlePinInput = (
    index: number,
    value: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    if (!/^\d*$/.test(value)) return;

    const arr = [...(setter === setNewPin ? newPin : confirmPin)];
    arr[index] = value.slice(-1);
    setter(arr);

    if (value && index < 3) {
      // Auto-focus next input would be handled by refs in a full implementation
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Shield className="w-5 h-5" /> Security & PIN
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          Manage your 4-digit PIN for app security
        </p>
      </div>

      {/* PIN Status */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-slate-900">PIN Status</p>
            <p className="text-sm text-slate-600 mt-1">
              {hasPin ? (
                <span className="flex items-center gap-2 text-green-700">
                  <CheckCircle className="w-4 h-4" /> PIN is set
                </span>
              ) : (
                <span className="flex items-center gap-2 text-yellow-700">
                  <XCircle className="w-4 h-4" /> No PIN set
                </span>
              )}
            </p>
            {pinVerified && (
              <p className="text-xs text-green-600 mt-1">PIN verified (valid for 15 minutes)</p>
            )}
          </div>
        </div>
      </div>

      {/* Set/Change PIN */}
      <div className="border border-slate-200 rounded-lg p-6">
        <h4 className="font-semibold text-slate-900 mb-4">
          {hasPin ? 'Change PIN' : 'Set PIN'}
        </h4>

        {hasPin && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Current Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              placeholder="Enter your current password"
            />
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            {hasPin ? 'New PIN' : 'PIN'} <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-3 justify-center">
            {[0, 1, 2, 3].map((index) => (
              <input
                key={index}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={newPin[index]}
                onChange={(e) => handlePinInput(index, e.target.value, setNewPin)}
                className="w-14 h-14 text-center text-2xl font-semibold border-2 border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
              />
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Confirm PIN <span className="text-red-500">*</span>
          </label>
          <div className="flex gap-3 justify-center">
            {[0, 1, 2, 3].map((index) => (
              <input
                key={index}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={confirmPin[index]}
                onChange={(e) => handlePinInput(index, e.target.value, setConfirmPin)}
                className="w-14 h-14 text-center text-2xl font-semibold border-2 border-slate-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none"
              />
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        <button
          onClick={handleSetPin}
          disabled={loading || newPin.join('').length !== 4 || confirmPin.join('').length !== 4}
          className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : hasPin ? 'Change PIN' : 'Set PIN'}
        </button>
      </div>

      {/* Admin: Reset Other Users' PINs */}
      {hasAdminAccess(user) && (
        <div className="border border-slate-200 rounded-lg p-6">
          <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Key className="w-5 h-5" /> Admin: Reset User PINs
          </h4>
          <p className="text-sm text-slate-600 mb-4">
            As an admin, you can reset other users' PINs. This requires your admin password confirmation.
          </p>
          <p className="text-xs text-slate-500">
            Use the User Management panel to reset individual user PINs.
          </p>
        </div>
      )}
    </div>
  );
};

export default SecurityPinPanel;

