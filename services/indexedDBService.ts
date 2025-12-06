/**
 * IndexedDB Service
 * Provides structured data storage with offline support
 * Works in both web and Electron environments
 */

const DB_NAME = 'globalreach_db';
const DB_VERSION = 1;

interface StoreConfig {
  name: string;
  keyPath: string;
  indexes?: { name: string; keyPath: string; unique?: boolean }[];
}

const STORES: StoreConfig[] = [
  {
    name: 'importers',
    keyPath: 'id',
    indexes: [
      { name: 'userId', keyPath: 'userId', unique: false },
      { name: 'status', keyPath: 'status', unique: false },
      { name: 'lastContacted', keyPath: 'lastContacted', unique: false }
    ]
  },
  {
    name: 'products',
    keyPath: 'id',
    indexes: [
      { name: 'userId', keyPath: 'userId', unique: false },
      { name: 'category', keyPath: 'category', unique: false },
      { name: 'status', keyPath: 'status', unique: false }
    ]
  },
  {
    name: 'messages',
    keyPath: 'id',
    indexes: [
      { name: 'importerId', keyPath: 'importerId', unique: false },
      { name: 'timestamp', keyPath: 'timestamp', unique: false }
    ]
  },
  {
    name: 'users',
    keyPath: 'id'
  },
  {
    name: 'campaigns',
    keyPath: 'id',
    indexes: [
      { name: 'userId', keyPath: 'userId', unique: false }
    ]
  },
  {
    name: 'calendarEvents',
    keyPath: 'id',
    indexes: [
      { name: 'userId', keyPath: 'userId', unique: false },
      { name: 'date', keyPath: 'date', unique: false }
    ]
  },
  {
    name: 'syncQueue',
    keyPath: 'id',
    indexes: [
      { name: 'type', keyPath: 'type', unique: false },
      { name: 'status', keyPath: 'status', unique: false }
    ]
  },
  {
    name: 'apiCache',
    keyPath: 'id',
    indexes: [
      { name: 'url', keyPath: 'url', unique: false },
      { name: 'expiresAt', keyPath: 'expiresAt', unique: false }
    ]
  }
];

let dbInstance: IDBDatabase | null = null;
let dbInitPromise: Promise<IDBDatabase> | null = null;

/**
 * Initialize IndexedDB database
 */
function initDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  if (dbInitPromise) {
    return dbInitPromise;
  }

  dbInitPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      dbInitPromise = null;
      reject(new Error(`Failed to open database: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create all stores
      STORES.forEach(storeConfig => {
        if (!db.objectStoreNames.contains(storeConfig.name)) {
          const store = db.createObjectStore(storeConfig.name, {
            keyPath: storeConfig.keyPath
          });

          // Create indexes
          if (storeConfig.indexes) {
            storeConfig.indexes.forEach(indexConfig => {
              store.createIndex(indexConfig.name, indexConfig.keyPath, {
                unique: indexConfig.unique || false
              });
            });
          }
        }
      });
    };
  });

  return dbInitPromise;
}

/**
 * Get database instance
 */
async function getDB(): Promise<IDBDatabase> {
  return await initDB();
}

/**
 * Generic method to add/update items
 */
async function put<T extends { id: string }>(
  storeName: string,
  items: T | T[]
): Promise<void> {
  const db = await getDB();
  const transaction = db.transaction([storeName], 'readwrite');
  const store = transaction.objectStore(storeName);
  const itemsArray = Array.isArray(items) ? items : [items];

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);

    itemsArray.forEach(item => {
      store.put(item);
    });
  });
}

/**
 * Generic method to get items
 */
async function get<T>(storeName: string, id: string): Promise<T | undefined> {
  const db = await getDB();
  const transaction = db.transaction([storeName], 'readonly');
  const store = transaction.objectStore(storeName);

  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic method to get all items
 */
async function getAll<T>(
  storeName: string,
  indexName?: string,
  query?: IDBValidKey | IDBKeyRange
): Promise<T[]> {
  const db = await getDB();
  const transaction = db.transaction([storeName], 'readonly');
  const store = indexName
    ? transaction.objectStore(storeName).index(indexName)
    : transaction.objectStore(storeName);

  return new Promise((resolve, reject) => {
    const request = query ? store.getAll(query) : store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generic method to delete items
 */
async function remove(storeName: string, id: string | string[]): Promise<void> {
  const db = await getDB();
  const transaction = db.transaction([storeName], 'readwrite');
  const store = transaction.objectStore(storeName);
  const ids = Array.isArray(id) ? id : [id];

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);

    ids.forEach(id => {
      store.delete(id);
    });
  });
}

/**
 * Clear all items from a store
 */
async function clear(storeName: string): Promise<void> {
  const db = await getDB();
  const transaction = db.transaction([storeName], 'readwrite');
  const store = transaction.objectStore(storeName);

  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Add item to sync queue for background sync
 */
async function addToSyncQueue(action: {
  type: string;
  store: string;
  operation: 'put' | 'delete';
  data?: any;
  id: string;
}): Promise<void> {
  const queueItem = {
    id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: action.type,
    store: action.store,
    operation: action.operation,
    data: action.data,
    targetId: action.id,
    status: 'pending',
    createdAt: Date.now(),
    retries: 0
  };

  await put('syncQueue', queueItem);
}

/**
 * Get pending sync queue items
 */
async function getPendingSync(): Promise<any[]> {
  return getAll('syncQueue', 'status', 'pending');
}

/**
 * Mark sync queue item as completed
 */
async function markSyncComplete(id: string): Promise<void> {
  const item = await get<any>('syncQueue', id);
  if (item) {
    item.status = 'completed';
    await put('syncQueue', item);
  }
}

/**
 * Mark sync queue item as failed
 */
async function markSyncFailed(id: string, error?: string): Promise<void> {
  const item = await get<any>('syncQueue', id);
  if (item) {
    item.status = 'failed';
    item.error = error;
    item.retries = (item.retries || 0) + 1;
    item.lastRetry = Date.now();
    await put('syncQueue', item);
  }
}

export const IndexedDBService = {
  init: initDB,
  put,
  get,
  getAll,
  remove,
  clear,
  addToSyncQueue,
  getPendingSync,
  markSyncComplete,
  markSyncFailed
};

