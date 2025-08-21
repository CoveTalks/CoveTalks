// Simplified Service Worker Registration for CoveTalks
// Place at: /public/js/sw-register.js

(function() {
  'use strict';

  // Only register service worker if supported
  if (!('serviceWorker' in navigator)) {
    console.log('[SW] Service Workers not supported');
    return;
  }

  // Register when the window loads
  window.addEventListener('load', function() {
    registerServiceWorker();
  });

  async function registerServiceWorker() {
    try {
      // Register the service worker
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('[SW] Registered successfully:', registration.scope);

      // Check for updates periodically (every hour)
      setInterval(() => {
        registration.update();
      }, 3600000);

      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        console.log('[SW] Update found');

        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content available
              console.log('[SW] New content available');
              
              // Only show notification if not on initial load
              if (sessionStorage.getItem('sw-initial-load') !== 'true') {
                showUpdateNotification();
              }
            }
          });
        }
      });

      // Mark initial load complete
      sessionStorage.setItem('sw-initial-load', 'true');

    } catch (error) {
      console.error('[SW] Registration failed:', error.message);
    }
  }

  // Simple update notification
  function showUpdateNotification() {
    // Don't show if one already exists
    if (document.getElementById('update-toast')) return;

    const toast = document.createElement('div');
    toast.id = 'update-toast';
    toast.innerHTML = `
      <style>
        #update-toast {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: #155487;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 10000;
          display: flex;
          align-items: center;
          gap: 12px;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 14px;
        }
        #update-toast button {
          background: white;
          color: #155487;
          border: none;
          padding: 6px 12px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 600;
        }
        #update-toast button:hover {
          opacity: 0.9;
        }
      </style>
      <span>Update available!</span>
      <button onclick="location.reload()">Refresh</button>
      <button onclick="this.parentElement.remove()">Dismiss</button>
    `;
    document.body.appendChild(toast);

    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      if (document.getElementById('update-toast')) {
        document.getElementById('update-toast').remove();
      }
    }, 10000);
  }

  // Handle offline/online status
  let offlineToast = null;

  window.addEventListener('online', () => {
    if (offlineToast) {
      offlineToast.remove();
      offlineToast = null;
    }
    console.log('[SW] Back online');
  });

  window.addEventListener('offline', () => {
    if (!offlineToast) {
      offlineToast = document.createElement('div');
      offlineToast.innerHTML = `
        <style>
          .offline-toast {
            position: fixed;
            top: 60px;
            left: 50%;
            transform: translateX(-50%);
            background: #ff9800;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            z-index: 10000;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 14px;
          }
        </style>
        <div class="offline-toast">📵 You're offline - Some features may be limited</div>
      `;
      document.body.appendChild(offlineToast);
    }
    console.log('[SW] Offline');
  });

  // PWA Install handling
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log('[SW] Install prompt ready');
    
    // Show install button after 30 seconds if user hasn't dismissed it
    setTimeout(() => {
      if (deferredPrompt && localStorage.getItem('pwa-dismissed') !== 'true') {
        showInstallPrompt();
      }
    }, 30000);
  });

  function showInstallPrompt() {
    if (document.getElementById('install-prompt')) return;

    const prompt = document.createElement('div');
    prompt.id = 'install-prompt';
    prompt.innerHTML = `
      <style>
        #install-prompt {
          position: fixed;
          bottom: 80px;
          right: 20px;
          background: linear-gradient(135deg, #155487, #1d93b7);
          color: white;
          padding: 12px 18px;
          border-radius: 25px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 14px;
          animation: slideIn 0.3s ease;
        }
        #install-prompt button {
          background: transparent;
          border: 1px solid white;
          color: white;
          padding: 4px 12px;
          border-radius: 12px;
          cursor: pointer;
          font-size: 13px;
        }
        #install-prompt button:hover {
          background: rgba(255,255,255,0.1);
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      </style>
      <span>📱 Install CoveTalks</span>
      <button onclick="installPWA()">Install</button>
      <button onclick="dismissInstall()">✕</button>
    `;
    document.body.appendChild(prompt);
  }

  // Make functions globally available
  window.installPWA = async function() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('[SW] Install prompt outcome:', outcome);
      deferredPrompt = null;
      document.getElementById('install-prompt')?.remove();
    }
  };

  window.dismissInstall = function() {
    localStorage.setItem('pwa-dismissed', 'true');
    document.getElementById('install-prompt')?.remove();
  };

})();