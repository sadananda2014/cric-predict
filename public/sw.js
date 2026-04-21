/**
 * Service Worker for CricPredict PWA
 * Provides offline support, caching, and app-like experience
 */

const CACHE_NAME = 'cric-predict-v1';
const STATIC_CACHE = 'cric-predict-static-v1';

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
];

// Cache HTML on every request (network first for app shell)
const HTML_ROUTES = [
  '/',
];

/**
 * Install event: cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

/**
 * Activate event: clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

/**
 * Fetch event: implement caching strategy
 * - HTML (app shell): network-first
 * - API calls: network-first with fallback
 * - Static assets: cache-first
 * - Offline fallback: cached version
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome extensions
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // HTML routes: network-first
  if (HTML_ROUTES.some((route) => url.pathname === route)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response.status === 200) {
            const cache = caches.open(CACHE_NAME);
            cache.then((c) => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache
          return caches.match(request);
        })
    );
    return;
  }

  // API calls to external services: network-first with cache fallback
  if (url.origin !== location.origin) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const cache = caches.open(CACHE_NAME);
            cache.then((c) => c.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // Same-origin API/JS/CSS: cache-first with network fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request).then((response) => {
        if (response.status === 200 && response.type !== 'error') {
          const cache = caches.open(CACHE_NAME);
          cache.then((c) => c.put(request, response.clone()));
        }
        return response;
      });
    })
  );
});

/**
 * Background sync (optional): sync bet data when back online
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-matches') {
    event.waitUntil(syncMatches());
  }
});

async function syncMatches() {
  try {
    console.log('[SW] Syncing match data...');
    // Matches are stored locally in localStorage via Zustand
    // Nothing to sync back to server, but this is here for future API integration
  } catch (error) {
    console.error('[SW] Sync failed:', error);
  }
}
