import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Key, Eye, EyeOff, RotateCw, AlertCircle, CheckCircle, X, Tag, Info, Activity } from 'lucide-react';
import { ApiKey, ApiKeyProvider, User } from '../types';
import { getApiKeys, createApiKey, updateApiKey, deleteApiKey, revokeApiKey, rotateApiKey, setPrimaryKey } from '../services/apiKeyService';
import { validateApiKey, sanitizeInput } from '../services/validationService';
import { canManageApiKeys } from '../services/permissionService';
import { Logger } from '../services/loggerService';
import { ToastContainer, useToast, showToast } from './Toast';

interface ApiKeyManagementTabProps {
  user: User;
}

/**
 * Masks an API key showing only first 4 and last 4 characters
 */
const maskApiKey = (keyValue: string): string => {
  if (!keyValue || keyValue.length <= 8) {
    return '••••••••';
  }
  const first = keyValue.substring(0, 4);
  const last = keyValue.substring(keyValue.length - 4);
  return `${first}...${last}`;
};

const ApiKeyManagementTab: React.FC<ApiKeyManagementTabProps> = ({ user }) => {
  const { toasts, removeToast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<ApiKey | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<ApiKey | null>(null);
  const [showRotateModal, setShowRotateModal] = useState<ApiKey | null>(null);
  const [filterProvider, setFilterProvider] = useState<ApiKeyProvider | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Add form state
  const [newKeyProvider, setNewKeyProvider] = useState<ApiKeyProvider>(ApiKeyProvider.GEMINI);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [newKeyShowValue, setNewKeyShowValue] = useState(false);
  const [newKeyLimits, setNewKeyLimits] = useState({ dailyLimit: '', monthlyLimit: '', rateLimitPerMinute: '' });
  const [newKeyTags, setNewKeyTags] = useState('');
  const [newKeyNotes, setNewKeyNotes] = useState('');
  const [addError, setAddError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    if (canManageApiKeys(user)) {
      loadKeys();
    }
  }, [user]);

  const loadKeys = async () => {
    try {
      setLoading(true);
      const allKeys = await getApiKeys();
      setKeys(allKeys);
    } catch (error) {
      Logger.error('[ApiKeyManagementTab] Failed to load keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddKey = async () => {
    setAddError('');
    
    // Validate
    const validation = validateApiKey(newKeyProvider, newKeyValue);
    if (!validation.isValid) {
      setAddError(validation.errors.join(', '));
      return;
    }

    if (!newKeyLabel.trim()) {
      setAddError('Label is required');
      return;
    }

    try {
      setAddLoading(true);
      const sanitizedLabel = sanitizeInput(newKeyLabel, 'label');
      const sanitizedValue = sanitizeInput(newKeyValue, 'key');
      
      await createApiKey(
        newKeyProvider,
        sanitizedValue,
        sanitizedLabel,
        user,
        {
          limits: {
            dailyLimit: newKeyLimits.dailyLimit ? parseInt(newKeyLimits.dailyLimit) : undefined,
            monthlyLimit: newKeyLimits.monthlyLimit ? parseInt(newKeyLimits.monthlyLimit) : undefined,
            rateLimitPerMinute: newKeyLimits.rateLimitPerMinute ? parseInt(newKeyLimits.rateLimitPerMinute) : undefined,
          },
          tags: newKeyTags.split(',').map(t => t.trim()).filter(t => t),
          notes: sanitizeInput(newKeyNotes, 'notes'),
        }
      );

      // Reset form
      setNewKeyProvider(ApiKeyProvider.GEMINI);
      setNewKeyLabel('');
      setNewKeyValue('');
      setNewKeyLimits({ dailyLimit: '', monthlyLimit: '', rateLimitPerMinute: '' });
      setNewKeyTags('');
      setNewKeyNotes('');
      setShowAddModal(false);
      
      await loadKeys();
      showToast('API key created successfully', 'success');
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to create API key';
      setAddError(errorMsg);
      showToast(errorMsg, 'error');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteKey = async (key: ApiKey) => {
    try {
      await deleteApiKey(key.id, user);
      setShowDeleteModal(null);
      await loadKeys();
      showToast(`API key "${key.label}" deleted successfully`, 'success');
    } catch (error: any) {
      Logger.error('[ApiKeyManagementTab] Failed to delete key:', error);
      const errorMsg = error.message || 'Unknown error';
      showToast(`Failed to delete API key: ${errorMsg}`, 'error');
    }
  };

  const handleRevokeKey = async (key: ApiKey) => {
    try {
      await revokeApiKey(key.id, user);
      await loadKeys();
      showToast(`API key "${key.label}" revoked successfully`, 'success');
    } catch (error: any) {
      Logger.error('[ApiKeyManagementTab] Failed to revoke key:', error);
      const errorMsg = error.message || 'Unknown error';
      showToast(`Failed to revoke API key: ${errorMsg}`, 'error');
    }
  };

  const handleRotateKey = async (key: ApiKey, newValue: string) => {
    try {
      await rotateApiKey(key.id, newValue, user, false);
      setShowRotateModal(null);
      await loadKeys();
      showToast(`API key "${key.label}" rotated successfully`, 'success');
    } catch (error: any) {
      Logger.error('[ApiKeyManagementTab] Failed to rotate key:', error);
      const errorMsg = error.message || 'Unknown error';
      showToast(`Failed to rotate API key: ${errorMsg}`, 'error');
    }
  };

  const handleSetPrimary = async (key: ApiKey) => {
    try {
      await setPrimaryKey(key.id, user);
      await loadKeys();
      showToast(`API key "${key.label}" set as primary`, 'success');
    } catch (error: any) {
      Logger.error('[ApiKeyManagementTab] Failed to set primary key:', error);
      const errorMsg = error.message || 'Unknown error';
      showToast(`Failed to set primary key: ${errorMsg}`, 'error');
    }
  };

  const handleUpdateKey = async (
    id: string,
    updates: Partial<Omit<ApiKey, 'id' | 'keyValue' | 'provider'>>
  ) => {
    try {
      await updateApiKey(id, updates, user);
      setShowEditModal(null);
      await loadKeys();
      showToast('API key updated successfully', 'success');
    } catch (error: any) {
      Logger.error('[ApiKeyManagementTab] Failed to update key:', error);
      const errorMsg = error.message || 'Unknown error';
      showToast(`Failed to update API key: ${errorMsg}`, 'error');
    }
  };

  if (!canManageApiKeys(user)) {
    return (
      <div className="p-8 text-center text-slate-500">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-slate-400" />
        <p>You don't have permission to manage API keys.</p>
      </div>
    );
  }

  const filteredKeys = keys.filter(key => {
    if (filterProvider !== 'all' && key.provider !== filterProvider) return false;
    if (searchQuery && !key.label.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const getProviderIcon = (provider: ApiKeyProvider) => {
    return <Key className="w-4 h-4" />;
  };

  const getProviderColor = (provider: ApiKeyProvider) => {
    const colors: Record<ApiKeyProvider, string> = {
      [ApiKeyProvider.GEMINI]: 'bg-purple-100 text-purple-700',
      [ApiKeyProvider.WHATSAPP]: 'bg-green-100 text-green-700',
      [ApiKeyProvider.WECHAT]: 'bg-emerald-100 text-emerald-700',
      [ApiKeyProvider.EMAIL_GMAIL]: 'bg-red-100 text-red-700',
      [ApiKeyProvider.EMAIL_OUTLOOK]: 'bg-blue-100 text-blue-700',
      [ApiKeyProvider.EMAIL_SMTP]: 'bg-slate-100 text-slate-700',
      [ApiKeyProvider.CUSTOM]: 'bg-indigo-100 text-indigo-700',
    };
    return colors[provider] || 'bg-slate-100 text-slate-700';
  };

  // Calculate success rate for a key
  const getSuccessRate = (key: ApiKey): number => {
    if (key.metadata.usageCount === 0) return 1.0;
    const successCount = key.metadata.usageCount - key.metadata.errorCount;
    return successCount / key.metadata.usageCount;
  };

  // Get health status for a key
  const getHealthStatus = (key: ApiKey): { status: 'healthy' | 'warning' | 'critical'; color: string } => {
    if (!key.metadata.isActive) {
      return { status: 'critical', color: 'bg-red-100 text-red-700' };
    }
    const successRate = getSuccessRate(key);
    if (successRate >= 0.95) {
      return { status: 'healthy', color: 'bg-green-100 text-green-700' };
    } else if (successRate >= 0.80) {
      return { status: 'warning', color: 'bg-yellow-100 text-yellow-700' };
    } else {
      return { status: 'critical', color: 'bg-red-100 text-red-700' };
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading API keys...</div>;
  }

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {/* Filters and Search */}
      <div className="flex gap-4 items-center">
        <select
          value={filterProvider}
          onChange={(e) => setFilterProvider(e.target.value as ApiKeyProvider | 'all')}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
        >
          <option value="all">All Providers</option>
          {Object.values(ApiKeyProvider).map(provider => (
            <option key={provider} value={provider}>{provider}</option>
          ))}
        </select>
        
        <input
          type="text"
          placeholder="Search by label..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
        
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" /> Add Key
        </button>
      </div>

      {/* Keys List */}
      <div className="space-y-2">
        {filteredKeys.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Key className="w-12 h-12 mx-auto mb-4 text-slate-400" />
            <p>No API keys found. Add your first API key to get started.</p>
          </div>
        ) : (
          filteredKeys.map(key => (
            <div
              key={key.id}
              className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-lg ${getProviderColor(key.provider)}`}>
                      {getProviderIcon(key.provider)}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-800">{key.label}</h4>
                      <p className="text-xs text-slate-500">{key.provider}</p>
                    </div>
                    {key.metadata.isPrimary && (
                      <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs font-medium rounded">
                        Primary
                      </span>
                    )}
                    {!key.metadata.isActive && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded">
                        Revoked
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4 text-sm text-slate-600 mt-3">
                    <div>
                      <span className="text-slate-500">Usage:</span> {key.metadata.usageCount}
                    </div>
                    <div>
                      <span className="text-slate-500">Errors:</span> {key.metadata.errorCount}
                    </div>
                    <div>
                      <span className="text-slate-500">Success Rate:</span>{' '}
                      <span className="font-medium">
                        {(getSuccessRate(key) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Last Used:</span>{' '}
                      {key.metadata.lastUsed
                        ? new Date(key.metadata.lastUsed).toLocaleDateString()
                        : 'Never'}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <Activity className="w-3 h-3 text-slate-400" />
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${getHealthStatus(key).color}`}>
                      {getHealthStatus(key).status.toUpperCase()}
                    </span>
                  </div>
                  
                  {key.tags && key.tags.length > 0 && (
                    <div className="flex items-center gap-2 mt-2">
                      <Tag className="w-3 h-3 text-slate-400" />
                      <div className="flex gap-1">
                        {key.tags.map((tag, i) => (
                          <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2">
                  {key.metadata.isActive && !key.metadata.isPrimary && (
                    <button
                      onClick={() => handleSetPrimary(key)}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                      title="Set as Primary"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                  {key.metadata.isActive && (
                    <button
                      onClick={() => setShowRotateModal(key)}
                      className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                      title="Rotate Key"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                  )}
                  {key.metadata.isActive && (
                    <button
                      onClick={() => handleRevokeKey(key)}
                      className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg"
                      title="Revoke Key"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => setShowEditModal(key)}
                    className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                    title="Edit Key"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowDeleteModal(key)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    title="Delete Key"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Key Modal */}
      {showAddModal && (
        <AddKeyModal
          provider={newKeyProvider}
          setProvider={setNewKeyProvider}
          label={newKeyLabel}
          setLabel={setNewKeyLabel}
          keyValue={newKeyValue}
          setKeyValue={setNewKeyValue}
          showValue={newKeyShowValue}
          setShowValue={setNewKeyShowValue}
          limits={newKeyLimits}
          setLimits={setNewKeyLimits}
          tags={newKeyTags}
          setTags={setNewKeyTags}
          notes={newKeyNotes}
          setNotes={setNewKeyNotes}
          error={addError}
          loading={addLoading}
          onSave={handleAddKey}
          onClose={() => {
            setShowAddModal(false);
            setAddError('');
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <DeleteKeyModal
          key={showDeleteModal}
          onConfirm={() => handleDeleteKey(showDeleteModal)}
          onCancel={() => setShowDeleteModal(null)}
        />
      )}

      {/* Rotate Key Modal */}
      {showRotateModal && (
        <RotateKeyModal
          key={showRotateModal}
          onRotate={(newValue) => handleRotateKey(showRotateModal, newValue)}
          onCancel={() => setShowRotateModal(null)}
        />
      )}

      {/* Edit Key Modal */}
      {showEditModal && (
        <EditKeyModal
          key={showEditModal}
          apiKey={showEditModal}
          onSave={(updates) => handleUpdateKey(showEditModal.id, updates)}
          onCancel={() => setShowEditModal(null)}
        />
      )}
    </div>
  );
};

// Add Key Modal Component
const AddKeyModal: React.FC<{
  provider: ApiKeyProvider;
  setProvider: (p: ApiKeyProvider) => void;
  label: string;
  setLabel: (l: string) => void;
  keyValue: string;
  setKeyValue: (v: string) => void;
  showValue: boolean;
  setShowValue: (s: boolean) => void;
  limits: { dailyLimit: string; monthlyLimit: string; rateLimitPerMinute: string };
  setLimits: (l: typeof limits) => void;
  tags: string;
  setTags: (t: string) => void;
  notes: string;
  setNotes: (n: string) => void;
  error: string;
  loading: boolean;
  onSave: () => void;
  onClose: () => void;
}> = ({
  provider, setProvider, label, setLabel, keyValue, setKeyValue, showValue, setShowValue,
  limits, setLimits, tags, setTags, notes, setNotes, error, loading, onSave, onClose
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-800">Add API Key</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Provider <span className="text-red-500">*</span>
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as ApiKeyProvider)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            >
              {Object.values(ApiKeyProvider).map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Label <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Production Gemini Key"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              API Key Value <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showValue ? 'text' : 'password'}
                value={keyValue}
                onChange={(e) => setKeyValue(e.target.value)}
                placeholder="Enter your API key"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg pr-10"
              />
              <button
                type="button"
                onClick={() => setShowValue(!showValue)}
                className="absolute right-2 top-2.5 text-slate-500 hover:text-slate-700"
              >
                {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Daily Limit</label>
              <input
                type="number"
                value={limits.dailyLimit}
                onChange={(e) => setLimits({ ...limits, dailyLimit: e.target.value })}
                placeholder="Optional"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Limit</label>
              <input
                type="number"
                value={limits.monthlyLimit}
                onChange={(e) => setLimits({ ...limits, monthlyLimit: e.target.value })}
                placeholder="Optional"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rate Limit/min</label>
              <input
                type="number"
                value={limits.rateLimitPerMinute}
                onChange={(e) => setLimits({ ...limits, rateLimitPerMinute: e.target.value })}
                placeholder="Optional"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="production, backup, etc."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this key"
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={loading || !label.trim() || !keyValue.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-400"
          >
            {loading ? 'Saving...' : 'Save Key'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Delete Confirmation Modal
const DeleteKeyModal: React.FC<{
  key: ApiKey;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ key, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-red-100 rounded-full">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Delete API Key</h3>
            <p className="text-sm text-slate-500">This action cannot be undone</p>
          </div>
        </div>

        <p className="mb-4 text-slate-700">
          Are you sure you want to delete <strong>{key.label}</strong>? This will permanently remove the key and may affect services using it.
        </p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// Rotate Key Modal
const RotateKeyModal: React.FC<{
  key: ApiKey;
  onRotate: (newValue: string) => void;
  onCancel: () => void;
}> = ({ key, onRotate, onCancel }) => {
  const [newValue, setNewValue] = useState('');
  const [showValue, setShowValue] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800">Rotate API Key</h3>
          <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="mb-4 text-slate-600 text-sm">
          Enter the new API key value for <strong>{key.label}</strong>. The old key will be deactivated.
        </p>

        <div className="relative mb-4">
          <input
            type={showValue ? 'text' : 'password'}
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Enter new API key"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg pr-10"
          />
          <button
            type="button"
            onClick={() => setShowValue(!showValue)}
            className="absolute right-2 top-2.5 text-slate-500 hover:text-slate-700"
          >
            {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => onRotate(newValue)}
            disabled={!newValue.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-400"
          >
            Rotate Key
          </button>
        </div>
      </div>
    </div>
  );
};

// Edit Key Modal
const EditKeyModal: React.FC<{
  apiKey: ApiKey;
  onSave: (updates: Partial<Omit<ApiKey, 'id' | 'keyValue' | 'provider'>>) => void;
  onCancel: () => void;
}> = ({ apiKey, onSave, onCancel }) => {
  const [label, setLabel] = useState(apiKey.label);
  const [tags, setTags] = useState(apiKey.tags?.join(', ') || '');
  const [notes, setNotes] = useState(apiKey.notes || '');
  const [limits, setLimits] = useState({
    dailyLimit: apiKey.limits?.dailyLimit?.toString() || '',
    monthlyLimit: apiKey.limits?.monthlyLimit?.toString() || '',
    rateLimitPerMinute: apiKey.limits?.rateLimitPerMinute?.toString() || '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setError('');
    
    if (!label.trim()) {
      setError('Label is required');
      return;
    }

    try {
      setLoading(true);
      const sanitizedLabel = sanitizeInput(label, 'label');
      const sanitizedNotes = sanitizeInput(notes, 'notes');
      
      onSave({
        label: sanitizedLabel,
        tags: tags.split(',').map(t => t.trim()).filter(t => t),
        notes: sanitizedNotes,
        limits: {
          dailyLimit: limits.dailyLimit ? parseInt(limits.dailyLimit) : undefined,
          monthlyLimit: limits.monthlyLimit ? parseInt(limits.monthlyLimit) : undefined,
          rateLimitPerMinute: limits.rateLimitPerMinute ? parseInt(limits.rateLimitPerMinute) : undefined,
        },
      });
    } catch (error: any) {
      setError(error.message || 'Failed to update API key');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-800">Edit API Key</h3>
          <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Provider
            </label>
            <input
              type="text"
              value={apiKey.provider}
              disabled
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500"
            />
            <p className="text-xs text-slate-500 mt-1">Provider cannot be changed</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Label <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Production Gemini Key"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              API Key Value
            </label>
            <div className="px-3 py-2 border border-slate-300 rounded-lg bg-slate-50">
              <code className="text-sm text-slate-600">{maskApiKey(apiKey.keyValue)}</code>
            </div>
            <p className="text-xs text-slate-500 mt-1">Key value cannot be edited. Use "Rotate Key" to change it.</p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Daily Limit</label>
              <input
                type="number"
                value={limits.dailyLimit}
                onChange={(e) => setLimits({ ...limits, dailyLimit: e.target.value })}
                placeholder="Optional"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Limit</label>
              <input
                type="number"
                value={limits.monthlyLimit}
                onChange={(e) => setLimits({ ...limits, monthlyLimit: e.target.value })}
                placeholder="Optional"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rate Limit/min</label>
              <input
                type="number"
                value={limits.rateLimitPerMinute}
                onChange={(e) => setLimits({ ...limits, rateLimitPerMinute: e.target.value })}
                placeholder="Optional"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="production, backup, etc."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes about this key"
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !label.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-400"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyManagementTab;
