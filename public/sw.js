/**
 * Service Worker for GlobalReach App
 * Provides offline support, caching, and background sync
 * Only registered in web mode (not Electron)
 */

const CACHE_VERSION = 'v1';
const CACHE_NAME = `globalreach-${CACHE_VERSION}`;
const API_CACHE_NAME = `globalreach-api-${CACHE_VERSION}`;

// Assets to precache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/index.css'
];

// Install event - precache critical assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS.map(url => new Request(url, { cache: 'reload' })));
    }).then(() => {
      console.log('[Service Worker] Precache complete');
      return self.skipWaiting(); // Activate immediately
    }).catch((error) => {
      console.error('[Service Worker] Precache failed:', error);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Activation complete');
      return self.clients.claim(); // Take control of all pages
    })
  );
});

// Fetch event - cache-first strategy for static assets, stale-while-revalidate for API
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Static assets - Cache First
  if (isStaticAsset(request.url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // API calls - Stale While Revalidate
  if (isAPIRequest(request.url)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Default - Network First
  event.respondWith(networkFirst(request));
});

/**
 * Check if request is for static asset
 */
function isStaticAsset(url) {
  const staticPatterns = [
    /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/,
    /\/assets\//,
    /\/chunks\//
  ];
  return staticPatterns.some(pattern => pattern.test(url));
}

/**
 * Check if request is API call
 */
function isAPIRequest(url) {
  return url.includes('/api/') || url.includes('/parse/');
}

/**
 * Cache First strategy - serve from cache, fallback to network
 */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[Service Worker] Cache First fetch failed:', error);
    throw error;
  }
}

/**
 * Stale While Revalidate strategy - serve from cache immediately, update in background
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(API_CACHE_NAME);
  const cached = await cache.match(request);

  // Return cached response immediately if available
  const fetchPromise = fetch(request).then((response) => {
    // Only cache successful responses
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch((error) => {
    console.error('[Service Worker] API fetch failed:', error);
    // If network fails and we have cache, return it
    if (cached) {
      return cached;
    }
    throw error;
  });

  // Return cached version immediately, or wait for network if no cache
  return cached || fetchPromise;
}

/**
 * Network First strategy - try network, fallback to cache
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

/**
 * Background Sync for offline actions
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-api-queue') {
    event.waitUntil(syncAPIQueue());
  }
});

/**
 * Sync pending API actions from IndexedDB
 */
async function syncAPIQueue() {
  try {
    // This would be called from the page context
    // For now, just log that sync was triggered
    console.log('[Service Worker] Background sync triggered');
    
    // Post message to all clients to trigger sync
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'SYNC_QUEUE' });
    });
  } catch (error) {
    console.error('[Service Worker] Background sync failed:', error);
  }
}

/**
 * Message handler for communication with page
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(event.data.urls);
      })
    );
  }
});

