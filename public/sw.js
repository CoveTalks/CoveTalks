// Service Worker for CoveTalks PWA
// Version 1.0.0

'use strict';

// Ensure proper error handling
self.addEventListener('error', (event) => {
  console.error('[Service Worker] Error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[Service Worker] Unhandled rejection:', event.reason);
});

const CACHE_NAME = 'covetalks-v1.0.1';
const RUNTIME_CACHE = 'covetalks-runtime';

// Only cache essential files for offline
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/css/main.css',
  '/Images/CoveTalks_Vertical.svg'
];

// Install event - cache core files
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Precaching core files');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => {
        console.log('[Service Worker] Installation complete');
        // Skip waiting to activate immediately
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[Service Worker] Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => {
              // Delete old cache versions
              return cacheName.startsWith('covetalks-') && cacheName !== CACHE_NAME;
            })
            .map(cacheName => {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[Service Worker] Activation complete');
        // Take control of all pages immediately
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache when possible
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests (except CDNs we trust)
  if (url.origin !== location.origin) {
    // Allow specific CDNs
    const trustedOrigins = [
      'https://cdn.jsdelivr.net',
      'https://js.stripe.com',
      'https://cdnjs.cloudflare.com'
    ];
    
    if (!trustedOrigins.some(origin => url.origin === origin)) {
      return;
    }
  }

  // Handle API requests differently (don't cache)
  if (url.pathname.includes('/api/') || url.pathname.includes('/.netlify/functions/')) {
    event.respondWith(
      fetch(request)
        .catch(() => {
          // Return a custom offline response for API calls
          return new Response(
            JSON.stringify({ error: 'You are currently offline' }),
            {
              status: 503,
              statusText: 'Service Unavailable',
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // Network First strategy for HTML pages (to ensure fresh content)
  if (request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Clone the response before caching
          const responseToCache = response.clone();
          
          caches.open(RUNTIME_CACHE)
            .then(cache => {
              cache.put(request, responseToCache);
            });
          
          return response;
        })
        .catch(() => {
          // Try to serve from cache
          return caches.match(request)
            .then(response => {
              if (response) {
                return response;
              }
              // If not in cache, serve offline page
              return caches.match('/offline.html');
            });
        })
    );
    return;
  }

  // Cache First strategy for static assets (CSS, JS, images)
  event.respondWith(
    caches.match(request)
      .then(response => {
        if (response) {
          // Serve from cache
          return response;
        }

        // Not in cache, fetch from network
        return fetch(request)
          .then(response => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }

            // Clone the response before caching
            const responseToCache = response.clone();

            caches.open(RUNTIME_CACHE)
              .then(cache => {
                cache.put(request, responseToCache);
              });

            return response;
          });
      })
      .catch(() => {
        // For images, return a placeholder
        if (request.destination === 'image') {
          return caches.match('/Images/placeholder.svg');
        }
      })
  );
});

// Background sync for offline form submissions
self.addEventListener('sync', event => {
  if (event.tag === 'sync-forms') {
    event.waitUntil(syncOfflineForms());
  }
});

// Handle push notifications (if implemented)
self.addEventListener('push', event => {
  if (!event.data) return;

  const data = event.data.json();
  const title = data.title || 'CoveTalks Notification';
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/Images/icon-192x192.png',
    badge: '/Images/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
      url: data.url || '/'
    },
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/Images/action-view.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/Images/action-close.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'view' || !event.action) {
    const urlToOpen = event.notification.data.url || '/';
    
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(windowClients => {
          // Check if there's already a window/tab open
          for (let client of windowClients) {
            if (client.url === urlToOpen && 'focus' in client) {
              return client.focus();
            }
          }
          // Open new window if not found
          if (clients.openWindow) {
            return clients.openWindow(urlToOpen);
          }
        })
    );
  }
});

// Message handler for skip waiting
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Helper function to sync offline forms
async function syncOfflineForms() {
  try {
    const cache = await caches.open('offline-forms');
    const requests = await cache.keys();
    
    for (const request of requests) {
      const response = await cache.match(request);
      const formData = await response.json();
      
      // Attempt to submit the form
      try {
        await fetch(request.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        
        // Remove from cache if successful
        await cache.delete(request);
      } catch (error) {
        console.error('Failed to sync form:', error);
      }
    }
  } catch (error) {
    console.error('Sync failed:', error);
  }
}