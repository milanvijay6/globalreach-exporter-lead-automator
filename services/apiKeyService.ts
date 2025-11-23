import { ApiKey, ApiKeyProvider, User } from '../types';
import { PlatformService } from './platformService';
import { Logger } from './loggerService';
import { logAdminAction } from './auditService';
import CryptoJS from 'crypto-js';

const STORAGE_KEY_API_KEYS = 'globalreach_api_keys';
const STORAGE_KEY_ENCRYPTION_KEY = 'globalreach_encryption_key';

// Event emitter for key changes (simple implementation)
type KeyChangeEvent = 'created' | 'updated' | 'deleted' | 'revoked' | 'rotated';
type KeyChangeListener = (event: KeyChangeEvent, keyId: string, provider: ApiKeyProvider) => void;
const keyChangeListeners: KeyChangeListener[] = [];

/**
 * Subscribe to API key change events
 */
export const onKeyChange = (listener: KeyChangeListener): (() => void) => {
  keyChangeListeners.push(listener);
  return () => {
    const index = keyChangeListeners.indexOf(listener);
    if (index > -1) {
      keyChangeListeners.splice(index, 1);
    }
  };
};

/**
 * Emit key change event
 */
const emitKeyChange = (event: KeyChangeEvent, keyId: string, provider: ApiKeyProvider) => {
  keyChangeListeners.forEach(listener => {
    try {
      listener(event, keyId, provider);
    } catch (error) {
      Logger.error('[ApiKeyService] Error in key change listener:', error);
    }
  });
};

/**
 * Gets or generates the encryption key
 */
const getEncryptionKey = async (): Promise<string> => {
  try {
    // Try to load existing key
    let encryptionKey = await PlatformService.secureLoad(STORAGE_KEY_ENCRYPTION_KEY);
    
    if (!encryptionKey) {
      // Generate a new key (256 bits = 32 bytes = 64 hex chars)
      encryptionKey = CryptoJS.lib.WordArray.random(32).toString();
      await PlatformService.secureSave(STORAGE_KEY_ENCRYPTION_KEY, encryptionKey);
      Logger.info('[ApiKeyService] Generated new encryption key');
    }
    
    return encryptionKey;
  } catch (error) {
    Logger.error('[ApiKeyService] Failed to get encryption key:', error);
    throw new Error('Failed to initialize encryption key');
  }
};

/**
 * Encrypts a key value
 */
const encryptKeyValue = async (keyValue: string): Promise<string> => {
  try {
    // Check if already encrypted (starts with 'enc:')
    if (keyValue.startsWith('enc:')) {
      return keyValue;
    }
    
    const encryptionKey = await getEncryptionKey();
    const encrypted = CryptoJS.AES.encrypt(keyValue, encryptionKey).toString();
    return `enc:${encrypted}`;
  } catch (error) {
    Logger.error('[ApiKeyService] Failed to encrypt key value:', error);
    throw error;
  }
};

/**
 * Decrypts a key value
 */
const decryptKeyValue = async (encryptedValue: string): Promise<string> => {
  try {
    // Handle unencrypted keys (backward compatibility)
    if (!encryptedValue.startsWith('enc:')) {
      return encryptedValue;
    }
    
    const encryptionKey = await getEncryptionKey();
    const encrypted = encryptedValue.substring(4); // Remove 'enc:' prefix
    const decrypted = CryptoJS.AES.decrypt(encrypted, encryptionKey);
    const decryptedString = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!decryptedString) {
      throw new Error('Failed to decrypt key value - invalid encryption key or corrupted data');
    }
    
    return decryptedString;
  } catch (error) {
    Logger.error('[ApiKeyService] Failed to decrypt key value:', error);
    throw error;
  }
};

// Atomic update queue to prevent race conditions
let updateQueue: Promise<void> = Promise.resolve();
let updateLock = false;

/**
 * Executes an update operation atomically
 */
const atomicUpdate = async <T>(operation: () => Promise<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    const execute = async () => {
      if (updateLock) {
        // Wait for current operation to complete
        await updateQueue;
        return execute();
      }
      
      updateLock = true;
      updateQueue = (async () => {
        try {
          const result = await operation();
          updateLock = false;
          resolve(result);
        } catch (error) {
          updateLock = false;
          reject(error);
        }
      })();
    };
    
    execute();
  });
};

/**
 * API Key Service
 * Handles CRUD operations for API keys with encrypted storage
 */

/**
 * Creates a new API key
 */
export const createApiKey = async (
  provider: ApiKeyProvider,
  keyValue: string,
  label: string,
  user: User,
  metadata: Partial<ApiKey['metadata']> = {}
): Promise<ApiKey> => {
  return atomicUpdate(async () => {
    try {
      const apiKey: ApiKey = {
        id: `key-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        provider,
        label,
        keyValue, // Will be encrypted before storage
        metadata: {
          createdAt: Date.now(),
          createdBy: user.id,
          usageCount: 0,
          errorCount: 0,
          isActive: true,
          isPrimary: false,
          ...metadata,
        },
      };

      // Load existing keys
      const existingKeys = await getApiKeys();
      
      // If this is the first key for this provider, make it primary
      const providerKeys = existingKeys.filter(k => k.provider === provider && k.metadata.isActive);
      if (providerKeys.length === 0) {
        apiKey.metadata.isPrimary = true;
      }
      
      // Add new key
      const updatedKeys = [...existingKeys, apiKey];
      
      // Encrypt and store
      await saveApiKeys(updatedKeys);
      
      // Emit event
      emitKeyChange('created', apiKey.id, provider);
      
      // Log admin action
      await logAdminAction(user, 'api_key_created', `api_key:${apiKey.id}`, {
        provider,
        label,
      });
      
      Logger.info(`[ApiKeyService] Created API key ${apiKey.id} for provider ${provider}`);
      
      return apiKey;
    } catch (error) {
      Logger.error('[ApiKeyService] Failed to create API key:', error);
      throw error;
    }
  });
};

/**
 * Gets all API keys, optionally filtered by provider
 */
export const getApiKeys = async (provider?: ApiKeyProvider): Promise<ApiKey[]> => {
  try {
    const stored = await PlatformService.secureLoad(STORAGE_KEY_API_KEYS);
    if (!stored) return [];
    
    let keys: ApiKey[] = JSON.parse(stored);
    
    // Filter by provider if specified
    if (provider) {
      keys = keys.filter(key => key.provider === provider);
    }
    
    // Sort by creation date (newest first)
    return keys.sort((a, b) => b.metadata.createdAt - a.metadata.createdAt);
  } catch (error) {
    Logger.error('[ApiKeyService] Failed to get API keys:', error);
    return [];
  }
};

/**
 * Gets a specific API key by ID
 */
export const getApiKey = async (id: string): Promise<ApiKey | null> => {
  try {
    const keys = await getApiKeys();
    return keys.find(key => key.id === id) || null;
  } catch (error) {
    Logger.error('[ApiKeyService] Failed to get API key:', error);
    return null;
  }
};

/**
 * Updates an API key (label, limits, tags, notes, etc.)
 * Note: Cannot update keyValue directly - use rotateApiKey instead
 */
export const updateApiKey = async (
  id: string,
  updates: Partial<Omit<ApiKey, 'id' | 'keyValue'>>,
  user: User
): Promise<ApiKey> => {
  return atomicUpdate(async () => {
    try {
      const keys = await getApiKeys();
      const keyIndex = keys.findIndex(key => key.id === id);
      
      if (keyIndex === -1) {
        throw new Error(`API key ${id} not found`);
      }
      
      const existingKey = keys[keyIndex];
      const updatedKey: ApiKey = {
        ...existingKey,
        ...updates,
        id: existingKey.id, // Preserve ID
        keyValue: existingKey.keyValue, // Preserve encrypted key value
      };
      
      keys[keyIndex] = updatedKey;
      await saveApiKeys(keys);
      
      // Emit event
      emitKeyChange('updated', id, existingKey.provider);
      
      // Log admin action
      await logAdminAction(user, 'api_key_updated', `api_key:${id}`, {
        updatedFields: Object.keys(updates),
      });
      
      Logger.info(`[ApiKeyService] Updated API key ${id}`);
      
      return updatedKey;
    } catch (error) {
      Logger.error('[ApiKeyService] Failed to update API key:', error);
      throw error;
    }
  });
};

/**
 * Deletes an API key permanently
 */
export const deleteApiKey = async (id: string, user: User): Promise<boolean> => {
  return atomicUpdate(async () => {
    try {
      const keys = await getApiKeys();
      const keyToDelete = keys.find(key => key.id === id);
      
      if (!keyToDelete) {
        return false;
      }
      
      const provider = keyToDelete.provider;
      
      // Remove the key
      const updatedKeys = keys.filter(key => key.id !== id);
      
      // If deleted key was primary, make another key primary (if available)
      if (keyToDelete.metadata.isPrimary) {
        const providerKeys = updatedKeys.filter(
          k => k.provider === provider && k.metadata.isActive
        );
        if (providerKeys.length > 0) {
          providerKeys[0].metadata.isPrimary = true;
        }
      }
      
      await saveApiKeys(updatedKeys);
      
      // Emit event
      emitKeyChange('deleted', id, provider);
      
      // Log admin action
      await logAdminAction(user, 'api_key_deleted', `api_key:${id}`, {
        provider,
        label: keyToDelete.label,
      });
      
      Logger.info(`[ApiKeyService] Deleted API key ${id}`);
      
      return true;
    } catch (error) {
      Logger.error('[ApiKeyService] Failed to delete API key:', error);
      throw error;
    }
  });
};

/**
 * Revokes an API key (sets isActive=false)
 */
export const revokeApiKey = async (id: string, user: User): Promise<ApiKey> => {
  return atomicUpdate(async () => {
    try {
      const key = await getApiKey(id);
      if (!key) {
        throw new Error(`API key ${id} not found`);
      }
      
      const provider = key.provider;
      
      // If revoking primary key, make another key primary (if available)
      if (key.metadata.isPrimary) {
        const providerKeys = await getApiKeys(provider);
        const activeKeys = providerKeys.filter(
          k => k.id !== id && k.metadata.isActive
        );
        if (activeKeys.length > 0) {
          await setPrimaryKey(activeKeys[0].id, user);
        }
      }
      
      const updatedKey = await updateApiKey(
        id,
        {
          metadata: {
            ...key.metadata,
            isActive: false,
          },
        },
        user
      );
      
      // Emit event (updateApiKey will also emit, but we want a specific 'revoked' event)
      emitKeyChange('revoked', id, provider);
      
      // Log admin action
      await logAdminAction(user, 'api_key_revoked', `api_key:${id}`, {
        provider,
        label: key.label,
      });
      
      Logger.info(`[ApiKeyService] Revoked API key ${id}`);
      
      return updatedKey;
    } catch (error) {
      Logger.error('[ApiKeyService] Failed to revoke API key:', error);
      throw error;
    }
  });
};

/**
 * Rotates an API key (updates keyValue)
 */
export const rotateApiKey = async (
  id: string,
  newKeyValue: string,
  user: User,
  keepOldAsBackup: boolean = false
): Promise<ApiKey> => {
  return atomicUpdate(async () => {
    try {
      const key = await getApiKey(id);
      if (!key) {
        throw new Error(`API key ${id} not found`);
      }
      
      const provider = key.provider;
      
      // If keeping old key as backup, create a new inactive key with old value
      if (keepOldAsBackup) {
        const backupKey: ApiKey = {
          ...key,
          id: `key-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          label: `${key.label} (Backup)`,
          metadata: {
            ...key.metadata,
            isActive: false,
            isPrimary: false,
          },
        };
        
        const keys = await getApiKeys();
        keys.push(backupKey);
        await saveApiKeys(keys);
      }
      
      // Update the key with new value
      const updatedKey: ApiKey = {
        ...key,
        keyValue: newKeyValue,
        metadata: {
          ...key.metadata,
          lastRotated: Date.now(),
        },
      };
      
      const keys = await getApiKeys();
      const keyIndex = keys.findIndex(k => k.id === id);
      if (keyIndex !== -1) {
        keys[keyIndex] = updatedKey;
        await saveApiKeys(keys);
      }
      
      // Emit event
      emitKeyChange('rotated', id, provider);
      
      // Log admin action
      await logAdminAction(user, 'api_key_rotated', `api_key:${id}`, {
        provider,
        label: key.label,
        keepBackup: keepOldAsBackup,
      });
      
      Logger.info(`[ApiKeyService] Rotated API key ${id}`);
      
      return updatedKey;
    } catch (error) {
      Logger.error('[ApiKeyService] Failed to rotate API key:', error);
      throw error;
    }
  });
};

/**
 * Gets the primary API key for a provider
 */
export const getPrimaryKey = async (provider: ApiKeyProvider): Promise<ApiKey | null> => {
  try {
    const keys = await getApiKeys(provider);
    const primaryKey = keys.find(key => key.metadata.isPrimary && key.metadata.isActive);
    
    // If no primary key found, return the first active key
    if (!primaryKey) {
      const activeKeys = keys.filter(key => key.metadata.isActive);
      return activeKeys.length > 0 ? activeKeys[0] : null;
    }
    
    return primaryKey;
  } catch (error) {
    Logger.error('[ApiKeyService] Failed to get primary key:', error);
    return null;
  }
};

/**
 * Sets an API key as primary for its provider
 */
export const setPrimaryKey = async (id: string, user: User): Promise<void> => {
  return atomicUpdate(async () => {
    try {
      const key = await getApiKey(id);
      if (!key) {
        throw new Error(`API key ${id} not found`);
      }
      
      const provider = key.provider;
      
      // Get all keys for this provider
      const providerKeys = await getApiKeys(provider);
      
      // Remove primary flag from all keys in this provider
      const updatedKeys = providerKeys.map(k => ({
        ...k,
        metadata: {
          ...k.metadata,
          isPrimary: k.id === id && k.metadata.isActive, // Only set primary if active
        },
      }));
      
      await saveApiKeys(updatedKeys);
      
      // Emit event
      emitKeyChange('updated', id, provider);
      
      // Log admin action
      await logAdminAction(user, 'api_key_set_primary', `api_key:${id}`, {
        provider,
      });
      
      Logger.info(`[ApiKeyService] Set API key ${id} as primary for provider ${provider}`);
    } catch (error) {
      Logger.error('[ApiKeyService] Failed to set primary key:', error);
      throw error;
    }
  });
};

/**
 * Gets the decrypted key value for an API key
 * WARNING: Only use this when actually making API calls, never log or expose
 */
export const getDecryptedKeyValue = async (id: string): Promise<string | null> => {
  try {
    const key = await getApiKey(id);
    if (!key || !key.metadata.isActive) {
      return null;
    }
    
    // Decrypt the key value
    const decrypted = await decryptKeyValue(key.keyValue);
    return decrypted;
  } catch (error) {
    Logger.error('[ApiKeyService] Failed to get decrypted key value:', error);
    // Don't log the actual key value for security
    return null;
  }
};

/**
 * Internal helper to save API keys (encrypted)
 */
const saveApiKeys = async (keys: ApiKey[]): Promise<void> => {
  try {
    // Encrypt all keyValue fields before storage
    const keysToSave = await Promise.all(
      keys.map(async (key) => {
        // Only encrypt if not already encrypted
        const encryptedValue = key.keyValue.startsWith('enc:')
          ? key.keyValue
          : await encryptKeyValue(key.keyValue);
        
        return {
          ...key,
          keyValue: encryptedValue,
        };
      })
    );
    
    await PlatformService.secureSave(STORAGE_KEY_API_KEYS, JSON.stringify(keysToSave));
  } catch (error) {
    Logger.error('[ApiKeyService] Failed to save API keys:', error);
    throw error;
  }
};
