import React, { useState, useEffect } from 'react';
import { PinService } from '../services/pinService';
import { loadUserSession } from '../services/securityService';
import PinVerificationModal from './PinVerificationModal';
import { Lock } from 'lucide-react';

interface PinLockScreenProps {
  isLocked: boolean;
  onUnlock: () => void;
  inactivityTimeout?: number; // in milliseconds
}

const PinLockScreen: React.FC<PinLockScreenProps> = ({
  isLocked,
  onUnlock,
  inactivityTimeout = 5 * 60 * 1000, // 5 minutes default
}) => {
  const [showPinModal, setShowPinModal] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    if (isLocked) {
      loadUser();
      setShowPinModal(true);
    } else {
      setShowPinModal(false);
    }
  }, [isLocked]);

  const loadUser = async () => {
    const currentUser = await loadUserSession();
    setUser(currentUser);
  };

  const handlePinVerify = async (success: boolean) => {
    if (success) {
      setShowPinModal(false);
      onUnlock();
    }
  };

  if (!isLocked) return null;

  return (
    <div className="fixed inset-0 bg-slate-900 z-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Lock className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">App Locked</h2>
        <p className="text-slate-400 mb-6">
          {user ? `Enter your PIN to unlock, ${user.name}` : 'Enter your PIN to unlock'}
        </p>
      </div>

      <PinVerificationModal
        isOpen={showPinModal}
        onVerify={handlePinVerify}
        title="Unlock App"
        message="Enter your 4-digit PIN to unlock the application"
      />
    </div>
  );
};

export default PinLockScreen;

