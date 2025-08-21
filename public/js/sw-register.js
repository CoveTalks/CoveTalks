// Service Worker Registration for CoveTalks PWA
// This file should be placed at: /public/js/sw-register.js

(function() {
  'use strict';

  // Check if service workers are supported
  if ('serviceWorker' in navigator) {
    // Wait for the window to load completely
    window.addEventListener('load', function() {
      registerServiceWorker();
    });
  } else {
    console.log('[SW-Register] Service Workers are not supported in this browser');
  }

  /**
   * Register the service worker
   */
  async function registerServiceWorker() {
    try {
      // Register the service worker from the root path
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });

      console.log('[SW-Register] Service Worker registered successfully:', registration);

      // Check if there's an update available
      registration.addEventListener('updatefound', () => {
        console.log('[SW-Register] New service worker update found');
        
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker is installed but waiting to activate
              console.log('[SW-Register] New content available; please refresh');
              showUpdateNotification();
            }
          });
        }
      });

      // Handle controller change (when a new SW takes control)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[SW-Register] Controller changed, reloading page');
        window.location.reload();
      });

      // Check for updates periodically (every hour)
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000);

      // Check for updates when the page gains focus
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          registration.update();
        }
      });

    } catch (error) {
      console.error('[SW-Register] Service Worker registration failed:', error);
    }
  }

  /**
   * Show update notification to user
   */
  function showUpdateNotification() {
    // Check if there's already a notification
    if (document.getElementById('sw-update-notification')) {
      return;
    }

    // Create update notification element
    const notification = document.createElement('div');
    notification.id = 'sw-update-notification';
    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #155487;
      color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      display: flex;
      align-items: center;
      gap: 15px;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: slideUp 0.3s ease;
    `;

    notification.innerHTML = `
      <span>A new version of CoveTalks is available!</span>
      <button id="sw-update-btn" style="
        background: white;
        color: #155487;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        font-weight: bold;
        cursor: pointer;
        transition: opacity 0.2s;
      ">Update</button>
      <button id="sw-dismiss-btn" style="
        background: transparent;
        color: white;
        border: 1px solid white;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        transition: opacity 0.2s;
      ">Later</button>
    `;

    // Add animation keyframes if not already present
    if (!document.getElementById('sw-update-styles')) {
      const style = document.createElement('style');
      style.id = 'sw-update-styles';
      style.textContent = `
        @keyframes slideUp {
          from {
            transform: translateX(-50%) translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
          }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Handle update button click
    document.getElementById('sw-update-btn').addEventListener('click', () => {
      skipWaitingAndReload();
    });

    // Handle dismiss button click
    document.getElementById('sw-dismiss-btn').addEventListener('click', () => {
      notification.remove();
    });
  }

  /**
   * Skip waiting and reload the page
   */
  async function skipWaitingAndReload() {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration && registration.waiting) {
      // Tell the waiting service worker to skip waiting
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  /**
   * Request persistent storage if available
   */
  async function requestPersistentStorage() {
    if (navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persist();
      console.log(`[SW-Register] Persistent storage ${isPersisted ? 'granted' : 'denied'}`);
    }
  }

  // Request persistent storage
  requestPersistentStorage();

  /**
   * Handle offline/online events
   */
  window.addEventListener('online', () => {
    console.log('[SW-Register] Back online');
    // Remove any offline indicators
    const offlineIndicator = document.getElementById('offline-indicator');
    if (offlineIndicator) {
      offlineIndicator.remove();
    }
  });

  window.addEventListener('offline', () => {
    console.log('[SW-Register] Gone offline');
    // Show offline indicator
    showOfflineIndicator();
  });

  /**
   * Show offline indicator
   */
  function showOfflineIndicator() {
    // Check if already exists
    if (document.getElementById('offline-indicator')) {
      return;
    }

    const indicator = document.createElement('div');
    indicator.id = 'offline-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 60px;
      left: 50%;
      transform: translateX(-50%);
      background: #ff9800;
      color: white;
      padding: 10px 20px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      animation: slideDown 0.3s ease;
    `;
    indicator.textContent = '📵 You are currently offline';

    // Add animation keyframes if not already present
    if (!document.getElementById('offline-styles')) {
      const style = document.createElement('style');
      style.id = 'offline-styles';
      style.textContent = `
        @keyframes slideDown {
          from {
            transform: translateX(-50%) translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
          }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(indicator);
  }

  /**
   * Install PWA prompt handling
   */
  let deferredPrompt;
  
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later
    deferredPrompt = e;
    console.log('[SW-Register] Install prompt captured');
    
    // Show your custom install button/banner
    showInstallButton();
  });

  /**
   * Show install button
   */
  function showInstallButton() {
    // Check if user hasn't dismissed it permanently
    const dismissed = localStorage.getItem('covetalks-pwa-dismissed');
    if (dismissed === 'true') {
      return;
    }

    // Check if we're not already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return;
    }

    // Check if button already exists
    if (document.getElementById('pwa-install-button')) {
      return;
    }

    // Create install button
    const installButton = document.createElement('div');
    installButton.id = 'pwa-install-button';
    installButton.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      background: linear-gradient(135deg, #155487 0%, #1d93b7 100%);
      color: white;
      padding: 12px 20px;
      border-radius: 25px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      cursor: pointer;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
      transition: transform 0.2s, box-shadow 0.2s;
      animation: slideInRight 0.3s ease;
    `;

    installButton.innerHTML = `
      <span>📱</span>
      <span>Install CoveTalks App</span>
      <button id="pwa-close-btn" style="
        background: transparent;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        margin-left: 10px;
        line-height: 1;
      ">×</button>
    `;

    // Add animation keyframes
    if (!document.getElementById('pwa-install-styles')) {
      const style = document.createElement('style');
      style.id = 'pwa-install-styles';
      style.textContent = `
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        #pwa-install-button:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 16px rgba(0,0,0,0.3);
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(installButton);

    // Handle install button click
    installButton.addEventListener('click', async (e) => {
      if (e.target.id === 'pwa-close-btn') {
        // Close button clicked
        installButton.remove();
        localStorage.setItem('covetalks-pwa-dismissed', 'true');
        return;
      }
      
      if (deferredPrompt) {
        // Show the install prompt
        deferredPrompt.prompt();
        
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`[SW-Register] User response to install prompt: ${outcome}`);
        
        if (outcome === 'accepted') {
          console.log('[SW-Register] User accepted the install prompt');
          installButton.remove();
        }
        
        // Clear the deferred prompt
        deferredPrompt = null;
      }
    });
  }

  /**
   * Handle app installed event
   */
  window.addEventListener('appinstalled', () => {
    console.log('[SW-Register] CoveTalks PWA was installed');
    // Remove install button if it exists
    const installButton = document.getElementById('pwa-install-button');
    if (installButton) {
      installButton.remove();
    }
    
    // Track installation (if analytics is set up)
    if (typeof gtag !== 'undefined') {
      gtag('event', 'pwa_installed', {
        event_category: 'PWA',
        event_label: 'Install'
      });
    }
  });

})();