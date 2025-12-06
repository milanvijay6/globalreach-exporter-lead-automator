/**
 * WhatsApp Web QR Code Modal
 * Displays QR code for WhatsApp Web authentication
 */

import React, { useEffect, useState } from 'react';
import { X, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

interface WhatsAppWebQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrCode: string | null;
  status: 'waiting' | 'scanning' | 'connected' | 'error';
  error?: string;
  onRefresh?: () => void;
}

const WhatsAppWebQRModal: React.FC<WhatsAppWebQRModalProps> = ({
  isOpen,
  onClose,
  qrCode,
  status,
  error,
  onRefresh,
}) => {
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (qrCode && isOpen) {
      // Dynamically import qrcode only when needed
      import('qrcode').then(QRCode => {
        QRCode.default.toDataURL(qrCode)
          .then(url => setQrImageUrl(url))
          .catch(err => {
            console.error('Failed to generate QR code image:', err);
            setQrImageUrl(null);
          });
      }).catch(err => {
        console.error('Failed to load qrcode library:', err);
        setQrImageUrl(null);
      });
    } else {
      setQrImageUrl(null);
    }
  }, [qrCode, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-200">
          <h2 className="text-2xl font-bold text-slate-800">WhatsApp Web Authentication</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {status === 'waiting' && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-slate-600">Initializing WhatsApp Web...</p>
            </div>
          )}

          {status === 'scanning' && qrCode && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-slate-700 mb-4">
                  Scan this QR code with your phone to connect WhatsApp Web
                </p>
                {qrImageUrl ? (
                  <div className="bg-white p-4 rounded-lg border-2 border-slate-200 inline-block">
                    <img src={qrImageUrl} alt="WhatsApp QR Code" className="w-64 h-64" />
                  </div>
                ) : (
                  <div className="bg-slate-100 w-64 h-64 mx-auto rounded-lg flex items-center justify-center">
                    <p className="text-slate-500">Generating QR code...</p>
                  </div>
                )}
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Steps:</strong>
                </p>
                <ol className="text-sm text-blue-700 mt-2 space-y-1 list-decimal list-inside">
                  <li>Open WhatsApp on your phone</li>
                  <li>Tap Menu or Settings</li>
                  <li>Select "Linked Devices"</li>
                  <li>Tap "Link a Device"</li>
                  <li>Point your phone at this screen to capture the code</li>
                </ol>
              </div>
            </div>
          )}

          {status === 'connected' && (
            <div className="text-center space-y-4">
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto" />
              <p className="text-lg font-semibold text-green-700">Connected Successfully!</p>
              <p className="text-slate-600">WhatsApp Web is now ready to use.</p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center space-y-4">
              <AlertCircle className="w-16 h-16 text-red-600 mx-auto" />
              <p className="text-lg font-semibold text-red-700">Connection Failed</p>
              {error && <p className="text-slate-600">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
          {status === 'scanning' && onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center gap-2 px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh QR Code
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors"
          >
            {status === 'connected' ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppWebQRModal;

