import React, { useState, useEffect } from 'react';
import { SourceCodeProtectionService } from '../services/sourceCodeProtectionService';
import { OwnerAuthService } from '../services/ownerAuthService';
import { Logger } from '../services/loggerService';
import { Code, Lock, X, FileText, AlertCircle } from 'lucide-react';

interface SourceCodeViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

const SourceCodeViewer: React.FC<SourceCodeViewerProps> = ({ isOpen, onClose }) => {
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');

  useEffect(() => {
    if (!isOpen) {
      setAccessToken(null);
      setOwnerEmail('');
      setOwnerPassword('');
      setError(null);
      setSelectedFile(null);
      setFileContent('');
    }
  }, [isOpen]);

  const handleRequestAccess = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await SourceCodeProtectionService.requestSourceCodeAccess(
        ownerEmail,
        ownerPassword
      );

      if (result.granted && result.token) {
        setAccessToken(result.token);
        setOwnerPassword(''); // Clear password
      } else {
        setError(result.error || 'Access denied');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to request access');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadFile = async (filePath: string) => {
    try {
      // In a real implementation, this would load the file content
      // For now, we'll show a placeholder
      setFileContent(`// File: ${filePath}\n// Source code access granted\n// Content would be loaded here in production`);
      setSelectedFile(filePath);
    } catch (err: any) {
      setError(`Failed to load file: ${err.message}`);
    }
  };

  if (!isOpen) return null;

  // If access not granted, show authentication form
  if (!accessToken) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-semibold">Source Code Access</h3>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <p className="text-sm text-yellow-800">
                Owner re-authentication required. Even if you're already logged in as owner,
                you must verify your credentials again to access source code.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Owner Email
              </label>
              <input
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                placeholder="milanvijay24@gmail.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Owner Password
              </label>
              <input
                type="password"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                placeholder="Enter owner password"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleRequestAccess}
                disabled={loading || !ownerEmail || !ownerPassword}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Request Access'}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Access granted - show file browser
  const protectedPaths = SourceCodeProtectionService.getProtectedPaths();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-6xl h-[90vh] mx-4 flex flex-col">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-semibold">Source Code Viewer</h3>
            <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
              Access Granted
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-64 border-r border-slate-200 overflow-y-auto p-4">
            <h4 className="font-semibold text-slate-900 mb-3">Protected Files</h4>
            <div className="space-y-1">
              {protectedPaths.map((path) => (
                <button
                  key={path}
                  onClick={() => handleLoadFile(path)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedFile === path
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <FileText className="w-4 h-4 inline mr-2" />
                  {path}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {selectedFile ? (
              <div>
                <h4 className="font-semibold text-slate-900 mb-4">{selectedFile}</h4>
                <pre className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm overflow-x-auto">
                  <code>{fileContent}</code>
                </pre>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                <div className="text-center">
                  <Code className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                  <p>Select a file to view</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500">
            Access expires in 15 minutes. Source code access is logged for security audit.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SourceCodeViewer;

